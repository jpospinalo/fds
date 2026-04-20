# 1. Imagen base ligera de Python
FROM python:3.10-slim

# 2. Configurar variables de entorno de Python
# Evita que se generen archivos .pyc y asegura que los logs se vean en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# 4. Instalar dependencias del sistema necesarias (opcional pero recomendado)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 5. Copiar e instalar dependencias de Python
# Lo hacemos antes de copiar el resto del código para aprovechar la caché de Docker
COPY apps/api_backend/requirements_api.txt .
RUN pip install --no-cache-dir -r requirements_api.txt

# 6. Copiar la estructura de aplicaciones
# Copiamos toda la carpeta 'apps' para que el backend tenga acceso a sus módulos
COPY apps/ /app/apps/

# 7. Exponer el puerto en el que corre FastAPI
EXPOSE 8000

# 8. Comando para arrancar la aplicación
# Usamos exactamente el comando que confirmaste que funciona
CMD ["python", "-m", "uvicorn", "api_backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "apps"]