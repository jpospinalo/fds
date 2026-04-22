# Guía de Uso de Scripts de Infraestructura (SGA)

El directorio `scripts/` contiene diversas herramientas automatizadas (escritas en bash) para desplegar recursos en AWS, configurar servidores y gestionar el ciclo de compilación/despliegue del backend en la nube. Estos scripts aseguran que el ecosistema se levante de manera rápida, estandarizada y repetible, minimizando errores manuales.

## Contenido del Directorio

1. `setup_aws.sh`
2. `setup_chromadb.sh`
3. `ECR_backend.sh`
4. `push_backend_ecr.sh`
5. `create-cluster.sh`
6. `ecs-task-def.json`
7. `register-task-def.sh`
8. `update-ecs-service.sh`

---

## 1. `setup_aws.sh`

### ¿Por qué existe?
El sistema requiere una infraestructura básica en AWS que incluye: un Bucket S3 (para almacenar los PDFs originales y chunks procesados de la base de datos), una instancia EC2 (donde correrá ChromaDB para almacenamiento vectorial), un Application Load Balancer y Grupos de Seguridad (para permitir la comunicación).
Hacer esto manualmente tomaría más de una hora de clicks en el sitio web de AWS. Este script automatiza la creación de todos estos recursos a través de AWS CLI (Infrastructure as Code aproximado).

### ¿Cómo usarlo?
1. Debes tener tus credenciales de AWS configuradas en tu terminal local (mediante el archivo `~/.aws/credentials` o exportadas en la sesión con `aws configure`).
2. Asígnale permisos de ejecución al script y córrelo:
   ```bash
   chmod +x scripts/setup_aws.sh
   ./scripts/setup_aws.sh
   ```
3. El script validará prerrequisitos y detectará si ya existen recursos. Al finalizar, imprimirá salidas clave como: **S3 Bucket Name**, **Elastic IP del EC2**, y **DNS del Load Balancer**. Estos datos deben copiarse en los archivos `.env` (guía `01_ONBOARDING.md`).

---

## 2. `setup_chromadb.sh`

### ¿Por qué existe?
Como el motor RAG necesita consultar millones de vectores rápida y eficientemente, descargamos esa carga computacional del backend principal y utilizamos una instancia de EC2 dedicada como servidor remoto de base de datos vectorial (ChromaDB operando en red, en vez de local).

### ¿Cómo usarlo?
Este script está pensado para ejecutarse **exclusivamente dentro de la instancia EC2 de AWS**, no en tu máquina local.
1. Conéctate a la EC2 creada en el paso anterior usando SSH y la llave generada.
2. Crea el archivo dentro del servidor EC2 y pega el contenido de `scripts/setup_chromadb.sh`.
   ```bash
   nano setup_chromadb.sh
   ```
3. Otórgale permisos y ejecútalo como superusuario para que configure e inicie ChromeDB como servicio en segundo plano (daemon `systemd`) en el puerto 4000:
   ```bash
   chmod +x setup_chromadb.sh
   ./setup_chromadb.sh
   ```

>[!NOTE]
>*Nunca ejecutes este archivo en tu máquina Windows / Mac local, pues intentará configurar demonios de Linux remotos*

---

## 3. `ECR_backend.sh`

### ¿Por qué existe?
Para ejecutar el backend de FastAPI en la nube mediante un cluster de contenedores (o Fargate), la imagen Docker del backend debe estar alojada en AWS ECR (Elastic Container Registry). Este script crea el repositorio ECR seguro si no existe e inyecta una política de seguridad que restringe la subida/descarga de contenedores exclusivamente a usuarios con correos institucionales.

### ¿Cómo usarlo?
Se ejecuta de forma local:
```bash
chmod +x scripts/ECR_backend.sh
./scripts/ECR_backend.sh
```
Imprimirá la **URL del repositorio final** (ej. `123456789.dkr.ecr.us-east-1.amazonaws.com/rag-fds-backend`).

---

## 4. `push_backend_ecr.sh`

### ¿Por qué existe?
Este script es la parte fundamental del pipeline de Integración Continua. Se encarga de hacer el build real de tu API (`apps/api_backend/Dockerfile`), iniciar sesión (login) en AWS ECR y hacer push de la nueva imagen construida. 

### ¿Cómo usarlo?
1. Asegúrate de tener **Docker instalado y corriendo** en tu máquina.
2. Asegúrate de que el script tenga permisos.
3. Ejecútalo desde local después de realizar cambios sustanciales en el código del backend:
   ```bash
   chmod +x scripts/push_backend_ecr.sh
   ./scripts/push_backend_ecr.sh
   ```
El script pedirá credenciales automáticas a AWS STS y empezará a subir las capas de la imagen.

---

## 5. Módulo ECS: `create-cluster.sh` y `ecs-task-def.json`

### ¿Por qué existen?
AWS Elastic Container Service (ECS) Fargate se utiliza para correr la imagen de Docker del backend permanentemente sin necesidad de gestionar o aprovisionar servidores. 
- `create-cluster.sh`: Script que instruye a AWS para desplegar un nuevo cluster ECS con Load Balancer e inicializa el servicio usando Fargate.
- `ecs-task-def.json`: Archivo de configuración (Task Definition) estático que AWS lee para saber cuánta RAM/CPU asignarle al contenedor, qué imagen de ECR sacar, y qué variables de entorno inyectar al arrancarlo en producción.

### ¿Cómo usarlos?
1. Antes de correr el script principal, debes abrir `scripts/ecs-task-def.json` y actualizar la propiedad `"image"` colocando la URL correcta del contenedor obtenida en el paso de ECR.
2. Agrega las variables de entorno de producción (`.env` reales) dentro del arreglo de *environment* del archivo json.
3. Ejecuta el script de creación de cluster:
   ```bash
   chmod +x scripts/create-cluster.sh
   ./scripts/create-cluster.sh
   ```
Una vez termine, el backend estará respondiendo en la web mundial.

---

## 6. Módulo ECS (Actualizaciones): `register-task-def.sh` y `update-ecs-service.sh`

### ¿Por qué existen?
Una vez que el proyecto base está en producción de forma exitosa usando `create-cluster.sh`, AWS mantendrá tus APIs operativas ininterrumpidamente. Sin embargo, cuando lanzas variables de entorno nuevas (ejemplo un nuevo "API_KEY" modificado) en `ecs-task-def.json` o subes una imagen con mejoras/parches a Elastic Container Registry (`push_backend_ecr.sh`), AWS no recargará automáticamente los contenedores activos.

*   `register-task-def.sh`: Lee tu archivo `ecs-task-def.json`, interpreta los cambios, y registra una versión nueva y empaquetada (Task Definition Revision) en AWS.
*   `update-ecs-service.sh`: Le avisa a Fargate que debe descartar el contenedor viejo, tomar la última versión (revision) registrada en el Task Definition anterior, y aplicar un "Rolling Update" para que nunca te quedes sin servicio mientras arranca la versión nueva.

### ¿Cómo usarlo?
1. Solo **después de hacer un push de imagen nueva** o después de modificar `.json` que contiene tu Definition Task:
2. Le das permisos y registras tu nueva arquitectura:
   ```bash
   chmod +x scripts/register-task-def.sh
   ./scripts/register-task-def.sh
   ```
3. Otorgas permisos y reinicias los contenedores con la versión final:
   ```bash
   chmod +x scripts/update-ecs-service.sh
   ./scripts/update-ecs-service.sh
   ```
Espera de 3 a 5 minutos, AWS transicionará el tráfico hacia tu nuevo contenedor sin causar indisponibilidades a los usuarios en vivo!
