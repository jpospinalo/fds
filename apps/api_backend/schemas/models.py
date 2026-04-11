from typing import Any, Dict, List, Optional

from pydantic import BaseModel

# ── Búsqueda ──────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None
    num_seccion: Optional[int] = None
    top_k: int = 5

class SearchResult(BaseModel):
    texto: str
    metadatos: Dict[str, Any]

class SearchResponse(BaseModel):
    query: str
    resultados: List[SearchResult]
    total: int

# ── Documentos ────────────────────────────────────────────────
class DocumentInfo(BaseModel):
    doc_id: str
    secciones_disponibles: List[int]
    total_chunks: int

# ── Auditoría ─────────────────────────────────────────────────
class AuditRequest(BaseModel):
    doc_id: str

class AuditItemResult(BaseModel):
    item: str
    calidad: str          # Confiable | Conf_CR | NO_Conf
    presencia: str        # Presente | No_Presente
    observaciones: Optional[str] = None

class AuditSectionResult(BaseModel):
    seccion: int
    puntaje_bruto: Optional[float] = None
    puntaje_porcentual: Optional[float] = None
    items: List[AuditItemResult]
    raw_text: str

class AuditResponse(BaseModel):
    doc_id: str
    status: str           # completed | running | error
    secciones: List[AuditSectionResult]
    reporte_txt: Optional[str] = None

# ── Conversión ────────────────────────────────────────────────
class ConvertRequest(BaseModel):
    texto: str
    nombre_archivo: Optional[str] = "documento"

class ConvertResponse(BaseModel):
    markdown: str
    nombre_archivo: str