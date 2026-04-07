import os
import boto3
from fastapi import APIRouter, HTTPException
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/documents", tags=["Documentos"])

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


@router.get("/", summary="Listar todos los documentos disponibles")
def list_documents():
    """
    Escanea la capa Gold para obtener la lista de documentos procesados.
    Devuelve doc_id, secciones disponibles y total de chunks.
    """
    s3 = get_s3()
    paginator = s3.get_paginator("list_objects_v2")

    # Gold: chunks por documento
    chunks_por_doc = defaultdict(int)
    for page in paginator.paginate(Bucket=BUCKET, Prefix=f"{GOLD_PREFIX}chunks/"):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith("_chunks.jsonl"):
                doc_id = os.path.basename(obj["Key"]).replace("_chunks.jsonl", "")
                chunks_por_doc[doc_id] += 1

    # Silver: secciones por documento
    secciones_por_doc = defaultdict(set)
    for page in paginator.paginate(Bucket=BUCKET, Prefix=SILVER_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".jsonl"):
                continue
            # path: silver/seccion_X/doc_id.jsonl
            parts = key.split("/")
            if len(parts) >= 3 and "seccion_" in parts[-2]:
                seccion_str = parts[-2].replace("seccion_", "")
                doc_id = parts[-1].replace(".jsonl", "")
                try:
                    secciones_por_doc[doc_id].add(int(seccion_str))
                except ValueError:
                    pass

    todos = set(chunks_por_doc.keys()) | set(secciones_por_doc.keys())
    resultado = []
    for doc_id in sorted(todos):
        resultado.append({
            "doc_id": doc_id,
            "secciones_disponibles": sorted(secciones_por_doc.get(doc_id, [])),
            "total_chunks": chunks_por_doc.get(doc_id, 0),
        })
    return resultado


@router.get("/{doc_id}/section/{num_seccion}", summary="Obtener contenido de una sección")
def get_section_content(doc_id: str, num_seccion: int):
    """
    Devuelve el texto completo de una sección específica de un documento
    leyendo directamente desde la Capa Silver.
    """
    s3 = get_s3()
    key = f"{SILVER_PREFIX}seccion_{num_seccion}/{doc_id}.jsonl"
    try:
        response = s3.get_object(Bucket=BUCKET, Key=key)
        import json
        raw = response["Body"].read().decode("utf-8")
        data = json.loads(raw.strip().split("\n")[0])
        return {
            "doc_id": doc_id,
            "seccion": num_seccion,
            "contenido": data.get("contenido", ""),
        }
    except s3.exceptions.NoSuchKey:
        raise HTTPException(404, f"Sección {num_seccion} no encontrada para '{doc_id}'")
    except Exception as e:
        raise HTTPException(500, str(e))