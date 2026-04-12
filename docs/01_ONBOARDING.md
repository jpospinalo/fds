# Guía de Inicio y Onboarding

Bienvenido al equipo de rag_fds. Este documento detalla los pasos necesarios para configurar tu entorno local y conectarlo con la infraestructura en la nube.

## 1. Clonar el Repositorio

Clona el proyecto en tu máquina local y accede al directorio principal:

```bash
git clone git@github.com:jpospinalo/fds.git
cd rag_fds
```

## 2. Desplegar la Infraestructura (AWS)

La plataforma utiliza servicios de AWS (S3, EC2). La creación de estos recursos está automatizada mediante scripts de Infrastructure as Code (IaC).

1. Abre tu terminal configurada con AWS CLI o accede a AWS CloudShell.
2. Ejecuta el script de infraestructura:

```bash
chmod +x scripts/setup_aws.sh
./scripts/setup_aws.sh
```

## 3. Configurar ChromaDB en EC2 (Motor Vectorial)
Nuestra arquitectura aloja la base de datos vectorial en la instancia EC2 para separar la carga de trabajo. Debes inicializar este servicio remoto antes de levantar el backend local.

1. Conéctate a tu instancia EC2 recién creada mediante SSH:

```bash
ssh -i "tu-llave.pem" ubuntu@<EC2_ELASTIC_IP>
```

2. Crea el archivo de instalación dentro de la instancia EC2:

```bash
nano setup_chromadb.sh
```

3. Abre el archivo scripts/setup_chromadb.sh de tu repositorio local, copia todo su contenido y pégalo en la terminal del EC2. Guarda los cambios (Ctrl+O, luego Enter) y sal del editor (Ctrl+X).

4. Otorga permisos de ejecución y lanza el instalador:

```bash
chmod +x setup_chromadb.sh
./setup_chromadb.sh
```
Al finalizar, el script creará un servicio systemd y ChromaDB quedará ejecutándose en segundo plano en el puerto 4000. Puedes verificarlo corriendo: curl http://localhost:4000/api/v1/heartbeat.

Al finalizar, el script mostrará en pantalla el nombre del bucket S3 y la IP Elástica de tu servidor. Guarda estos datos para el siguiente paso.

## 4. Configurar las Variables de Entorno

Por motivos de seguridad, las credenciales no se incluyen en el repositorio. Crea un archivo llamado `.env` en la raíz del proyecto (`rag_fds/.env`) y define la siguiente estructura. 

>[!NOTE]
>Si aún no tienes configurados los servicios de Azure OpenAI, consulta la [Guía de Configuración de Azure Embeddings](./05_AZURE_EMBEDDINGS.md) antes de continuar.

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

## 5. Configurar el Entorno Virtual (Backend)

Para ejecutar el motor RAG y la API, es necesario configurar un entorno de Python aislado.

**En sistemas basados en Unix (Mac/Linux):**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r apps/api_backend/requirements_api.txt
```

**En sistemas Windows:**
```bash
python -m venv venv
venv\Scripts\activate
pip install -r apps/api_backend/requirements_api.txt
```

## 6. Ejecución del Servidor Local

Con el entorno virtual activado y tu archivo `.env` configurado, ejecuta el backend utilizando el comando para nuestra arquitectura monorepo:

```bash
python -m uvicorn api_backend.main:app --reload --port 8000 --host 0.0.0.0 --app-dir apps
```

Si la consola muestra `Application startup complete`, el servidor estará operativo. Puedes acceder a la documentación interactiva de la API en `http://localhost:8000/docs`.
