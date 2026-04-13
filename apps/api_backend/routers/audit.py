import os
import re
import sys
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from api_backend.schemas.models import (
    AuditRequest,
    AuditResponse,
    AuditItemResult,
    AuditSectionResult,
)

# Asegurar acceso a api_backend
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

router = APIRouter(prefix="/audit", tags=["Auditoría SGA"])

# Caché en memoria (en producción usar Redis o DB)
_audit_cache: Dict[str, dict] = {}


def _generate_csv_report(secciones: list) -> str:
    """
    Genera un reporte CSV a partir de las secciones auditadas.
    """
    csv_lines = ["Sección,Ítem,Presencia,Calidad,Observaciones"]

    for sec in secciones:
        for item in sec.items:
            seccion = sec.seccion
            item_name = item.item.replace('"', '""')
            presencia = item.presencia
            calidad = item.calidad
            observaciones = (item.observaciones or "").replace('"', '""')

            csv_lines.append(
                f'{seccion},"{item_name}","{presencia}","{calidad}","{observaciones}"'
            )

    return "\n".join(csv_lines)


def _parse_audit_report(raw_text: str, doc_id: str) -> AuditResponse:
    """
    Parsea el reporte TSV generado por sga_auditor_judge.py.

    El juez genera bloques con el formato:
        --- SECCIÓN Seccion_X ---
        <encabezado TSV>
        <valores TSV>

    CORRECCIÓN: El split original buscaba 'SECCION_N' (número directo) pero
    el reporte real escribe 'Seccion_N'. Se unifican ambas variantes.
    """
    secciones: list[AuditSectionResult] = []

    # ── Acepta ambas variantes del separador ─────────────────────────────────
    # Variante 1 (juez actual): "--- SECCIÓN Seccion_2 ---"
    # Variante 2 (legacy):      "--- SECCION_2 ---"
    bloques = re.split(
        r"---\s*(?:SECCI[OÓ]N\s+Seccion_|SECCION_)(\d+)\s*---",
        raw_text,
        flags=re.IGNORECASE,
    )

    i = 1
    while i < len(bloques) - 1:
        try:
            num = int(bloques[i])
            contenido = bloques[i + 1].strip()
        except (ValueError, IndexError):
            i += 2
            continue

        items: list[AuditItemResult] = []
        lineas = [l for l in contenido.split("\n") if l.strip()]

        if len(lineas) >= 2:
            encabezados = lineas[0].split("\t")
            valores = lineas[1].split("\t") if len(lineas) > 1 else []

            # Parsear pares Item_X_Y / Calidad_X_Y
            for j in range(0, len(encabezados) - 1, 2):
                item_label = encabezados[j].strip()
                presencia = valores[j].strip() if j < len(valores) else "No_Presente"
                calidad = (
                    valores[j + 1].strip()
                    if j + 1 < len(valores)
                    else "NO_Conf"
                )
                items.append(
                    AuditItemResult(
                        item=item_label,
                        calidad=calidad,
                        presencia=presencia,
                    )
                )

        secciones.append(
            AuditSectionResult(
                seccion=num,
                items=items,
                raw_text=contenido,
            )
        )
        i += 2

    # ── Calcular puntajes por sección ─────────────────────────────────────────
    calidad_score = {"Confiable": 5, "Conf_CR": 3, "NO_Conf": 1}
    for sec in secciones:
        if sec.items:
            bruto = sum(calidad_score.get(it.calidad, 1) for it in sec.items)
            sec.puntaje_bruto = bruto
            sec.puntaje_porcentual = round(
                (bruto / (5 * len(sec.items))) * 100, 1
            )

    # ── Generar CSV ───────────────────────────────────────────────────────────
    csv_report = _generate_csv_report(secciones)

    return AuditResponse(
        doc_id=doc_id,
        status="completed",
        secciones=secciones,
        reporte_txt=raw_text,
        reporte_csv=csv_report,
    )


@router.post("/{doc_id}", summary="Ejecutar auditoría completa SGA para un documento")
def run_audit(doc_id: str, background_tasks: BackgroundTasks):
    """
    Lanza la auditoría automática de las secciones SGA configuradas.
    El proceso corre en background; consulta GET /{doc_id}/results para el estado.
    """
    if doc_id in _audit_cache and _audit_cache[doc_id].get("status") == "running":
        return {"status": "running", "doc_id": doc_id}

    _audit_cache[doc_id] = {"status": "running", "doc_id": doc_id}

    def _run():
        try:
            from api_backend.auditor.sga_auditor_judge import inspeccionar_documento_texto

            reporte_path = inspeccionar_documento_texto(doc_id)
            with open(reporte_path, "r", encoding="utf-8") as f:
                raw = f.read()
            resultado = _parse_audit_report(raw, doc_id)
            _audit_cache[doc_id] = resultado.dict()
        except Exception as e:
            _audit_cache[doc_id] = {
                "status": "error",
                "doc_id": doc_id,
                "detail": str(e),
            }

    background_tasks.add_task(_run)
    return {
        "status": "running",
        "doc_id": doc_id,
        "message": "Auditoría iniciada en background",
    }


@router.get("/{doc_id}/results", summary="Obtener resultados de auditoría")
def get_audit_results(doc_id: str):
    """
    Devuelve el estado y resultados de la auditoría más reciente.
    status: running | completed | error
    """
    from api_backend.config import Config

    # Intentar cargar desde archivo si no está en caché
    report_path = (
        Config.DATA_DIR / "evaluation_reports" / f"Checklist_SGA_{doc_id}.txt"
    )
    if report_path.exists() and doc_id not in _audit_cache:
        with open(report_path, "r", encoding="utf-8") as f:
            raw = f.read()
        result = _parse_audit_report(raw, doc_id)
        _audit_cache[doc_id] = result.dict()

    if doc_id not in _audit_cache:
        raise HTTPException(
            status_code=404,
            detail="No hay auditoría disponible para este documento. Ejecuta primero POST /audit/{doc_id}",
        )

    return _audit_cache[doc_id]