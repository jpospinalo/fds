import sys
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException

# Aseguramos que el path de src/ sea visible desde api/
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.schemas.models import SearchRequest, SearchResponse, SearchResult
from src.backend.retriever import buscar_contexto

router = APIRouter(prefix="/search", tags=["Búsqueda semántica"])


@router.post("/", response_model=SearchResponse, summary="Búsqueda semántica en ChromaDB")
def semantic_search(req: SearchRequest):
    """
    Realiza una búsqueda híbrida (semántica + filtros de metadatos).
    - query: pregunta en lenguaje natural
    - doc_id: (opcional) filtrar por documento específico
    - num_seccion: (opcional) filtrar por número de sección SGA
    - top_k: número de resultados (default 5)
    """
    try:
        fragmentos = buscar_contexto(
            query=req.query,
            doc_id=req.doc_id,
            num_seccion=req.num_seccion,
            top_k=req.top_k,
        )
        resultados = [SearchResult(**f) for f in fragmentos]
        return SearchResponse(
            query=req.query,
            resultados=resultados,
            total=len(resultados),
        )
    except Exception as e:
        raise HTTPException(500, f"Error en búsqueda vectorial: {e}")