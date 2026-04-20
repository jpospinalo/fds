#!/bin/bash

echo "Creando repositorio ECR para el backend..."

aws ecr create-repository \
    --repository-name 'rag-fds-backend' \
    --encryption-configuration '{"encryptionType":"AES256"}' \
    --image-tag-mutability 'MUTABLE' \
    --image-scanning-configuration '{"scanOnPush":false}'

echo "Repositorio creado con éxito."