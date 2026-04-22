#!/bin/bash
# ==========================================
# UPDATE ECS SERVICE
# ==========================================

CLUSTER="${1:-rag-fds-cluster}"
SERVICE="${2:-rag-fds-backend-service-qb646aeq}"
TASK_FAMILY="${3:-rag-fds-backend-task}"
REGION="${4:-us-east-1}"

echo "🔄 Actualizando servicio $SERVICE..."

# Obtener última revisión
LATEST_REVISION=$(aws ecs describe-task-definition \
    --task-definition "$TASK_FAMILY" \
    --region "$REGION" \
    --query 'taskDefinition.revision' \
    --output text)

# Actualizar servicio
aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --task-definition "$TASK_FAMILY:$LATEST_REVISION" \
    --region "$REGION" \
    --force-new-deployment \
    --query 'service.[serviceName,taskDefinition]' \
    --output text | awk '{print Actualizado}'