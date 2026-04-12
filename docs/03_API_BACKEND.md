# Backend API y Motor RAG

El dominio `apps/api_backend/` es el **núcleo transaccional e inteligente** de la plataforma `rag_fds`. Está construido sobre **FastAPI** y tiene tres responsabilidades principales:

1. **Exponer la interfaz RESTful** para interactuar con los datos.
2. **Gestionar el Motor RAG** (Retrieval-Augmented Generation) mediante ChromaDB.
3. **Ejecutar el Auditor Inteligente** (LLM-as-a-Judge) para evaluar el cumplimiento normativo.

## 1. Estructura del Dominio

```text
apps/api_backend/
├── config.py                 # "GPS" del proyecto (rutas relativas absolutas)
├── main.py                   # Punto de entrada de FastAPI
├── requirements_api.txt      # Dependencias exclusivas del backend
│
├── routers/                  # Controladores REST (Endpoints)
│   ├── audit.py              # Dispara la evaluación LLM e ingesta en caché local
│   ├── documents.py          # Lista archivos procesados desde S3
│   └── search.py             # Consultas semánticas en ChromaDB
│
├── schemas/                  # Modelos Pydantic (Validación de entrada/salida)
│   └── models.py             # SearchRequest, AuditResponse, DocumentMetadata, etc.
│
├── rag_engine/               # Lógica de Búsqueda Vectorial
│   ├── embeddings.py         # Genera embeddings con Azure OpenAI
│   ├── retriever.py          # Lógica búsqueda k-NN con filtros de metadatos
│   └── vectorstore.py        # Cliente HTTP de ChromaDB remoto (EC2)
│
└── auditor/                  # Motor de Evaluación (LLM-as-a-Judge)
    ├── sga_auditor_judge.py  # Script principal: recupera contexto → evalúa con Gemini
    └── evaluadores/          # Recursos de evaluación
        ├── diccionario_items.csv         # Reglas de negocio: ID, descripción de ítems
        └── instrumento-seccion-X.md      # Plantillas de prompts por sección
```

## 2. Configuración Centralizada (config.py)

El archivo `config.py` es el "GPS" del proyecto: centraliza todas las rutas relativas, credenciales y configuración.

```python
class Config:
    # Rutas Locales
    ROOT_DIR = Path(__file__).resolve().parent.parent
    DATA_DIR = ROOT_DIR / "data"
    
    # S3 - Almacenamiento Definitivo
    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
    S3_PREFIX_BRONCE = "bronze/processed/"
    S3_PREFIX_SILVER = "silver/"
    S3_PREFIX_GOLD = "gold/"
    S3_PREFIX_QUARANTINE = "Quarantine/"
    
    # ChromaDB Remoto (EC2)
    CHROMA_SERVER_HOST = os.getenv("CHROMA_SERVER_HOST")
    CHROMA_SERVER_PORT = os.getenv("CHROMA_SERVER_PORT")
    CHROMA_COLLECTION_NAME = "fds_quimicos"
    
    # Azure OpenAI (Embeddings)
    AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
    AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT = os.getenv("...")
    
    # Google Gemini (LLM Juez)
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
```

**Importante:** La configuración se carga desde `.env` al inicio. Si las credenciales no están disponibles, se muestra una advertencia.

## 3. Motor RAG (Retrieval-Augmented Generation)

### 3.1 Caso de Uso: Búsqueda Semántica

El usuario realiza una consulta en lenguaje natural → El sistema busca fragmentos relevantes en ChromaDB → Se retornan contextos enriquecidos con metadatos.

**Flujo:**

```
POST /search/
{
  "query": "¿Dónde están los pictogramas de peligro?",
  "doc_id": "FDS_21",           (opcional)
  "num_seccion": 3,               (opcional)
  "top_k": 5
}
        ↓
retriever.py → buscar_contexto()
        ↓
conecta a ChromaDB (EC2)
        ↓
Aplica filtros metadatos:
├─ Si doc_id: {"doc_id": "FDS_21"}
├─ Si num_seccion: {seccion: 3}
└─ Si ambos: {"$and": [{"doc_id": ...}, {"seccion": ...}]}
        ↓
Búsqueda de similitud vectorial (top-k=5)
        ↓
Retorna fragmentos + metadatos:
[
  {
    "texto": "Los pictogramas de peligro deben...",
    "metadatos": {
      "doc_id": "FDS_21",
      "seccion": 3,
      "chunk_id": "FDS_21_3_chunk_5"
    }
  },
  ...
]
        ↓
Frontend renderiza resultados
```

### 3.2 Arquitectura del Motor RAG

#### vectorstore.py - Conexión a ChromaDB

```python
def obtener_base_vectorial(embeddings_model):
    """Se conecta al servidor HTTP remoto de ChromaDB."""
    chroma_client = chromadb.HttpClient(
        host=Config.CHROMA_SERVER_HOST,
        port=Config.CHROMA_SERVER_PORT
    )
    
    return Chroma(
        client=chroma_client,
        collection_name=Config.CHROMA_COLLECTION_NAME,
        embedding_function=embeddings_model
    )
```

**Nota:** ChromaDB corre en un servidor HTTP remoto (EC2), no localmente. La conexión es stateless.

#### embeddings.py - Generación de Embeddings

Utiliza **Azure OpenAI** para generar embeddings de dimensión 1536 (text-embedding-3-small).

```python
def obtener_modelo_embeddings():
    return AzureOpenAIEmbeddings(
        api_key=Config.AZURE_OPENAI_API_KEY,
        azure_endpoint=Config.AZURE_OPENAI_ENDPOINT,
        api_version=Config.AZURE_OPENAI_API_VERSION,
        model=Config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT
    )
```

#### retriever.py - Lógica de Recuperación

```python
def buscar_contexto(
    query: str,
    doc_id: Optional[str] = None,
    num_seccion: Optional[int] = None,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Búsqueda híbrida: similitud vectorial + filtros de metadatos.
    """
    vector_db = obtener_motor_busqueda()
    
    # Construir filtro dinámico
    filtro_metadata = {}
    if doc_id:
        filtro_metadata["doc_id"] = doc_id
    if num_seccion is not None:
        filtro_metadata["seccion"] = num_seccion
    
    # Búsqueda de similitud
    resultados = vector_db.similarity_search(
        query=query,
        k=top_k,
        filter=filtro_metadata if filtro_metadata else None
    )
    
    # Formatear salida
    return [
        {
            "texto": doc.page_content,
            "metadatos": doc.metadata
        }
        for doc in resultados
    ]
```

**Estrategia de Filtrado:**
- Si se especifica `doc_id`, busca solo en ese documento.
- Si se especifica `num_seccion`, busca solo en esa sección del SGA.
- Si se especifican ambos, aplica un filtro AND (ChromaDB requiere sintaxis `{"$and": [...]}`).

---

## 4. Auditor Inteligente (LLM-as-a-Judge)

### 4.1 Caso de Uso: Evaluación de Cumplimiento Normativo

El sistema evalúa automáticamente si un FDS cumple con los requisitos regulatorios del SGA, sección por sección.

**Flujo:**

```
POST /audit/{doc_id}
        ↓
sga_auditor_judge.py (inspeccionar_documento_texto)
        ↓
Para cada sección de SGA (1, 3, 4, 5, 6):
  ├─ Leer CSV diccionario_items.csv
  ├─ Filtrar ítems de la sección (ID: "2_1", "2_2", etc.)
  ├─ Construir lista de requerimientos
  ├─ buscar_contexto(query=f"Sección {num}", doc_id, top_k=10)
  ├─ Hacer prompt al Gemini LLM:
  │  "¿Cumple con los siguientes ítems? [lista]"
  │  Contexto recuperado: [fragmentos]
  ├─ Parsear respuesta LLM (presente/ausente, confiable/no-confiable)
  └─ Guardar resultado
        ↓
Generar reporte:
  └─ Checklist_SGA_{doc_id}.txt
        ↓
audit.py (_parse_audit_report):
  ├─ Parsea TXT → CSV
  └─ Retorna AuditResponse con:
      ├─ reporte_txt (bruto)
      ├─ reporte_csv (tabular)
      └─ status: completed / error
        ↓
Frontend renderiza tabla + permite descargar
```

### 4.2 Arquitectura del Auditor

#### sga_auditor_judge.py - Motor Principal

```python
def obtener_llm_inspector():
    """Inicializa Gemini en modo estricto."""
    return ChatGoogleGenerativeAI(
        model="gemini-pro",
        google_api_key=Config.GOOGLE_API_KEY,
        temperature=0,  # Modo determinista
        # ... strict mode parameters
    )

def inspeccionar_documento_texto(doc_id: str):
    """
    Principal orchestrator:
    1. Lee diccionario de ítems
    2. Para cada sección, recupera contexto
    3. LLM juzga cumplimiento
    4. Genera reporte TXT
    """
    llm = obtener_llm_inspector()
    
    # Leer diccionario
    df_diccionario = pd.read_csv(
        Path(__file__).resolve().parent / "evaluadores" / "diccionario_items.csv"
    )
    
    # Para cada sección...
    for num_seccion in [1, 3, 4, 5, 6]:
        # Filtrar ítems: ID que empiezan con "num_seccion_"
        items = df_diccionario[
            df_diccionario['id'].str.match(rf"^{num_seccion}_[1-9]")
        ]
        
        # Recuperar contexto
        fragmentos = buscar_contexto(
            query=f"Contenido sección {num_seccion}",
            doc_id=doc_id,
            num_seccion=num_seccion,
            top_k=10
        )
        
        # Construir prompt
        prompt = f"""
        Evalúa si el siguiente documento cumple con estos ítems:
        {items_description}
        
        Contexto del documento:
        {fragmentos_text}
        
        Responde en formato YAML estructurado.
        """
        
        # LLM Juzga
        respuesta_llm = llm.invoke(prompt)
        
        # Parsear y guardar
        resultados[num_seccion] = parse_respuesta(respuesta_llm)
    
    # Generar reporte TXT
    generar_reporte_txt(resultados, doc_id)
```

#### diccionario_items.csv - Reglas de Negocio

Estructura recomendada:

```csv
id,descripcion,secciones_asociadas
1_1,Denominación del producto químico,1
1_2,Sinónimos del producto,1
2_1,Pictogramas de peligro,2
2_2,Rombos de seguridad,2
3_1,Precauciones,3
...
```

Cada ítem tiene un ID único (`seccion_numero`) y una descripción que el LLM debe validar.

---

## 5. Endpoints REST

### 5.1 Listado de Documentos

```http
GET /documents/
```

**Responsabilidad:** Escanear S3 y retornar lista de documentos procesados.

**Respuesta:**

```json
[
  {
    "doc_id": "FDS_21",
    "secciones_disponibles": [1, 3, 4, 5, 6],
    "total_chunks": 145
  },
  {
    "doc_id": "FDS_Esmalte",
    "secciones_disponibles": [1, 2, 3, 4, 5, 6],
    "total_chunks": 189
  }
]
```

**Lógica (documents.py):**
- Pagina sobre S3 con prefix `GOLD_PREFIX` (chunks/) para contar archivos
- Pagina sobre S3 con prefix `SILVER_PREFIX` para listar secciones por doc_id
- Agrega y retorna

### 5.2 Contenido de una Sección

```http
GET /documents/{doc_id}/section/{num_seccion}
```

**Responsabilidad:** Retornar el texto completo de una sección específica.

**Ejemplo:** `GET /documents/FDS_21/section/3`

**Respuesta:**

```json
{
  "doc_id": "FDS_21",
  "num_seccion": 3,
  "contenido": "Composición / Información sobre los componentes...",
  "total_items": 5,
  "fuente": "s3://bucket/silver/seccion_3/FDS_21.jsonl"
}
```

### 5.3 Búsqueda Semántica

```http
POST /search/
Content-Type: application/json

{
  "query": "¿Cuáles son los pictogramas de seguridad?",
  "doc_id": "FDS_21",           (opcional)
  "num_seccion": 2,              (opcional)
  "top_k": 5                     (default: 5)
}
```

**Respuesta:**

```json
{
  "query": "¿Cuáles son los pictogramas de seguridad?",
  "resultados": [
    {
      "texto": "Los pictogramas de GHS incluyen...",
      "metadatos": {
        "doc_id": "FDS_21",
        "seccion": 2,
        "chunk_id": "FDS_21_2_chunk_3"
      }
    },
    ...
  ],
  "total": 5
}
```

**Flujo Interno (search.py):**
1. Valida `SearchRequest` con Pydantic
2. Llama a `buscar_contexto()` con filtros
3. Formatea respuesta como `SearchResponse`

### 5.4 Disparar Auditoría

```http
POST /audit/
Content-Type: application/json

{
  "doc_id": "FDS_21"
}
```

**Respuesta (inmediata):**

```json
{
  "doc_id": "FDS_21",
  "status": "running",
  "message": "Auditoría iniciada en background"
}
```

**Flujyo (audit.py):**
1. Valida que el doc_id existe en S3
2. Dispara `sga_auditor_judge.inspeccionar_documento_texto(doc_id)` en task background
3. Retorna inmediatamente (no espera)

### 5.5 Obtener Resultados de Auditoría

```http
GET /audit/{doc_id}/results
```

**Respuesta (cuando está listo):**

```json
{
  "doc_id": "FDS_21",
  "status": "completed",
  "fecha_auditoria": "2024-04-12T10:30:00Z",
  "reporte_txt": "[CHECKLIST_SGA]...",
  "reporte_csv": "Sección,Ítem,Presencia,Calidad,Observaciones\n1,1_1,Presente,Confiable,...",
  "metricas": {
    "porcentaje_cumplimiento": 85.5,
    "total_confiables": 34,
    "total_presentes": 40,
    "total_secciones": 6
  }
}
```

**Lógica (audit.py):**
1. Busca archivo caché: `data/evaluation_reports/Checklist_SGA_{doc_id}.txt`
2. Si existe, parsea TXT → genera CSV → retorna `AuditResponse`
3. Si no existe y no hay task en background: 404
4. Si hay task en background: retorna `status: running`

---

## 6. Modelos Pydantic (schemas/models.py)

```python
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

class AuditResponse(BaseModel):
    doc_id: str
    status: str  # "running" | "completed" | "error"
    reporte_txt: Optional[str] = None
    reporte_csv: Optional[str] = None
    metricas: Optional[Dict[str, Any]] = None

class DocumentMetadata(BaseModel):
    doc_id: str
    secciones_disponibles: List[int]
    total_chunks: int
```

---

## 7. Configuración CORS y Seguridad

### main.py - Punto de Entrada

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RAG FDS API")

# CORS: Permite origen frontend Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",     # Vite dev
        "http://localhost:3000"      # Alternativo
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(audit.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

**Consideraciones Actuales:**
- ✅ CORS habilitado para desarrollo
- ⚠️ Sin autenticación (todos endpoints públicos)
- ⚠️ Sin rate limiting
- ⚠️ Sin validación de permisos por documento

---

## 8. Flujo de Datos Completo (E2E)

        ```
                    ┌─────────────────────────────────────────┐
                    │        Frontend (React + Vite)          │
                    │  - Interfaz de búsqueda                 │
                    │  - Selector de documentos               │
                    │  - Tabla de auditoría                   │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │         API Backend (FastAPI)           │
                    │                                         │
                    │  ┌────────────┬────────────┬──────────┐ │
                    │  │ Documents  │  Search    │  Audit   │ │
                    │  │ Router     │  Router    │  Router  │ │
                    │  └─────┬──────┴─────┬──────┴────┬─────┘ │
                    │        │            │           │       │
                    │        └────────────┼───────────┘       │
                    │                     │                   │
                    │        ┌────────────▼────────────┐      │
                    │        │   Servicios Internos    │      │
                    │        └────────────┬────────────┘      │
                    └─────────────────────┼───────────────────┘
                                          │
                  ┌───────────────────────┼──────────────────────────┐
                  │                       │                          │
            ┌─────▼──────────┐    ┌───────▼─────────┐        ┌───────▼─────────┐
            │   RAG Engine   │    │    Auditor      │        │ Config & Creds  │
            ├────────────────┤    ├─────────────────┤        ├─────────────────┤
            │ vectorstore.py │    │ sga_auditor.py  │        │ config.py       │
            │ embeddings.py  │    │ evaluadores/    │        │ S3 credentials  │
            │ retriever.py   │    │                 │        │ ChromaDB conn   │
            └─────┬──────────┘    └─────┬───────────┘        │ Azure OpenAI    │
                  │                     │                    │ Google Gemini   │
                  │                     │                    └─────────────────┘
                  │                     │
            ┌─────▼──────────┐  ┌───────▼───────────┐
            │   ChromaDB     │  │ Google Gemini     │
            │   (EC2)        │  │ (LLM-as-a-Judge)  │
            │   HTTP Client  │  │                   │
            └─────┬──────────┘  └───────────────────┘
                  │
            ┌─────▼────────────────────────────────────┐
            │        AWS S3 (Almacenamiento)           │
            ├──────────────────────────────────────────┤
            │ s3://bucket/                             │
            │  ├─ bronze/processed/                    │
            │  ├─ silver/seccion_X/                    │
            │  └─ gold/chunks/                         │
            └──────────────────────────────────────────┘
```

---

## 9. Consideraciones de Producción

**Siguiente a Implementar:**

1. **Autenticación:** Implementar JWT o AWS Cognito
2. **Rate Limiting:** Proteger endpoints de abuso
3. **Logging Centralizado:** CloudWatch o similar
4. **Cache Distribuido:** Redis para resultados frecuentes
5. **Validación de Parámetros:** Sanitizar entrada de usuarios
6. **Health Checks:** Monitoreo de ChromaDB y S3
7. **Timeouts:** Configurar timeouts en llamadas a ChromaDB y Gemini
8. **Persistencia de Auditorías:** Mover de local a S3

---

## 10. Variables de Entorno Requeridas

En `.env`:

```env
# Credenciales de AWS
AWS_ACCESS_KEY_ID=tu_access_key_aqui
AWS_SECRET_ACCESS_KEY=tu_secret_key_aqui
AWS_SESSION_TOKEN=tu_token_key_aqui
AWS_REGION=us-east-1

# Credenciales LLM
GEMINI_API_KEY=tu_api_key_aqui

# Configuración del Bucket y Rutas (Arquitectura Medallón)
S3_BUCKET_NAME=tu_bucket_aqui
S3_PREFIX_DOCS=bronze/docs/
S3_PREFIX_BRONCE=bronze/processed/
S3_PREFIX_SILVER=silver/
S3_PREFIX_GOLD=gold/
S3_PREFIX_QUARANTINE=Quarantine/

# Azure OpenAI
# Consulta ./docs/05_AZURE_EMBEDDINGS.md para obtener estos valores
AZURE_OPENAI_API_KEY=tu_api_key_aqui
AZURE_OPENAI_ENDPOINT=tu_end_point_aqui
AZURE_OPENAI_API_VERSION=tu_version_aqui
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=tu_modelo_aqui

# CHROMA KEYS
CHROMA_SERVER_HOST=IP_del_servidor
CHROMA_SERVER_PORT=4000
```

---

## 11. Ejecución Local

```bash
# 1. Instalar dependencias
cd apps/api_backend
pip install -r requirements_api.txt

# 2. Cargar variables de entorno
export $(cat .env | xargs)

# 3. Iniciar servidor
python -m uvicorn api_backend.main:app --reload --port 8000 --host 0.0.0.0 --app-dir apps

# 4. Acceder a documentación interactiva
# http://localhost:8000/docs
```
