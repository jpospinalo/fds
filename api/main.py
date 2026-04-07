import sys
from pathlib import Path

# Agregar raíz del proyecto al path para importar src/
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import documents, search, audit, convert

app = FastAPI(
    title="RAG FDS/SGA API",
    description="API para consulta semántica y auditoría automática de Fichas de Datos de Seguridad",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: permite llamadas desde el frontend Vite (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(search.router)
app.include_router(audit.router)
app.include_router(convert.router)


@app.get("/health", tags=["Estado"])
def health():
    return {"status": "ok", "service": "RAG FDS API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)