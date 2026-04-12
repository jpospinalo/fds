# Frontend Web y Aplicación SPA

El dominio `apps/frontend/` contiene la interfaz de usuario (UI) de la plataforma `rag_fds`. Es una Single Page Application (SPA) moderna, rápida y reactiva, construida para que los auditores puedan interactuar con el motor de Inteligencia Artificial sin necesidad de usar la terminal.

## 1. Stack Tecnológico

* **Core:** React 18+
* **Build Tool:** Vite (reemplaza a Webpack/CRA para tiempos de compilación ultrarrápidos)
* **Lenguaje:** TypeScript / JavaScript
* **Gestor de Paquetes:** `npm` (Node Package Manager)

## 2. Estructura del Dominio

```text
apps/frontend/
├── index.html                # Plantilla HTML principal
├── package.json              # Dependencias y scripts de Node
├── vite.config.ts            # Configuración del empaquetador Vite
│
└── src/                      # Código fuente de la aplicación
    ├── assets/               # Imágenes, íconos y estilos estáticos
    ├── components/           # Componentes UI reutilizables (Botones, Modales, Tablas)
    ├── pages/                # Vistas principales (Dashboard, Búsqueda, Reportes)
    ├── services/             # Clientes de conexión (Axios/Fetch) para consumir la API
    └── App.jsx / main.jsx    # Enrutamiento base y punto de montaje de React
```

## 3. Configuración del Entorno Local

Para ejecutar el frontend, necesitas tener instalado **Node.js** (se recomienda la versión 18 LTS o superior).

### Paso 1: Configurar la conexión a la API
El frontend necesita saber dónde está escuchando el backend de FastAPI. Crea un archivo llamado `.env` específicamente dentro de la carpeta `apps/frontend/` (este es distinto al `.env` de la raíz del proyecto).

Archivo: `apps/frontend/.env`
```env
# URL de conexión a la API local
VITE_API_BASE_URL=http://localhost:8000
```
*(Nota: Vite requiere que las variables de entorno expuestas al navegador comiencen con el prefijo `VITE_`).*

### Paso 2: Instalación y Ejecución

Abre una nueva terminal (asegúrate de que el backend siga corriendo en otra ventana) y navega al dominio del frontend:

```bash
cd apps/frontend
```

Instala las dependencias del proyecto:
```bash
npm install
```

Levanta el servidor de desarrollo en caliente:
```bash
npm run dev
```

La consola te indicará una URL local (generalmente `http://localhost:5173`). Abre esa dirección en tu navegador para ver la plataforma funcionando.

## 4. Funcionalidades Principales

El cliente web interactúa directamente con los endpoints descritos en el `03_API_BACKEND.md`:

1. **Visor de Documentos:** Consulta `/documents/` para mostrar al usuario qué Fichas de Datos de Seguridad (FDS) están listas para ser auditadas.
2. **Buscador Semántico:** Una barra de búsqueda que consume `/search/` para permitir al auditor hacer preguntas en lenguaje natural sobre las normativas de un químico.
3. **Panel de Auditoría:** Muestra los resultados de la evaluación "LLM-as-a-Judge" de manera tabular (Cumple / No Cumple / Observaciones) basándose en los reportes generados.

## 5. Limitaciones Actuales y Deuda Técnica

 **Subida de Archivos (Upload):** Actualmente, la interfaz visual puede contener botones de "Subir PDF" o "Cargar Documento", pero **esta funcionalidad no está conectada al backend**. 
Como se documenta en la arquitectura, el flujo de ingesta actual requiere que los documentos se posicionen manualmente en S3 o en la carpeta `data/bronze/docs/`. El desarrollo del endpoint de subida y su integración con la UI es una prioridad para la próxima fase de desarrollo.

## 6. Compilación para Producción

Cuando la aplicación esté lista para ser desplegada en un entorno real (por ejemplo, en un bucket S3 estático o en AWS Amplify), se debe compilar el código para optimizar su peso y rendimiento:

```bash
npm run build
```

Esto generará una carpeta `dist/` con los archivos estáticos minificados, listos para producción.
