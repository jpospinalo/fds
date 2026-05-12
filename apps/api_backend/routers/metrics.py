from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter

from api_backend.cache import audit_store
from api_backend.routers.audit import _audit_cache

router = APIRouter(prefix="/metrics", tags=["Métricas"])

SECTION_NAMES = {
    1: "Identificación",
    2: "Identificación de peligros",
    3: "Composición",
    4: "Primeros auxilios",
    5: "Lucha contra incendios",
    6: "Vertido accidental",
    7: "Manipulación y almacenamiento",
    8: "Controles de exposición",
    9: "Propiedades físicas y químicas",
    10: "Estabilidad y reactividad",
    11: "Información toxicológica",
    12: "Información ecológica",
    13: "Eliminación de residuos",
    14: "Transporte",
    15: "Reglamentación",
    16: "Otra información",
}


def _doc_score(results: dict) -> float | None:
    secciones = results.get("secciones", [])
    scores = [s["puntaje_porcentual"] for s in secciones if s.get("puntaje_porcentual") is not None]
    return round(sum(scores) / len(scores), 1) if scores else None


@router.get("/", summary="Métricas globales del sistema RAG FDS")
def get_metrics():
    all_audits = audit_store.get_all()

    running = [doc_id for doc_id, v in _audit_cache.items() if v.get("status") == "running"]
    completed = [a for a in all_audits if a["results"].get("status") == "completed"]
    errors = [a for a in all_audits if a["results"].get("status") == "error"]

    section_scores: dict[int, list[float]] = defaultdict(list)
    section_items: dict[int, dict] = defaultdict(lambda: {"presentes": 0, "total": 0})
    item_absence: dict[str, dict] = defaultdict(lambda: {"ausencias": 0, "total": 0})
    total_presentes = 0
    total_items = 0

    for audit in completed:
        for sec in audit["results"].get("secciones", []):
            num = sec.get("seccion")
            if sec.get("puntaje_porcentual") is not None:
                section_scores[num].append(sec["puntaje_porcentual"])
            for item in sec.get("items", []):
                total_items += 1
                section_items[num]["total"] += 1
                item_absence[item["item"]]["total"] += 1
                if item["presencia"] == "Presente":
                    total_presentes += 1
                    section_items[num]["presentes"] += 1
                else:
                    item_absence[item["item"]]["ausencias"] += 1

    por_seccion = []
    for num in range(1, 17):
        scores = section_scores.get(num, [])
        si = section_items.get(num, {"presentes": 0, "total": 0})
        por_seccion.append({
            "seccion": num,
            "nombre": SECTION_NAMES.get(num, f"Sección {num}"),
            "puntaje_promedio": round(sum(scores) / len(scores), 1) if scores else None,
            "tasa_presencia": round(si["presentes"] / si["total"] * 100, 1) if si["total"] > 0 else None,
            "docs_auditados": len(scores),
        })

    all_scores = [s for scores in section_scores.values() for s in scores]
    puntaje_global = round(sum(all_scores) / len(all_scores), 1) if all_scores else None
    tasa_presencia = round(total_presentes / total_items * 100, 1) if total_items > 0 else None

    items_mas_ausentes = sorted(
        [
            {
                "item": item,
                "ausencias": data["ausencias"],
                "total": data["total"],
                "tasa_ausencia": round(data["ausencias"] / data["total"] * 100, 1),
            }
            for item, data in item_absence.items()
            if data["ausencias"] > 0
        ],
        key=lambda x: x["tasa_ausencia"],
        reverse=True,
    )[:10]

    documentos_recientes = sorted(
        [
            {
                "doc_id": a["doc_id"],
                "created_at": a["created_at"],
                "updated_at": a["updated_at"],
                "puntaje_global": _doc_score(a["results"]),
            }
            for a in completed
        ],
        key=lambda x: x["updated_at"] or x["created_at"] or "",
        reverse=True,
    )[:10]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "resumen": {
            "total_auditados": len(completed),
            "con_error": len(errors),
            "corriendo": len(running),
        },
        "calidad": {
            "puntaje_promedio_global": puntaje_global,
            "tasa_presencia_global": tasa_presencia,
            "items_presentes": total_presentes,
            "items_ausentes": total_items - total_presentes,
            "total_items": total_items,
        },
        "por_seccion": por_seccion,
        "documentos_recientes": documentos_recientes,
        "items_mas_ausentes": items_mas_ausentes,
    }
