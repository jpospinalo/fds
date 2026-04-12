# Arquitectura y Pipeline de Datos

El proyecto `rag_fds` está diseñado bajo una arquitectura Monorepo orientada a dominios y utiliza el patrón de diseño "Medallón" (Medallion Architecture) para el procesamiento de datos estructurados y no estructurados.

## 1. Arquitectura Monorepo

El código base se divide estrictamente en dominios de responsabilidad para aislar los entornos de ejecución y facilitar el desarrollo paralelo:

* **`apps/frontend/`**: Aplicación web SPA (Single Page Application) construida en React y Vite. Maneja la interfaz de usuario y la visualización de reportes.
* **`apps/api_backend/`**: Motor central del sistema. Expone la API REST mediante FastAPI, gestiona el ruteo, el sistema RAG (ChromaDB + Azure Embeddings) y el Juez Evaluador (LLM-as-a-Judge).
* **`apps/data_pipeline/`**: Scripts y utilidades de ingeniería de datos encargados de la ingesta, limpieza y vectorización de documentos.
* **`data/`**: Directorio de almacenamiento local **para caché y workspace temporal ÚNICAMENTE**. Excluido del control de versiones. Se limpiar después de procesar.
* **`scripts/`**: Automatismos de Infraestructura como Código (IaC) en bash para AWS.
* **`docs/`**: Documentación oficial del equipo.

## 2. Pipeline Medallón (Procesamiento de Documentos)

El procesamiento de las Fichas de Datos de Seguridad (FDS) en formato PDF es un proceso intensivo que se ejecuta en tres fases secuenciales. **TODOS LOS DATOS FINALES SE ALMACENAN EN AWS S3, no localmente.**

### Fase 1: Capa Bronce (Ingesta y Extracción Cruda)
**Objetivo:** Convertir el PDF estático en un formato estructurado sin pérdida de información.

* **Entrada:** PDFs se descargan desde S3 (`s3://bucket/bronze/docs/`) a directorio temporal local.
* Se utiliza **Docling** para realizar un OCR avanzado y análisis de diseño (Layout Analysis).
* **Proceso Intermedio:** Se almacena temporalmente en `data/bronze/processed/` mientras se procesa.
* **Salida DEFINITIVA:** Se carga a AWS S3 en ruta `s3://bucket/bronze/processed/{doc_id}/` en formato JSON.
* **Limpieza:** Los archivos locales temporales se eliminan tras subir a S3.

**Código:** `apps/data_pipeline/docling_loader.py`

### Fase 2: Capa Plata (Limpieza, Estructuración y Multimodalidad)
**Objetivo:** Limpiar el ruido del OCR, unificar el formato y extraer elementos visuales.

* **Entrada:** Se lee el Markdown procesado desde S3 (Capa Bronce).
* **Texto:** Se aplican reglas de expresiones regulares (Regex) para identificar y separar las 16 secciones reglamentarias del SGA. Si la extracción falla, interviene un modelo de LLM ligero (Gemini) como "fallback".
* **Imágenes:** Se extraen pictogramas y rombos de seguridad, utilizando un modelo multimodal para traducir estas imágenes a descripciones semánticas.
* **Proceso Intermedio:** Se generan archivos JSONL en memoria.
* **Salida DEFINITIVA:** Se cargan directamente a AWS S3 en rutas `s3://bucket/silver/seccion_{1-16}/{doc_id}.jsonl` (no se almacenan localmente).

**Código:** `apps/data_pipeline/silver_runner.py`, `apps/data_pipeline/extractors.py`

### Fase 3: Capa Oro (Vectorización y Chunking Semántico)
**Objetivo:** Preparar los datos para la recuperación rápida (Retrieval) en el motor RAG.

* **Entrada:** Se leen las secciones desde S3 (Capa Plata).
* **Chunking Semántico:** El texto se divide en fragmentos lógicos respetando títulos y jerarquías, inyectando metadatos (ID del documento y número de sección).
* **Almacenamiento Intermedio:** Se generan archivos JSONL en S3 bajo `s3://bucket/gold/chunks/{doc_id}_chunks.jsonl`.
* **Vectorización:** Los fragmentos se transforman en vectores multidimensionales utilizando el modelo de embeddings de Azure OpenAI.
* **Salida DEFINITIVA:** Los vectores se insertan en la base de datos **ChromaDB remota** (servidor HTTP en EC2).
* **Metadatos:** Se conservan en la base vectorial para filtrado semántico durante las búsquedas.

**Código:** `apps/data_pipeline/splitter.py`

## 3. Flujo Datos Extendido: API Backend + Retrieval

### Lectura desde el API Backend:

1. **Endpoint `/documents/`**: Escanea S3 para listar documentos disponibles
   - Lee metadatos de `s3://bucket/gold/chunks/` (lista de doc_ids)
   - Lee secciones disponibles desde `s3://bucket/silver/seccion_X/`

2. **Endpoint `/search/`**: Búsqueda semántica
   - Conecta a ChromaDB remoto en EC2 (`CHROMA_SERVER_HOST:CHROMA_SERVER_PORT`)
   - Realiza búsqueda vectorial sobre embeddings previamente ingestados
   - Retorna fragmentos relevantes con metadatos

3. **Endpoint `/audit/`**: Evaluación LLM-as-a-Judge
   - Recupera fragmentos desde ChromaDB usando `buscar_contexto()`
   - Ejecuta el auditor (`sga_auditor_judge.py`) contra el documento
   - Genera reporte TXT en `data/evaluation_reports/{doc_id}.txt` (caché local)
   - Parseado a CSV para visualización en frontend
   - El TXT se almacena localmente solo para descargas rápidas

## 4. Arquitectura de Almacenamiento

```
┌─────────────────────────────────────────────────────────────────┐
│                      AWS S3 (Almacenamiento Definitivo)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  s3://bucket/                                                   │
│  ├── bronze/processed/{doc_id}/          (Capa Bronce)         │
│  │   └── {doc_id}.md                                            │
│  │                                                              │
│  ├── silver/seccion_{1-16}/ (Capa Plata - 16 secciones SGA)   │
│  │   ├── {doc_id}.jsonl                                        │
│  │   └── ...                                                   │
│  │                                                              │
│  └── gold/chunks/              (Capa Oro - Chunks Vectorizados)│
│      └── {doc_id}_chunks.jsonl                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ChromaDB (EC2 Remoto) - Motor RAG Vectorial                   │
│  Host: CHROMA_SERVER_HOST                                       │
│  Port: CHROMA_SERVER_PORT                                       │
│  Collection: "fds_quimicos"                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│             API Backend (FastAPI)                               │
├─────────────────────────────────────────────────────────────────┤
│  • /documents/             (metadatos desde S3)                │
│  • /search/                (consultas ChromaDB)                │
│  • /audit/                 (LLM-as-a-Judge → caché local)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│             Frontend (React + Vite)                             │
│  • Visualización de reportes                                   │
│  • Búsqueda semántica                                          │
│  • Descarga de auditorías                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Almacenamiento Local (Solo Temporal)

```
data/
├── bronze/processed/        ← Archivos intermedios (se limpian)
├── silver/                  ← NO SE USA LOCALMENTE (solo S3)
├── gold/                    ← NO SE USA LOCALMENTE (solo S3)
├── evaluation_reports/      ← CACHÉ: Reportes TXT para descargas rápidas
└── temp/                    ← Workspace temporal de procesamiento
```

**Importante:** `data/` debe estar en `.gitignore`. Su contenido es temporal y se regenera en cada ejecución del pipeline.

## 6. Configuración de Variables de Entorno

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

## 7. Consideraciones de Arquitectura (Estado Actual)

*Implementado:**
* Pipeline medallón en 3 capas (Bronze → Silver → Gold)
* Almacenamiento definitivo en AWS S3
* ChromaDB remoto para búsqueda vectorial
* API REST con FastAPI para lectura de datos
* Sistema LLM-as-a-Judge para auditoría automática

**Limitaciones Actuales (Trabajo en Progreso):**
* **Ejecución Manual:** El pipeline se ejecuta manualmente desde Jupyter Notebooks (`/notebooks/`) ubicados en `bronce2silver_seccion*.ipynb` y `01_gold_chunking.ipynb`. No hay integración automática ni mensajería asíncrona.
* **Upload de Archivos:** El frontend no implementa carga de PDFs. Los PDFs deben estar en S3 previamente.
* **Sin APIs de Disparo:** No existen endpoints REST para disparar el pipeline desde la API. Los comandos se ejecutan manualmente.
* **Caché Local:** Los reportes de auditoría se guardan localmente en `data/evaluation_reports/` para descargas rápidas, pero deberían migrarse a S3 en futuras versiones.

## 8. Flujo de Ejecución Actual

```
1. Desarrollador coloca PDF en S3 (s3://bucket/docs/)
                    ↓
2. Ejecuta Notebook: bronce2silver_seccion1.ipynb → docling_loader.py
   - Descarga PDF a local temp
   - Procesa con Docling
   - Sube resultado a s3://bucket/bronze/processed/
                    ↓
3. Ejecuta Notebook: bronce2silver_seccionX.ipynb → silver_runner.py
   - Lee desde S3 (Bronce)
   - Extrae 16 secciones (Regex + LLM fallback)
   - Sube a s3://bucket/silver/seccion_X/
                    ↓
4. Ejecuta Notebook: 01_gold_chunking.ipynb → splitter.py
   - Agrega secciones desde S3 (Plata)
   - Chunking semántico
   - Sube a s3://bucket/gold/chunks/
   - Ingesta vectores en ChromaDB (EC2)
                    ↓
5. Frontend/API ya pueden consultar docentes disponibles y realizar búsquedas
```

## 9. Próximos Pasos Recomendados

1. **Automatización:** Crear lambdas de AWS o Airflow DAGs para ejecutar el pipeline automáticamente.
2. **Upload de Archivos:** Implementar endpoint POST `/upload/` en API backend que coloque PDFs en S3 y dispare el pipeline.
3. **Monitoreo:** Implementar logging centralizado y health checks para el pipeline.
4. **Persistencia de Reportes:** Mover auditorías a S3 en lugar de local (actualmente caché).
5. **Escalabilidad:** Cambiar notebooks a scripts Python ejecutables con argumentos CLI.
