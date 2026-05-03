import os
import re
import sys
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from api_backend.schemas.models import (
    AuditRequest,
    AuditResponse,
    AuditChanges,
    AuditItemResult,
    AuditSectionResult,
)

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api_backend.cache import audit_store

router = APIRouter(prefix="/audit", tags=["Auditoría SGA"])

_audit_cache: Dict[str, dict] = {}


def _compute_diff(old: dict, new: dict) -> AuditChanges:
    old_items = {
        (s["seccion"], i["item"]): i["presencia"]
        for s in old.get("secciones", [])
        for i in s.get("items", [])
    }
    new_items = {
        (s["seccion"], i["item"]): i["presencia"]
        for s in new.get("secciones", [])
        for i in s.get("items", [])
    }
    added = [{"seccion": k[0], "item": k[1]} for k in new_items if k not in old_items]
    removed = [{"seccion": k[0], "item": k[1]} for k in old_items if k not in new_items]
    status_changed = [
        {"seccion": k[0], "item": k[1], "before": old_items[k], "after": new_items[k]}
        for k in old_items
        if k in new_items and old_items[k] != new_items[k]
    ]
    return AuditChanges(added=added, removed=removed, status_changed=status_changed)


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


@router.get("/{doc_id}/exists", summary="Verificar si ya existe auditoría para un documento")
def check_audit_exists(doc_id: str):
    meta = audit_store.get_meta(doc_id)
    if meta is None:
        return {"exists": False, "created_at": None, "updated_at": None}
    return {"exists": True, "created_at": meta["created_at"], "updated_at": meta["updated_at"]}


@router.post("/{doc_id}", summary="Ejecutar auditoría completa SGA para un documento")
def run_audit(doc_id: str, background_tasks: BackgroundTasks, force: bool = Query(False)):
    if doc_id in _audit_cache and _audit_cache[doc_id].get("status") == "running":
        return {"status": "running", "doc_id": doc_id}

    # Sin force: devolver resultado existente sin re-correr el LLM
    if not force:
        if doc_id in _audit_cache and _audit_cache[doc_id].get("status") == "completed":
            return _audit_cache[doc_id]
        stored = audit_store.load(doc_id)
        if stored and stored.get("status") == "completed":
            _audit_cache[doc_id] = stored
            return stored

    _audit_cache[doc_id] = {"status": "running", "doc_id": doc_id}

    def _run():
        try:
            from api_backend.auditor.sga_auditor_judge import inspeccionar_documento_texto
            from api_backend.auditor.audit_s3 import compute_source_hash, upload_audit_result
            from api_backend.config import Config

            # Fase 3: hash del contenido fuente (ChromaDB)
            new_hash = compute_source_hash(doc_id)

            # Si re-auditoría forzada pero fuente sin cambios → saltar LLM
            if force:
                meta = audit_store.get_meta(doc_id)
                if new_hash and meta and meta.get("source_hash") == new_hash:
                    existing = audit_store.load(doc_id)
                    if existing:
                        existing["changes"] = AuditChanges(
                            note="Sin cambios en la fuente del documento"
                        ).dict()
                        report_path = Config.DATA_DIR / "evaluation_reports" / f"Checklist_SGA_{doc_id}.txt"
                        if report_path.exists():
                            existing["reporte_txt"] = report_path.read_text(encoding="utf-8")
                        audit_store.save(doc_id, existing, source_hash=new_hash)
                        _audit_cache[doc_id] = existing
                        return

            # Cargar datos previos para diff (solo en re-auditoría)
            previous_data = audit_store.load(doc_id) if force else None

            reporte_path = inspeccionar_documento_texto(doc_id)
            with open(reporte_path, "r", encoding="utf-8") as f:
                raw = f.read()
            resultado = _parse_audit_report(raw, doc_id)
            data = resultado.dict()

            # Fase 3: calcular diff respecto a auditoría previa
            if force and previous_data:
                data["changes"] = _compute_diff(previous_data, data).dict()

            _audit_cache[doc_id] = data
            audit_store.save(doc_id, data, source_hash=new_hash)
            upload_audit_result(doc_id, data)
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

    # 1. Memoria — devuelve "running" si está en curso (no 404)
    if doc_id in _audit_cache:
        cached = _audit_cache[doc_id]
        if cached.get("status") == "running":
            return cached
        if not cached.get("reporte_txt"):
            report_path = Config.DATA_DIR / "evaluation_reports" / f"Checklist_SGA_{doc_id}.txt"
            if report_path.exists():
                cached["reporte_txt"] = report_path.read_text(encoding="utf-8")
        return cached

    # 2. SQLite
    stored = audit_store.load(doc_id)
    if stored and stored.get("status") == "completed":
        report_path = Config.DATA_DIR / "evaluation_reports" / f"Checklist_SGA_{doc_id}.txt"
        if report_path.exists():
            stored["reporte_txt"] = report_path.read_text(encoding="utf-8")
        _audit_cache[doc_id] = stored
        return stored

    # 3. Archivo TXT legacy (re-parsear y guardar en SQLite)
    report_path = Config.DATA_DIR / "evaluation_reports" / f"Checklist_SGA_{doc_id}.txt"
    if report_path.exists():
        raw = report_path.read_text(encoding="utf-8")
        result = _parse_audit_report(raw, doc_id)
        data = result.dict()
        _audit_cache[doc_id] = data
        audit_store.save(doc_id, data)
        return data

    raise HTTPException(
        status_code=404,
        detail="No hay auditoría disponible para este documento. Ejecuta primero POST /audit/{doc_id}",
    )