import json
import os
from collections import defaultdict
from typing import Optional

import boto3
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query

from api_backend.config import Config

load_dotenv()

router = APIRouter(prefix="/documents", tags=["Documentos"])

# Cache doc_id → year más reciente, poblado en list_documents
_doc_year_cache: dict[str, int] = {}


def get_s3():
    return boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
        region_name=os.getenv("AWS_REGION"),
    )

BUCKET = os.getenv("S3_BUCKET_NAME")
SILVER_PREFIX = os.getenv("S3_PREFIX_SILVER", "silver/")
GOLD_PREFIX = os.getenv("S3_PREFIX_GOLD", "gold/")


TOTAL_SECCIONES = 16


def _estado_desde_auditoria(doc_id: str) -> dict[str, str] | None:
    """
    Devuelve estado por sección basado en resultados de auditoría del cache SQLite.
    Retorna None si no hay auditoría disponible para el documento.
    - presente    (verde):   puntaje_porcentual >= 80
    - incompleta  (amarillo): 0 < puntaje_porcentual < 80
    - no_presente (rojo):    puntaje_porcentual == 0 o sin ítems
    """
    from api_backend.cache import audit_store
    data = audit_store.load(doc_id)
    if not data or data.get("status") != "completed":
        return None

    estado: dict[str, str] = {}
    secciones_auditadas = {str(s["seccion"]): s for s in data.get("secciones", [])}

    for s in range(1, TOTAL_SECCIONES + 1):
        key = str(s)
        sec = secciones_auditadas.get(key)
        if sec is None:
            estado[key] = "no_presente"
            continue
        pct = sec.get("puntaje_porcentual")
        if pct is None:
            items = sec.get("items", [])
            content_items = [i for i in items if not i.get("item", "").endswith("_0")]
            if not content_items:
                estado[key] = "no_presente"
                continue
            presentes = sum(1 for i in content_items if i.get("presencia") == "Presente")
            pct = (presentes / len(content_items)) * 100

        if pct >= 80:
            estado[key] = "presente"
        elif pct > 0:
            estado[key] = "incompleta"
        else:
            estado[key] = "no_presente"

    return estado


@router.get("/", summary="Listar todos los documentos disponibles")
def list_documents():
    s3 = get_s3()
    paginator = s3.get_paginator("list_objects_v2")

    chunks_por_doc: dict[str, int] = defaultdict(int)
    year_por_doc: dict[str, int] = {}
    secciones_por_doc: dict[str, set] = defaultdict(set)

    # Gold: gold/FDS {YYYY}/seccion_{N}/{doc_id}_chunks.jsonl
    for page in paginator.paginate(Bucket=BUCKET, Prefix=GOLD_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith("_chunks.jsonl"):
                continue
            parts = key.split("/")
            # ["gold", "FDS YYYY", "seccion_N", "name_chunks.jsonl"]
            if len(parts) < 4 or not parts[1].startswith("FDS "):
                continue
            try:
                year = int(parts[1].replace("FDS ", ""))
                doc_id = parts[3].replace("_chunks.jsonl", "")
            except (ValueError, IndexError):
                continue
            chunks_por_doc[doc_id] += 1
            if doc_id not in year_por_doc or year > year_por_doc[doc_id]:
                year_por_doc[doc_id] = year

    # Silver: silver/FDS {YYYY}/seccion_{N}/{doc_id}.jsonl
    for page in paginator.paginate(Bucket=BUCKET, Prefix=SILVER_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".jsonl"):
                continue
            parts = key.split("/")
            # ["silver", "FDS YYYY", "seccion_N", "name.jsonl"]
            if len(parts) < 4 or not parts[1].startswith("FDS "):
                continue
            try:
                year = int(parts[1].replace("FDS ", ""))
                seccion = int(parts[2].replace("seccion_", ""))
                doc_id = parts[3].replace(".jsonl", "")
            except (ValueError, IndexError):
                continue
            secciones_por_doc[doc_id].add(seccion)
            if doc_id not in year_por_doc or year > year_por_doc[doc_id]:
                year_por_doc[doc_id] = year

    # Actualizar cache de año
    _doc_year_cache.clear()
    _doc_year_cache.update(year_por_doc)

    todos = set(chunks_por_doc.keys()) | set(secciones_por_doc.keys())
    resultado = []
    for doc_id in sorted(todos):
        secciones_disponibles = sorted(secciones_por_doc.get(doc_id, set()))
        estado = _estado_desde_auditoria(doc_id)
        if estado is None:
            estado = {str(s): "sin_auditoria" for s in range(1, TOTAL_SECCIONES + 1)}
        resultado.append({
            "doc_id": doc_id,
            "year": year_por_doc.get(doc_id),
            "secciones_disponibles": secciones_disponibles,
            "total_chunks": chunks_por_doc.get(doc_id, 0),
            "secciones_estado": estado,
        })
    return resultado


@router.get("/{doc_id}/section/{num_seccion}", summary="Obtener contenido de una sección")
def get_section_content(doc_id: str, num_seccion: int, year: Optional[int] = Query(None)):
    resolved_year = year or _doc_year_cache.get(doc_id)
    if not resolved_year:
        raise HTTPException(
            400,
            f"Año no disponible para '{doc_id}'. Llama primero a GET /documents/ o pasa ?year=YYYY",
        )
    s3 = get_s3()
    key = f"{SILVER_PREFIX}FDS {resolved_year}/seccion_{num_seccion}/{doc_id}.jsonl"
    try:
        response = s3.get_object(Bucket=BUCKET, Key=key)
        raw = response["Body"].read().decode("utf-8")
        data = json.loads(raw.strip().split("\n")[0])
        return {
            "doc_id": doc_id,
            "seccion": num_seccion,
            "contenido": data.get("contenido", ""),
        }
    except s3.exceptions.NoSuchKey:
        raise HTTPException(404, f"Sección {num_seccion} no encontrada para '{doc_id}' (año {resolved_year})")
    except Exception as e:
        raise HTTPException(500, str(e))