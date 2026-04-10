# Plataforma de Auditoría Inteligente SGA (RAG-as-a-Judge)

Plataforma Full-Stack impulsada por Inteligencia Artificial para la ingesta, vectorización y auditoría automática de Fichas de Datos de Seguridad (FDS) bajo la normativa del Sistema Globalmente Armonizado (SGA). 

Este sistema utiliza una arquitectura **RAG (Retrieval-Augmented Generation)** combinada con el patrón **LLM-as-a-Judge** para verificar la presencia de requerimientos normativos en documentos químicos complejos.

---

## Estado Actual de Desarrollo

**Limitación Conocida (En progreso):** Actualmente, el motor de procesamiento y evaluación funciona de manera óptima, pero **la subida de archivos (Upload) desde el Frontend hacia el Backend se encuentra deshabilitada**. 

Por el momento, el sistema opera con documentos pre-cargados. Para auditar una nueva FDS, el archivo PDF debe colocarse manualmente en el directorio del entorno local antes de ejecutar el pipeline de datos. La conexión asíncrona para la recepción segura de archivos pesados está planificada para la próxima fase.

---

## Arquitectura del Sistema

El proyecto está dividido en 4 capas principales:

### 1.Data Engineering Pipeline (`src/ingest/`)
Pipeline de procesamiento de datos estructurado en arquitectura Medallón (Bronce, Plata, Oro):
* **Capa Bronce:** Extracción cruda de PDFs utilizando `Docling`.
* **Capa Silver:** Procesamiento híbrido Config-Driven. 
  * Extracción de texto estructurado vía Regex + LLM Fallback (Gemini).
  * Extracción multimodal de pictogramas y rombos de seguridad usando **Gemma 3 27B Vision** (`vision_enricher.py`).
* **Capa Gold:** Chunking semántico inteligente preservando jerarquías Markdown e inyección de metadatos (Sección exacta de la FDS).

### 2. Motor RAG y Evaluación (`src/backend/` & `evaluation/`)
* **Vectorstore:** Indexación de fragmentos en **ChromaDB** utilizando embeddings de **Azure OpenAI**.
* **Retriever:** Búsqueda híbrida con filtrado estricto por metadatos (ID del documento y número de sección) para evitar alucinaciones.
* **LLM-as-a-Judge:** Inspector automatizado (`sga_auditor_judge.py`) impulsado por **Gemini 2.5 Flash**, que evalúa las secciones extraídas contra un diccionario de reglas normativas centralizado (`evaluadores/diccionario_items.csv`).

### 3. API RESTful (`src/api/`)
Backend construido con **FastAPI** para exponer los servicios del modelo al frontend de manera asíncrona y eficiente.
* Endpoints modulares para: Búsqueda vectorial (`/search`), conversión de documentos (`/convert`), gestión de archivos (`/documents`) y ejecución de auditorías (`/audit`).

### 4. Frontend Web (`src/frontend/`)
Interfaz gráfica de usuario moderna y rápida (SPA).
* Construida con **React**, **TypeScript** y empaquetada con **Vite**.
* Permite a los usuarios visualizar el texto extraído (MarkdownViewer) y revisar los reportes tabulares de la auditoría de forma interactiva. *(Subida de documentos en desarrollo).*
----

## Guía de Inicio Rápido (Local)

### 1. Configuración del Entorno (Variables)
Asegúrate de configurar las credenciales en el archivo `.env` (no incluido en el repositorio por seguridad):
```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AZURE_OPENAI_API_KEY=...
GOOGLE_API_KEY=...
```

### 2. Levantar la API (FastAPI)
```bash
cd src/api
pip install -r requirements_api.txt
uvicorn main:app --reload --port 8000
```
*La documentación interactiva de la API estará disponible en `http://localhost:8000/docs`*

### 3. Levantar el Frontend (Vite)
En una nueva terminal:
```bash
cd src/frontend
npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173`
---

##  Stack Tecnológico

**Inteligencia Artificial & Datos:**
* LangChain / LangChain Chroma
* Azure OpenAI (Embeddings)
* Google Gemini 2.5 Flash & Gemma 3 Vision (Inferencia y Visión)
* Docling / PyMuPDF (Procesamiento de documentos)

**Backend:**
* Python 3.10+
* FastAPI + Uvicorn
* Pydantic

**Frontend:**
* React + TypeScript
* Vite

---
