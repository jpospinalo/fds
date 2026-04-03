
# Pipeline RAG para Fichas de Datos de Seguridad (FDS/SGA)

Este repositorio contiene la arquitectura de datos y los scripts de procesamiento para automatizar la ingesta, extracción, enriquecimiento visual y limpieza de Fichas de Datos de Seguridad (FDS) de productos químicos. 

El sistema utiliza una **Arquitectura Medallón** en AWS S3 y un enfoque de extracción híbrido y multimodal (Regex + Modelos Semánticos + Visión por Computadora) para estructurar al 100% documentos caóticos y prepararlos para un futuro sistema RAG (Retrieval-Augmented Generation).

---

## Arquitectura de Datos (Medallón)

El almacenamiento está estructurado en un bucket de Amazon S3 con las siguientes capas:

* **1. Origen (`bronze/docs/`)**: Repositorio de los documentos originales en formato PDF.
* **2. Capa Bronce (`bronze/processed/`)**: Almacena "cápsulas" por documento. Utiliza un motor de ingesta ultraligero que extrae la estructura del PDF en un único archivo Markdown (`.md`), dejando marcadores semánticos (ej. ``) en lugar de extraer imágenes físicas, ahorrando drásticamente en almacenamiento y computo.
* **3. Capa Silver (`silver/seccion_X/`)**: Contiene fragmentos de texto segmentados rigurosamente por sección (de la 1 a la 16), limpios de ruido visual (paginación, artefactos) y con las imágenes críticas ya traducidas a texto. Guardados en formato estructurado `.jsonl`.
* **4. Cuarentena (`Quarantine/`)**: Archivos que el sistema no pudo procesar por formato ilegible o fallos extremos, aislados para revisión manual.

---

## Fases de Procesamiento

El pipeline está modularizado en cuadernos individuales para garantizar la resiliencia y el procesamiento en paralelo.

### Fase 1: Ingesta Estructural Ligera (PDF ➔ Bronce)
Script encargado de leer los PDFs originales y transformarlos a texto estructurado de forma masiva.
- **Herramienta principal:** `Docling` (En modo ligero / Sin generación de imágenes físicas).
- **Lógica:** Genera la estructura base en Markdown conservando las tablas y jerarquías, preparando el terreno para la extracción quirúrgica de la Fase 2.

### Fase 2: Extracción Híbrida y Auditoría Visual (Bronce ➔ Silver)
El núcleo del pipeline. Consiste en 16 cuadernos orquestadores (uno por cada sección de la FDS) divididos en dos categorías arquitectónicas:

#### A. Secciones de Texto Puro (Secciones 1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16)
Utilizan un pipeline de extracción de **2 Niveles (Tiers)** para optimizar costos (FinOps):
- **Tier 1 (Regex):** Motor principal. Expresiones Regulares robustas que recortan la sección objetivo casi instantáneamente y sin consumir cuota de API.
- **Tier 2 (Extracción Semántica LLM - Fallback):** Si la Regex falla por anomalías en el documento, actúa `gemini-2.5-flash-lite` o `gemini-3.1-flash-lite-preview` mediante **LangChain** y **Pydantic** para extraer el bloque semánticamente. Cuenta con un **Controlador de Presupuesto** integrado que gestiona límites de tasa (RPM) y estima tokens usando `tiktoken`.

#### B. Secciones Multimodales / Críticas Visuales (Secciones 2, 8 y 14)
Estas secciones contienen datos críticos en formato de imagen (rombos ONU, pictogramas SGA, iconos de EPP). Aquí el pipeline activa un nivel adicional:
- **Tier 3 (Inyección Visual / Gemma 3):** 1. Descarga el PDF original temporalmente.
  2. Utiliza `PyMuPDF` para encontrar y tomar una foto en alta resolución de la página exacta donde falló el OCR.
  3. Invoca a **Gemma 3 27B** como "Auditor Visual" para leer la imagen y reemplazar los espacios ciegos del Markdown con descriptores exactos (Ej: `[PICTOGRAMA: líquido inflamable]`).

---

## Tecnologías Utilizadas

* **Python 3.x**
* **AWS SDK:** `boto3` (Integración fluida con S3).
* **Ingesta Estructural:** `docling` (Conversión avanzada a Markdown).
* **Análisis PDF / Visión:** `pymupdf` (fitz).
* **LLMs Multimodales:** `google-generativeai` (Gemma 3 27B IT para auditoría visual).
* **Orquestación Semántica:** `langchain`, `langchain-google-genai`, `pydantic` (Gemini 2.5 Flash-lite).
* **Control de Costos:** `tiktoken`.

---

## Configuración del Entorno

1. Clona este repositorio.
2. Abre los cuadernos en la carpeta `notebooks/`. Las dependencias (`!pip install`) están configuradas en la primera celda de cada cuaderno.
3. Crea un archivo `.env` en la raíz del proyecto o configura los **Secrets** en tu plataforma (ej. Google Colab) con las siguientes variables obligatorias:
   - `GOOGLE_API_KEY`
   - Credenciales de AWS S3 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, etc.)
4. Ejecuta el cuaderno `01_ingesta_docling.ipynb` para poblar la Capa Bronce.
5. Ejecuta los cuadernos de la Capa Silver (`02_silver...` al `16_silver...`) para estructurar los datos finales.
