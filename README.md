# Plataforma de Auditoría Inteligente SGA (rag_fds)

Plataforma Full-Stack impulsada por Inteligencia Artificial para la ingesta, vectorización y auditoría automática de Fichas de Datos de Seguridad (FDS) bajo la normativa del Sistema Globalmente Armonizado (SGA). 

---

## Estado Actual de Desarrollo

**Limitación Conocida (En progreso):** La subida de archivos (Upload) desde el Frontend hacia el Backend se encuentra deshabilitada temporalmente. El sistema opera con documentos pre-cargados en la carpeta `data/`.

---

## Documentación Oficial del Proyecto

Hemos estructurado la documentación paso a paso para facilitar la integración de nuevos miembros al equipo. Por favor, lee los siguientes documentos en orden:

1. **[Guía de Inicio y Onboarding](./docs/01_ONBOARDING.md)**
   * *Empieza aquí:* Cómo clonar el proyecto, ejecutar el script de AWS, crear tu entorno virtual y configurar tus variables de entorno (`.env`).

2. **[Arquitectura y Pipeline de Datos](./docs/02_ARCHITECTURE.md)**
   * Explicación de la estructura Monorepo y cómo funciona el Pipeline Medallón (Bronce, Plata, Oro).

3. **[Backend & Motor RAG](./docs/03_API_BACKEND.md)**
   * Cómo levantar FastAPI, lista de endpoints, uso de ChromaDB y el sistema del Juez Evaluador.

4. **[Frontend Web](./docs/04_FRONTEND.md)**
   * Cómo levantar la interfaz en React/Vite y estructura de componentes.

5. **[Configuración de Azure Embeddings](./docs/05_AZURE_EMBEDDINGS.md)**
   * Tutorial paso a paso para crear y configurar el servicio de vectorización de texto en Azure OpenAI.

---

## Stack Tecnológico Resumido

* **IA & Datos:** LangChain, ChromaDB, Azure OpenAI, Google Gemini 2.5 Flash, Docling.
* **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic.
* **Frontend:** React, TypeScript, Vite.
* **Infraestructura:** AWS (EC2, S3, Cloud9).