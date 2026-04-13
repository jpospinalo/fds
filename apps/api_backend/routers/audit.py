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

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

router = APIRouter(prefix="/audit", tags=["Auditoría SGA"])

_audit_cache: Dict[str, dict] = {}


def _generate_csv_report(secciones: list) -> str:
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
    Parsea el reporte generado por sga_auditor_judge.py.

    El auditor genera bloques de 2 columnas por sección:
        --- SECCIÓN Seccion_X ---
        Ítem Solicitado\tEstado (Presente / No Presente)
        Descripción del ítem (ID: x_y)\tPresente
        Descripción del ítem (ID: x_z)\tNo Presente
        ...

    También soporta el formato legacy de columnas pareadas (Item_X_Y / Calidad_X_Y).
    """
    secciones: list[AuditSectionResult] = []

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
            header_cols = [c.strip() for c in lineas[0].split("\t")]

            # Detectar formato: 2 columnas con encabezado tipo "Ítem Solicitado"
            # versus formato legacy de columnas pareadas Item_X / Calidad_X
            is_two_col = (
                len(header_cols) == 2
                and not header_cols[0].lower().startswith("item_")
            )

            if is_two_col:
                # Formato actual del auditor:
                # Cada fila de datos = un ítem
                # "Descripción larga (ID: 1_1)\tPresente"
                for linea in lineas[1:]:
                    partes = [p.strip() for p in linea.split("\t")]
                    if len(partes) < 2:
                        continue
                    descripcion = partes[0]
                    estado = partes[1]

                    # Extraer el ID del campo descripción: "Texto... (ID: 1_1)"
                    id_match = re.search(r'\(ID:\s*([^)]+)\)', descripcion)
                    if id_match:
                        raw_id = id_match.group(1).strip()
                        item_key = f"Item_{raw_id}"
                    else:
                        # Fallback: usar primeras 50 chars como identificador
                        item_key = descripcion[:50]

                    # Normalizar presencia — acepta "Presente", "No Presente",
                    # "No_Presente", "Ausente", etc.
                    estado_norm = estado.strip().lower().replace("_", " ")
                    is_present = (
                        "presente" in estado_norm
                        and "no presente" not in estado_norm
                    )
                    presencia = "Presente" if is_present else "No_Presente"
                    calidad = "Confiable" if is_present else "NO_Conf"

                    items.append(
                        AuditItemResult(
                            item=item_key,
                            calidad=calidad,
                            presencia=presencia,
                        )
                    )

            else:
                # Formato legacy de columnas pareadas:
                # Fila 0: Item_1_0\tCalidad_1_0\tItem_1_1\tCalidad_1_1...
                # Fila 1: Presente\tConfiable\tNo_Presente\tNO_Conf...
                encabezados = header_cols
                valores = lineas[1].split("\t") if len(lineas) > 1 else []
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

    # Calcular puntajes por sección
    calidad_score = {"Confiable": 5, "Conf_CR": 3, "NO_Conf": 1}
    for sec in secciones:
        if sec.items:
            bruto = sum(calidad_score.get(it.calidad, 1) for it in sec.items)
            sec.puntaje_bruto = bruto
            sec.puntaje_porcentual = round(
                (bruto / (5 * len(sec.items))) * 100, 1
            )

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
    from api_backend.config import Config

    report_path = (
        Config.DATA_DIR / "evaluation_reports" / f"Checklist_SGA_{doc_id}.txt"
    )

    # Siempre re-parsear desde archivo para garantizar que el parser actualizado
    # se aplique incluso a reportes generados anteriormente.
    if report_path.exists():
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