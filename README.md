# Plataforma de Auditoría Inteligente SGA (rag_fds)

Plataforma Full-Stack impulsada por Inteligencia Artificial para la ingesta, vectorización y auditoría automática de Fichas de Datos de Seguridad (FDS) bajo la normativa del Sistema Globalmente Armonizado (SGA). 

---

## Estado Actual de Desarrollo

El sistema permite la carga de documentos desde el Frontend, interactuando con los endpoints correspondientes en el backend para la ingesta, extracción, vectorización y auditoría automática usando el pipeline medallón.

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

6. **[Guía de Scripts e Infraestructura](./docs/06_SCRIPTS.md)**
   * Detalles sobre los automatismos en Bash para configurar AWS (S3, EC2, Load Balancers), ChromaDB remoto, pipeline ECR y servicios de ECS Fargate.

---

## Stack Tecnológico Resumido

* **IA & Datos:** LangChain, ChromaDB, Azure OpenAI, Google Gemini 2.5 Flash, Docling.
* **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic.
* **Frontend:** React, TypeScript, Vite.
* **Infraestructura:** AWS (EC2, S3, Cloud9, ECR, ECS Fargate).
