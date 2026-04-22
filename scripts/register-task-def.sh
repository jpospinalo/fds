#!/bin/bash
# ==========================================
# SIMPLE ECS TASK UPLOADER
# ==========================================

set -e

# Parámetros
TASK_JSON="${1:-ecs-task-def.json}"
REGION="${2:-us-east-1}"

# Validar archivo
if [[ ! -f "$TASK_JSON" ]]; then
    echo "❌ Error: Archivo $TASK_JSON no encontrado"
    exit 1
fi

# Validar JSON
if ! jq empty "$TASK_JSON" 2>/dev/null; then
    echo "❌ Error: JSON inválido"
    exit 1
fi

echo "📋 Registrando task definition desde $TASK_JSON..."

# Registrar task definition
RESULT=$(aws ecs register-task-definition \
    --cli-input-json file://"$TASK_JSON" \
    --region "$REGION")

# Extraer información
FAMILY=$(echo "$RESULT" | jq -r '.taskDefinition.family')
REVISION=$(echo "$RESULT" | jq -r '.taskDefinition.revision')
ARN=$(echo "$RESULT" | jq -r '.taskDefinition.taskDefinitionArn')

echo "✅ Task definition registrada: $FAMILY:$REVISION"
echo "📍 ARN: $ARN"