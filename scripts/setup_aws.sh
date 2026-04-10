#!/bin/bash
# ==========================================
# AUTOMATIZACIÓN DE INFRAESTRUCTURA - SGA
# Archivo: scripts/setup_aws.sh
# ==========================================

# Detener el script si ocurre algún error
set -e

# Generamos un ID único para evitar colisiones
PROJECT_ID=$RANDOM
BUCKET_NAME="sga-data-lake-$PROJECT_ID"
REGION=$(aws configure get region)
REGION=${REGION:-us-east-1}

echo "======================================================="
echo " INICIANDO DESPLIEGUE AWS - PLATAFORMA SGA"
echo "======================================================="
echo "Región objetivo: $REGION"
echo "ID de Proyecto: $PROJECT_ID"
echo "======================================================="

# ---------------------------------------------------------
# FASE 1: DATA LAKE (S3)
# ---------------------------------------------------------
echo -e "\n [1/3] Creando Bucket S3: $BUCKET_NAME..."
aws s3 mb s3://$BUCKET_NAME --region $REGION

echo " Construyendo arquitectura Medallón en S3..."
aws s3api put-object --bucket $BUCKET_NAME --key "quarantine/" > /dev/null
aws s3api put-object --bucket $BUCKET_NAME --key "bronce/" > /dev/null
aws s3api put-object --bucket $BUCKET_NAME --key "silver/" > /dev/null
aws s3api put-object --bucket $BUCKET_NAME --key "gold/" > /dev/null

# ---------------------------------------------------------
# FASE 2: SERVIDOR DE PRODUCCIÓN (EC2 + ELASTIC IP)
# ---------------------------------------------------------
echo -e "\n️ [2/3] Configurando Security Group (Firewall)..."
SG_ID=$(aws ec2 create-security-group \
    --group-name "sga-sg-$PROJECT_ID" \
    --description "SG para Plataforma SGA (API, Web y ChromaDB)" \
    --query 'GroupId' \
    --output text)

echo " Abriendo puertos: 22 (SSH), 4000 (Chroma), 8000 (API), 5173 (Web)..."
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 4000 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8000 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5173 --cidr 0.0.0.0/0

echo " Obteniendo última imagen de Ubuntu 22.04 LTS..."
AMI_ID=$(aws ssm get-parameters \
    --names /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id \
    --query 'Parameters[0].Value' \
    --output text)

echo " Lanzando Instancia EC2 (t3.medium)..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.medium \
    --security-group-ids $SG_ID \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=SGA-Servidor-Produccion}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

echo " Esperando a que la instancia se inicialice (esto tomará unos segundos)..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

echo " Asignando IP Elástica (IP Fija)..."
ALLOCATION_ID=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
PUBLIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)

aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID > /dev/null

# ---------------------------------------------------------
# FASE 3: ENTORNO DE DESARROLLO (CLOUD9)
# ---------------------------------------------------------
echo -e "\n [3/3] Creando entorno Cloud9 (SGA-Dev-Workspace)..."
aws cloud9 create-environment-ec2 \
    --name "SGA-Dev-Workspace-$PROJECT_ID" \
    --description "Entorno de desarrollo para RAG-as-a-Judge" \
    --instance-type t3.medium \
    --image-id ubuntu-22.04-x86_64 > /dev/null

# ---------------------------------------------------------
# RESUMEN
# ---------------------------------------------------------
echo -e "\n======================================================="
echo " DESPLIEGUE FINALIZADO CON ÉXITO! "
echo "======================================================="
echo "Guarda esta información para tu archivo .env y el Frontend:"
echo "-------------------------------------------------------"
echo "🔹 S3_BUCKET_NAME : $BUCKET_NAME"
echo "🔹 EC2_INSTANCE_ID: $INSTANCE_ID"
echo "🔹 AWS_REGION     : $REGION"
echo "🔹 IP PÚBLICA FIJA: $PUBLIC_IP"
echo "======================================================="
echo "La IP Elástica ha sido fijada. Usa $PUBLIC_IP para conectarte."
echo "Ve a la consola de AWS Cloud9 para abrir tu nuevo IDE."