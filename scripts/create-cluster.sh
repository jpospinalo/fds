#!/bin/bash

# Salir inmediatamente si un comando falla
set -e

# Función para manejo de errores
handle_error() {
    echo "Error en línea $1: El comando falló"
    exit 1
}
trap 'handle_error $LINENO' ERR

# --- Variables de configuración ---
CLUSTER_NAME="rag-fds-cluster-v2"
REGION="us-east-1"
# ----------------------------------

echo " Iniciando la configuración del clúster ECS: $CLUSTER_NAME..."

# Validar AWS CLI
if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
    echo "Error: AWS CLI no está configurado correctamente"
    exit 1
fi

# Verificar si el clúster ya existe
if aws ecs describe-clusters --cluster "$CLUSTER_NAME" --region "$REGION" --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
    echo "  El clúster $CLUSTER_NAME ya existe y está activo."
else
    echo " Creando nuevo clúster ECS: $CLUSTER_NAME..."
    
    # Crear el clúster
    aws ecs create-cluster \
        --cluster-name "$CLUSTER_NAME" \
        --region "$REGION" \
        --capacity-providers FARGATE FARGATE_SPOT \
        --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
        --settings "name=containerInsights,value=disabled" \
        --output json
    
    echo "Clúster $CLUSTER_NAME creado exitosamente."
fi

echo " Configuración completada. Clúster listo para usar."
