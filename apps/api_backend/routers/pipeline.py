import os
import re
import sys
import json
import time
import uuid
import shutil
import tempfile
from pathlib import Path
from typing import Dict
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

router = APIRouter(prefix="/pipeline", tags=["Pipeline completo"])

# Estado en memoria (usa Redis en producción)
_jobs: Dict[str, dict] = {}

TEMP_DIR = ROOT / "data" / "temp_uploads"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def _update_job(job_id: str, **kwargs):
    _jobs[job_id] = {**_jobs.get(job_id, {}), **kwargs}


def _run_pipeline(job_id: str, pdf_path: str, doc_id: str):
    try:
        # ── Fase 1: Docling → Markdown ──────────────────────────────
        _update_job(job_id, step="docling", progress=10, status="running",
                    message="Extrayendo estructura del PDF con Docling…")

        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions

        opts = PdfPipelineOptions()
        opts.generate_picture_images = False
        converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
        )
        result = converter.convert(pdf_path)
        markdown_text = result.document.export_to_markdown()
        _update_job(job_id, progress=30, message="Markdown generado. Extrayendo secciones…")

        # ── Fase 2: Extracción de las 16 secciones ──────────────────
        secciones_extraidas = {}
        PATRONES = {
            1:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?1[\.\-\:]?\s*(?:IDENTIFICACI[OÓ]N).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?2[\.\-\:]?"),
            2:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?2[\.\-\:]?\s*(?:IDENTIFICACI[OÓ]N.*PELIGRO|PELIGRO).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?3[\.\-\:]?"),
            3:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?3[\.\-\:]?\s*(?:COMPOSICI[OÓ]N).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?4[\.\-\:]?"),
            4:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?4[\.\-\:]?\s*(?:PRIMEROS\s*AUXILIOS).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?5[\.\-\:]?"),
            5:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?5[\.\-\:]?\s*(?:LUCHA\s*CONTRA\s*INCENDIOS|INCENDIOS).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?6[\.\-\:]?"),
            6:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?6[\.\-\:]?\s*(?:VERTIDO).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?7[\.\-\:]?"),
            7:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?7[\.\-\:]?\s*(?:MANIPULACI[OÓ]N).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?8[\.\-\:]?"),
            8:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?8[\.\-\:]?\s*(?:CONTROLES\s*DE\s*EXPOSICI[OÓ]N).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?9[\.\-\:]?"),
            9:  (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?9[\.\-\:]?\s*(?:PROPIEDADES).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?10[\.\-\:]?"),
            10: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?10[\.\-\:]?\s*(?:ESTABILIDAD).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?11[\.\-\:]?"),
            11: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?11[\.\-\:]?\s*(?:TOXICOL).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?12[\.\-\:]?"),
            12: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?12[\.\-\:]?\s*(?:ECOL[OÓ]G|ECOTOX).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?13[\.\-\:]?"),
            13: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?13[\.\-\:]?\s*(?:ELIMINACI[OÓ]N).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?14[\.\-\:]?"),
            14: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?14[\.\-\:]?\s*(?:TRANSPORTE).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?15[\.\-\:]?"),
            15: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?15[\.\-\:]?\s*(?:REGLAMENTARI).*$",
                 r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?16[\.\-\:]?"),
            16: (r"(?im)^#*\s*(?:SECCI[OÓ]N\s*)?16[\.\-\:]?\s*(?:OTRA\s*INFORMACI[OÓ]N|OTRAS\s*INFORMACIONES).*$",
                 r"\Z"),
        }

        for num, (pat_ini, pat_fin) in PATRONES.items():
            _update_job(job_id, progress=30 + num * 3,
                        message=f"Extrayendo sección {num}/16…")
            m_ini = re.search(pat_ini, markdown_text, re.IGNORECASE | re.DOTALL)
            if not m_ini:
                secciones_extraidas[num] = None
                continue
            m_fin = re.search(pat_fin, markdown_text[m_ini.start():], re.IGNORECASE | re.DOTALL)
            fin = m_ini.start() + m_fin.start() if m_fin else len(markdown_text)
            texto = markdown_text[m_ini.start(): fin].strip()
            secciones_extraidas[num] = texto if len(texto) > 30 else None

        secciones_encontradas = sum(1 for v in secciones_extraidas.values() if v)
        _update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"Listo. {secciones_encontradas}/16 secciones encontradas.",
            doc_id=doc_id,
            markdown=markdown_text,
            secciones=secciones_extraidas,
            secciones_encontradas=secciones_encontradas,
        )

    except Exception as e:
        _update_job(job_id, status="error", message=str(e), progress=0)
    finally:
        try:
            os.remove(pdf_path)
        except Exception:
            pass


@router.post("/upload", summary="Subir PDF y procesar pipeline completo")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se aceptan archivos PDF")

    job_id = str(uuid.uuid4())
    doc_id = Path(file.filename).stem

    # Guardar archivo
    dest = TEMP_DIR / f"{job_id}.pdf"
    content = await file.read()
    dest.write_bytes(content)

    _update_job(job_id, status="running", progress=5, doc_id=doc_id,
                message="Archivo recibido. Iniciando pipeline…")

    background_tasks.add_task(_run_pipeline, job_id, str(dest), doc_id)
    return {"job_id": job_id, "doc_id": doc_id, "status": "running"}


@router.get("/{job_id}/status", summary="Estado del job de procesamiento")
def job_status(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Job no encontrado")
    return _jobs[job_id]