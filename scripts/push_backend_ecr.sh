#!/bin/bash

# Detener el script si algún comando falla
set -e

# --- CONFIGURACIÓN ---
REGION="us-east-1"
REPO_NAME="rag-fds-backend"
IMAGE_TAG="latest"

echo "Obteniendo ID de la cuenta de AWS..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "1. Autenticando Docker con ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URL

echo " 2. Construyendo imagen (Forzando arquitectura linux/amd64 para AWS)..."
docker build --platform linux/amd64 -t $REPO_NAME -f apps/api_backend/Dockerfile .

echo " 3. Etiquetando imagen para ECR..."
docker tag ${REPO_NAME}:latest ${ECR_URL}/${REPO_NAME}:${IMAGE_TAG}

echo "4. Empujando imagen a ECR..."
docker push ${ECR_URL}/${REPO_NAME}:${IMAGE_TAG}

echo "¡Proceso completado! La imagen del backend está en AWS ECR."