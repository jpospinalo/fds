import hashlib
import json
import logging
from datetime import datetime, timezone
from api_backend.auditor.sga_auditor_judge import SECCIONES_OBJETIVO
import boto3

from api_backend.config import Config

logger = logging.getLogger(__name__)

SECCIONES_AUDITADAS = SECCIONES_OBJETIVO


def _s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        aws_session_token=Config.AWS_SESSION_TOKEN,
        region_name=Config.AWS_REGION,
    )


def compute_source_hash(doc_id: str) -> str | None:
    """sha256 del contenido que ve el LLM (ChromaDB). None si ChromaDB no responde."""
    try:
        from api_backend.rag_engine.retriever import buscar_contexto
        texts = []
        for sec in SECCIONES_AUDITADAS:
            fragmentos = buscar_contexto(
                query=f"Contenido de la sección {sec}",
                doc_id=doc_id,
                num_seccion=sec,
                top_k=10,
            )
            texts.extend(f["texto"] for f in fragmentos)
        combined = "\n".join(texts)
        return hashlib.sha256(combined.encode()).hexdigest()
    except Exception:
        logger.warning("No se pudo calcular source_hash para %s", doc_id)
        return None


def upload_audit_result(doc_id: str, result: dict) -> str | None:
    """Sube resultado a S3 gold/auditorias/ con timestamp (versionado). Falla silenciosamente."""
    try:
        s3 = _s3_client()
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        slim = {k: v for k, v in result.items() if k not in ("reporte_txt", "reporte_csv")}

        key = f"{Config.S3_PREFIX_GOLD}auditorias/{doc_id}/audit_{ts}.json"
        s3.put_object(
            Bucket=Config.S3_BUCKET_NAME,
            Key=key,
            Body=json.dumps(slim, ensure_ascii=False),
            ContentType="application/json",
        )

        txt = result.get("reporte_txt")
        if txt:
            txt_key = f"{Config.S3_PREFIX_GOLD}auditorias/{doc_id}/Checklist_SGA_{ts}.txt"
            s3.put_object(
                Bucket=Config.S3_BUCKET_NAME,
                Key=txt_key,
                Body=txt.encode("utf-8"),
                ContentType="text/plain; charset=utf-8",
            )

        logger.info("Resultado de auditoría subido a S3: %s", key)
        return key
    except Exception:
        logger.exception("S3 upload fallido para doc_id=%s — continuando sin S3", doc_id)
        return None
