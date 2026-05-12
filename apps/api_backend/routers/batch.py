import threading
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api_backend import rate_limiter
from api_backend.cache import audit_store

router = APIRouter(prefix="/batch", tags=["Auditoría Masiva"])

_batch: dict = {
    "running": False,
    "stopped": False,
    "total": 0,
    "completados": 0,
    "fallidos": 0,
    "omitidos": 0,
    "en_curso": None,
    "cola": [],
    "resultados": [],
    "omitidos_ids": [],
    "started_at": None,
}
_batch_lock = threading.Lock()


class BatchStartRequest(BaseModel):
    doc_ids: List[str]


@router.post("/start", summary="Iniciar auditoría masiva")
def start_batch(req: BatchStartRequest):
    with _batch_lock:
        if _batch["running"]:
            raise HTTPException(status_code=409, detail="Ya hay una auditoría masiva en curso.")

    can, msg = rate_limiter.can_call()
    if not can:
        raise HTTPException(status_code=429, detail=msg)

    audited = {a["doc_id"] for a in audit_store.get_all() if a["results"].get("status") == "completed"}

    pendientes = [d for d in req.doc_ids if d not in audited]
    ya_auditados = [d for d in req.doc_ids if d in audited]

    if not pendientes:
        return {
            "status": "noop",
            "mensaje": "Todos los documentos ya están auditados.",
            "omitidos": len(ya_auditados),
        }

    with _batch_lock:
        _batch.update({
            "running": True,
            "stopped": False,
            "total": len(pendientes),
            "completados": 0,
            "fallidos": 0,
            "omitidos": len(ya_auditados),
            "en_curso": None,
            "cola": list(pendientes),
            "resultados": [],
            "omitidos_ids": list(ya_auditados),
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

    threading.Thread(target=_run_batch, args=(list(pendientes),), daemon=True).start()

    return {
        "status": "started",
        "pendientes": len(pendientes),
        "omitidos": len(ya_auditados),
        "mensaje": f"Auditando {len(pendientes)} documentos. {len(ya_auditados)} ya auditados fueron omitidos.",
    }


def _doc_score(results: dict) -> float | None:
    secciones = results.get("secciones", [])
    scores = [s["puntaje_porcentual"] for s in secciones if s.get("puntaje_porcentual") is not None]
    return round(sum(scores) / len(scores), 1) if scores else None


def _run_batch(doc_ids: list[str]) -> None:
    for doc_id in doc_ids:
        with _batch_lock:
            if _batch["stopped"]:
                break
            _batch["en_curso"] = doc_id
            _batch["cola"] = [d for d in _batch["cola"] if d != doc_id]

        can, msg = rate_limiter.can_call()
        if not can:
            with _batch_lock:
                _batch["resultados"].append({
                    "doc_id": doc_id,
                    "status": "bloqueado",
                    "motivo": msg,
                })
                _batch["fallidos"] += 1
                # RPD agotado: detener todo
                _batch["cola"] = []
            break

        try:
            from api_backend.auditor.sga_auditor_judge import inspeccionar_documento_texto
            from api_backend.auditor.audit_s3 import compute_source_hash, upload_audit_result
            from api_backend.routers.audit import _parse_audit_report, _audit_cache

            new_hash = compute_source_hash(doc_id)
            reporte_path = inspeccionar_documento_texto(doc_id)

            with open(reporte_path, "r", encoding="utf-8") as f:
                raw = f.read()

            resultado = _parse_audit_report(raw, doc_id)
            data = resultado.dict()

            _audit_cache[doc_id] = data
            audit_store.save(doc_id, data, source_hash=new_hash)
            upload_audit_result(doc_id, data)

            with _batch_lock:
                _batch["completados"] += 1
                _batch["resultados"].append({
                    "doc_id": doc_id,
                    "status": "completado",
                    "puntaje": _doc_score(data),
                })

        except RuntimeError as e:
            # RPD agotado desde dentro del auditor
            with _batch_lock:
                _batch["fallidos"] += 1
                _batch["resultados"].append({
                    "doc_id": doc_id,
                    "status": "bloqueado",
                    "motivo": str(e),
                })
                _batch["cola"] = []
            break

        except Exception as e:
            with _batch_lock:
                _batch["fallidos"] += 1
                _batch["resultados"].append({
                    "doc_id": doc_id,
                    "status": "error",
                    "motivo": str(e),
                })

    with _batch_lock:
        _batch["running"] = False
        _batch["en_curso"] = None


@router.get("/status", summary="Estado de la auditoría masiva y consumo de API")
def get_batch_status():
    with _batch_lock:
        state = {k: v for k, v in _batch.items()}
    state["rate_limit"] = rate_limiter.get_status()
    return state


@router.post("/stop", summary="Detener auditoría masiva")
def stop_batch():
    with _batch_lock:
        if not _batch["running"]:
            raise HTTPException(status_code=400, detail="No hay auditoría masiva en curso.")
        _batch["stopped"] = True
    return {"status": "stopping", "mensaje": "Se detendrá después del documento actual."}
