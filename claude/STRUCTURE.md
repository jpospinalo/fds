# STRUCTURE

## Stack
- Backend: Python/FastAPI + ChromaDB + Azure OpenAI Embeddings + Gemini + boto3 (S3)
- Frontend: React 18 + Vite + TypeScript + react-router-dom + axios
- Infra: AWS S3 (datos) + EC2 (ChromaDB:4000)

## Árbol activo (excluye paths en IGNORE_PATHS.md)

```
rag_fds/
├── .env                        # vars de entorno (no versionado)
├── apps/
│   ├── api_backend/
│   │   ├── main.py             # FastAPI app, CORS, include_router x5
│   │   ├── config.py           # settings desde .env
│   │   ├── routers/
│   │   │   ├── documents.py    # GET  /api/documents/       → lista S3
│   │   │   ├── search.py       # POST /api/search/          → ChromaDB
│   │   │   ├── audit.py        # POST /api/audit/           → LLM-as-Judge
│   │   │   ├── convert.py      # POST /api/convert/
│   │   │   └── pipeline.py     # POST /pipeline/            → disparo manual
│   │   ├── rag_engine/
│   │   │   ├── embeddings.py   # cliente Azure OpenAI
│   │   │   ├── vectorstore.py  # conexión ChromaDB HTTP
│   │   │   └── retriever.py    # buscar_contexto()
│   │   ├── auditor/
│   │   │   ├── sga_auditor_judge.py   # lógica LLM-as-Judge
│   │   │   └── evaluadores/    # rúbricas por sección SGA
│   │   └── schemas/            # modelos Pydantic
│   ├── data_pipeline/
│   │   ├── docling_loader.py   # PDF → Markdown (OCR Docling) → S3 bronze
│   │   ├── silver_runner.py    # bronze → 16 secciones SGA → S3 silver
│   │   ├── extractors.py       # Regex + Gemini fallback para secciones
│   │   ├── splitter.py         # silver → chunks → S3 gold + ChromaDB
│   │   ├── vision_enricher.py  # pictogramas → descripción semántica
│   │   └── sections_config.py  # config de 16 secciones reglamentarias
│   └── frontend/
│       ├── src/                # componentes React
│       ├── vite.config.ts
│       └── package.json
├── data/                       # caché local temporal (no versionado)
│   └── evaluation_reports/     # TXT auditorías (caché rápida)
├── docs/                       # documentación del equipo
│   ├── 01_ONBOARDING.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_API_BACKEND.md
│   ├── 04_FRONTEND.md
│   └── 05_AZURE_EMBEDDINGS.md
├── notebooks/                  # ejecución manual del pipeline
│   ├── docs2bronce.ipynb
│   ├── bronce2silver_seccion[1-16].ipynb
│   └── 01_gold_chunking.ipynb
├── scripts/
│   ├── setup_aws.sh            # IaC: S3 + EC2
│   └── setup_chromadb.sh       # instala ChromaDB en EC2
└── claude/                     # guías para Claude Code
    ├── CLAUDE.md
    ├── STRUCTURE.md            # este archivo
    ├── IGNORE_PATHS.md
    ├── NOTES.md
    └── RULES.md
```

## Flujo de datos (resumen)

```
S3 bronze/docs/ → docling_loader → S3 bronze/processed/
→ silver_runner/extractors    → S3 silver/seccion_{1-16}/
→ splitter                    → S3 gold/chunks/ + ChromaDB
→ API /search/ /audit/        → Frontend
```

## Comandos de arranque

```bash
# Backend
source env/bin/activate
python -m uvicorn api_backend.main:app --reload --port 8000 --host 0.0.0.0 --app-dir apps

# Frontend
cd apps/frontend && npm run dev
```
