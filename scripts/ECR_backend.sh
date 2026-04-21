#!/bin/bash

# Configuración de variables
REPO_NAME="rag-fds-backend"
REGION="us-east-1" # Cambia esto a tu región si es diferente

echo "-------------------------------------------------------"
echo "Configurando repositorio ECR: $REPO_NAME"
echo "-------------------------------------------------------"

# 1. Verificar si el repositorio ya existe
if aws ecr describe-repositories --repository-names "$REPO_NAME" > /dev/null 2>&1; then
    echo " [!] El repositorio '$REPO_NAME' ya existe. Saltando creación..."
else
    echo " [+] Creando repositorio ECR..."
    aws ecr create-repository \
        --repository-name "$REPO_NAME" \
        --encryption-configuration '{"encryptionType":"AES256"}' \
        --image-tag-mutability 'MUTABLE' \
        --image-scanning-configuration '{"scanOnPush":true}'
    
    if [ $? -eq 0 ]; then
        echo " [✓] Repositorio creado con éxito."
    else
        echo " [✗] Error al crear el repositorio."
        exit 1
    fi
fi

# 2. Definir la política de acceso en una variable
# Esta política permite acciones de push/pull solo a usuarios con correo @usa.edu.co
POLICY_JSON=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowVoclabsUsers",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:BatchCheckLayerAvailability",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:DescribeRepositories",
                "ecr:DescribeImages"
            ],
            "Condition": {
                "StringLike": {
                    "aws:userid": "*=*@usa.edu.co"
                }
            }
        }
    ]
}
EOF
)

# 3. Aplicar la política al repositorio
echo " [+] Aplicando política de acceso institucional..."
aws ecr set-repository-policy \
    --repository-name "$REPO_NAME" \
    --policy-text "$POLICY_JSON"

if [ $? -eq 0 ]; then
    echo " [✓] Política aplicada correctamente."
else
    echo " [✗] Error al aplicar la política."
    exit 1
fi

echo "-------------------------------------------------------"
echo "Proceso finalizado con éxito."
echo "URL del repositorio: $(aws ecr describe-repositories --repository-names $REPO_NAME --query 'repositories[0].repositoryUri' --output text)"