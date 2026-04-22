#!/bin/bash
# ==========================================
# AUTOMATIZACIÓN DE INFRAESTRUCTURA - SGA
# Archivo: scripts/setup_aws.sh
# ==========================================

# Detener el script si ocurre algún error
set -e

# Variables globales para limpieza
CREATED_RESOURCES=()
BUCKET_NAME=""
ALB_ARN=""
TG_ARN=""
INSTANCE_ID=""
ALLOCATION_ID=""
ALB_SG_ID=""
FARGATE_SG_ID=""
EC2_SG_ID=""

# ---------------------------------------------------------
# FUNCIÓN: VALIDACIONES Y PRERREQUISITOS
# ---------------------------------------------------------
validate_prerequisites() {
    echo " Validando prerrequisitos..."
    
    # Verificar AWS CLI
    if ! command -v aws &> /dev/null; then
        echo " Error: AWS CLI no está instalado"
        echo "   Instala AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    
    # Verificar credenciales AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        echo " Error: Credenciales AWS no configuradas"
        echo "   Ejecuta: aws configure"
        exit 1
    fi
    
    # Verificar permisos básicos
    if ! aws ec2 describe-vpcs --max-items 1 &> /dev/null; then
        echo " Error: Sin permisos suficientes en EC2"
        exit 1
    fi
    
    if ! aws s3 ls &> /dev/null; then
        echo " Error: Sin permisos suficientes en S3"
        exit 1
    fi
    
    if ! aws elbv2 describe-load-balancers --max-items 1 &> /dev/null; then
        echo " Error: Sin permisos suficientes en ELB"
        exit 1
    fi
    
    # Verificar curl para obtener IP
    if ! command -v curl &> /dev/null; then
        echo "  Advertencia: curl no está disponible, no se podrá obtener IP pública"
    fi
    
    echo "Prerrequisitos validados correctamente"
}

# ---------------------------------------------------------
# FUNCIÓN: VERIFICAR SI RECURSOS YA EXISTEN
# ---------------------------------------------------------
check_existing_resources() {
    echo " Verificando recursos existentes..."
    
    # Verificar bucket S3
    if aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
        echo "  El bucket $BUCKET_NAME ya existe"
        read -p "¿Deseas continuar usando el bucket existente? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Operación cancelada por el usuario"
            exit 1
        fi
        BUCKET_EXISTS=true
    else
        BUCKET_EXISTS=false
    fi
    
    # Verificar Security Groups existentes
    if aws ec2 describe-security-groups --group-names "sga-alb-sg-$PROJECT_ID" &> /dev/null; then
        echo "  Security Groups con PROJECT_ID $PROJECT_ID ya existen"
        read -p "¿Deseas continuar? Esto puede causar conflictos (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Operación cancelada por el usuario"
            exit 1
        fi
    fi
    
    echo " Verificación de recursos completada"
}

# ---------------------------------------------------------
# FUNCIÓN: LIMPIEZA EN CASO DE ERROR
# ---------------------------------------------------------
cleanup_on_error() {
    echo ""
    echo " Error detectado. Iniciando limpieza de recursos..."
    
    # Desasociar y liberar IP elástica
    if [[ -n "$ALLOCATION_ID" && -n "$INSTANCE_ID" ]]; then
        echo "   Liberando IP elástica..."
        aws ec2 disassociate-address --association-id $(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].AssociationId' --output text) 2>/dev/null || true
        aws ec2 release-address --allocation-id $ALLOCATION_ID 2>/dev/null || true
    fi
    
    # Terminar instancia EC2
    if [[ -n "$INSTANCE_ID" ]]; then
        echo "   Terminando instancia EC2..."
        aws ec2 terminate-instances --instance-ids $INSTANCE_ID 2>/dev/null || true
    fi
    
    # Eliminar Load Balancer
    if [[ -n "$ALB_ARN" ]]; then
        echo "   Eliminando Load Balancer..."
        aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN 2>/dev/null || true
        # Esperar a que se elimine antes de eliminar target group
        sleep 10
    fi
    
    # Eliminar Target Group
    if [[ -n "$TG_ARN" ]]; then
        echo "   Eliminando Target Group..."
        aws elbv2 delete-target-group --target-group-arn $TG_ARN 2>/dev/null || true
    fi
    
    # Eliminar Security Groups (en orden inverso)
    for sg_id in "$EC2_SG_ID" "$FARGATE_SG_ID" "$ALB_SG_ID"; do
        if [[ -n "$sg_id" ]]; then
            echo "   Eliminando Security Group: $sg_id..."
            aws ec2 delete-security-group --group-id $sg_id 2>/dev/null || true
        fi
    done
    
    # Eliminar bucket S3 solo si lo creamos nosotros
    if [[ -n "$BUCKET_NAME" && "$BUCKET_EXISTS" != "true" ]]; then
        echo "   Eliminando bucket S3..."
        aws s3 rb s3://$BUCKET_NAME --force 2>/dev/null || true
    fi
    
    echo "🧹 Limpieza completada"
    echo "❌ Despliegue fallido. Revisa los errores anteriores."
    exit 1
}

# Configurar trap para limpieza automática
trap cleanup_on_error ERR

# ---------------------------------------------------------
# FUNCIÓN: LIMPIEZA MANUAL (PARA USAR DESPUÉS)
# ---------------------------------------------------------
create_cleanup_script() {
    cat > "cleanup-sga-$PROJECT_ID.sh" << EOF
#!/bin/bash
# Script de limpieza para recursos SGA - Project ID: $PROJECT_ID
# Generado automáticamente el $(date)

echo " Iniciando limpieza de recursos SGA (Project ID: $PROJECT_ID)..."

# Liberar IP elástica
if [[ -n "$ALLOCATION_ID" ]]; then
    echo "Liberando IP elástica..."
    aws ec2 disassociate-address --association-id \$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].AssociationId' --output text) 2>/dev/null || true
    aws ec2 release-address --allocation-id $ALLOCATION_ID 2>/dev/null || true
fi

# Terminar instancia EC2
if [[ -n "$INSTANCE_ID" ]]; then
    echo "Terminando instancia EC2..."
    aws ec2 terminate-instances --instance-ids $INSTANCE_ID
    aws ec2 wait instance-terminated --instance-ids $INSTANCE_ID
fi

# Eliminar Load Balancer
if [[ -n "$ALB_ARN" ]]; then
    echo "Eliminando Load Balancer..."
    aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
    echo "Esperando eliminación del ALB..."
    sleep 30
fi

# Eliminar Target Group
if [[ -n "$TG_ARN" ]]; then
    echo "Eliminando Target Group..."
    aws elbv2 delete-target-group --target-group-arn $TG_ARN
fi

# Eliminar Security Groups
for sg_id in "$EC2_SG_ID" "$FARGATE_SG_ID" "$ALB_SG_ID"; do
    if [[ -n "\$sg_id" ]]; then
        echo "Eliminando Security Group: \$sg_id..."
        aws ec2 delete-security-group --group-id \$sg_id
    fi
done

# Eliminar bucket S3 (¡CUIDADO! Esto eliminará todos los datos)
read -p "¿Deseas eliminar el bucket S3 $BUCKET_NAME y todos sus datos? (y/N): " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]$ ]]; then
    echo "Eliminando bucket S3..."
    aws s3 rb s3://$BUCKET_NAME --force
fi

echo "Limpieza completada"
EOF

    chmod +x "cleanup-sga-$PROJECT_ID.sh"
    echo " Script de limpieza creado: cleanup-sga-$PROJECT_ID.sh"
}

# ---------------------------------------------------------
# INICIO DEL SCRIPT PRINCIPAL
# ---------------------------------------------------------

# Ejecutar validaciones
validate_prerequisites

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

# Verificar recursos existentes
check_existing_resources

# ---------------------------------------------------------
# FASE 0: OBTENER REDES (VPC Y SUBNETS)
# ---------------------------------------------------------
echo -e "\n [1/6] Obteniendo configuración de Red (VPC/Subnets)..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

if [[ "$VPC_ID" == "None" || -z "$VPC_ID" ]]; then
    echo "Error: No se encontró VPC default"
    echo "   Crea una VPC default o modifica el script para usar una VPC específica"
    exit 1
fi

# Obtenemos las subredes separadas por espacio para el Load Balancer
SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text)

if [[ -z "$SUBNETS" ]]; then
    echo "Error: No se encontraron subnets en la VPC $VPC_ID"
    exit 1
fi

echo " VPC Default: $VPC_ID"
echo " Subnets encontradas: $(echo $SUBNETS | wc -w) subnets"

# ---------------------------------------------------------
# FASE 1: DATA LAKE (S3)
# ---------------------------------------------------------
echo -e "\n [2/6] Configurando Data Lake S3..."

if [[ "$BUCKET_EXISTS" == "true" ]]; then
    echo " Usando bucket existente: $BUCKET_NAME"
else
    echo "Creando bucket S3: $BUCKET_NAME..."
    if aws s3 mb s3://$BUCKET_NAME --region $REGION; then
        echo " Bucket creado exitosamente"
    else
        echo "Error creando bucket S3"
        exit 1
    fi
fi

echo "Construyendo arquitectura Medallón en S3..."
for folder in "quarantine/" "bronce/" "silver/" "gold/"; do
    aws s3api put-object --bucket $BUCKET_NAME --key "$folder" > /dev/null
done
echo " Estructura de carpetas creada"

# ---------------------------------------------------------
# FASE 2: GRUPOS DE SEGURIDAD (FIREWALLS ENCADENADOS)
# ---------------------------------------------------------
echo -e "\n️ [3/6] Configurando Security Groups..."

echo "1. Creando SG para el Load Balancer (Público)..."
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "sga-alb-sg-$PROJECT_ID" \
    --description "SGA ALB Security Group - Project $PROJECT_ID" \
    --vpc-id $VPC_ID \
    --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=SGA-ALB-SG},{Key=Project,Value=SGA}]' \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ALB_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
echo " ALB Security Group creado: $ALB_SG_ID"

echo "2. Creando SG para Backend Fargate (Privado, solo acepta del ALB)..."
FARGATE_SG_ID=$(aws ec2 create-security-group \
    --group-name "sga-fargate-sg-$PROJECT_ID" \
    --description "SGA Fargate Security Group - Project $PROJECT_ID" \
    --vpc-id $VPC_ID \
    --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=SGA-Fargate-SG},{Key=Project,Value=SGA}]' \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $FARGATE_SG_ID --protocol tcp --port 8000 --source-group $ALB_SG_ID
echo " Fargate Security Group creado: $FARGATE_SG_ID"

echo "3. Creando SG para EC2 ChromaDB/Frontend..."
EC2_SG_ID=$(aws ec2 create-security-group \
    --group-name "sga-ec2-sg-$PROJECT_ID" \
    --description "SGA EC2 Security Group - Project $PROJECT_ID" \
    --vpc-id $VPC_ID \
    --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=SGA-EC2-SG},{Key=Project,Value=SGA}]' \
    --query 'GroupId' --output text)

# Obtener IP pública para SSH más seguro
#if command -v curl &> /dev/null; then
    #MY_IP=$(curl -s --max-time 10 ifconfig.me 2>/dev/null || echo "0.0.0.0")/32
    #if [[ "$MY_IP" != "0.0.0.0/32" ]]; then
        #echo "   Configurando SSH solo desde tu IP: $MY_IP"
        #aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr $MY_IP
    #else
        #echo "     No se pudo obtener IP pública, configurando SSH desde cualquier IP"
        #aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
    #fi
#else
    #aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
#fi

aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 5173 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 4000 --source-group $FARGATE_SG_ID
echo " EC2 Security Group creado: $EC2_SG_ID"

# ---------------------------------------------------------
# FASE 3: BALANCEADOR DE CARGA Y TARGET GROUP
# ---------------------------------------------------------
echo -e "\n [4/6] Configurando Load Balancer y Target Group..."

echo "Creando Target Group (Puerto 8000, HealthCheck en /api/openapi.json)..."
TG_ARN=$(aws elbv2 create-target-group \
    --name "sga-tg-$PROJECT_ID" \
    --protocol HTTP \
    --port 8000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path "/api/openapi.json" \
    --health-check-port "traffic-port" \
    --health-check-protocol HTTP \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 10 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --matcher HttpCode=200 \
    --tags Key=Name,Value=SGA-TargetGroup Key=Project,Value=SGA \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

echo " Target Group creado: $TG_ARN"

echo "Creando Application Load Balancer (ALB)..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "sga-alb-$PROJECT_ID" \
    --subnets $SUBNETS \
    --security-groups $ALB_SG_ID \
    --scheme internet-facing \
    --type application \
    --tags Key=Name,Value=SGA-LoadBalancer Key=Project,Value=SGA \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

echo " Load Balancer creado: $ALB_ARN"

echo "Obteniendo DNS del Load Balancer..."
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo " DNS del ALB: $ALB_DNS"

echo "Creando Listener (Puerto 80 redirige al Target Group)..."
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN \
    --tags Key=Name,Value=SGA-Listener Key=Project,Value=SGA > /dev/null

echo " Listener configurado"

# ---------------------------------------------------------
# FASE 4: SERVIDOR DE BASE DE DATOS (EC2 + ELASTIC IP)
# ---------------------------------------------------------
echo -e "\n️ [5/6] Desplegando Servidor EC2 (ChromaDB + Web)..."

echo "Obteniendo AMI de Ubuntu 22.04..."
AMI_ID=$(aws ssm get-parameters --names /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query 'Parameters[0].Value' --output text)

if [[ -z "$AMI_ID" || "$AMI_ID" == "None" ]]; then
    echo "Error: No se pudo obtener AMI ID"
    exit 1
fi

echo " AMI ID: $AMI_ID"

echo "Lanzando instancia EC2..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.medium \
    --key-name vockey \
    --security-group-ids $EC2_SG_ID \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=SGA-EC2-Chroma-Web-$PROJECT_ID},{Key=Project,Value=SGA}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo " Instancia creada: $INSTANCE_ID"

echo "Esperando a que la instancia se inicialice..."
if aws ec2 wait instance-running --instance-ids $INSTANCE_ID; then
    echo " Instancia en ejecución"
else
    echo "Error: La instancia no se inició correctamente"
    exit 1
fi

echo "Asignando IP Elástica (IP Fija)..."
ALLOCATION_ID=$(aws ec2 allocate-address --domain vpc --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=SGA-ElasticIP},{Key=Project,Value=SGA}]' --query 'AllocationId' --output text)
PUBLIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID > /dev/null

echo " IP Elástica asignada: $PUBLIC_IP"

# ---------------------------------------------------------
# FASE 5: ENTORNO DE DESARROLLO (CLOUD9)
# ---------------------------------------------------------
echo -e "\n [6/6] Creando entorno Cloud9 (SGA-Dev-Workspace)..."
if aws cloud9 create-environment-ec2 \
    --name "SGA-Dev-Workspace-$PROJECT_ID" \
    --description "Entorno de desarrollo para RAG-as-a-Judge - Project $PROJECT_ID" \
    --instance-type t3.medium \
    --image-id ubuntu-22.04-x86_64 \
    --connection-type CONNECT_SSH
    --tags Key=Project,Value=SGA > /dev/null; then
    echo " Entorno Cloud9 creado exitosamente"
else
    echo "  Advertencia: No se pudo crear el entorno Cloud9 (Hacerlo Manual)"
fi

# ---------------------------------------------------------
# CREAR ARCHIVOS DE CONFIGURACIÓN
# ---------------------------------------------------------
echo -e "\n Creando archivos de configuración..."

# Crear archivo .env
cat > "sga-config-$PROJECT_ID.env" << EOF
# Configuración SGA - Generada automáticamente el $(date)
# Project ID: $PROJECT_ID

# Identificadores
PROJECT_ID=$PROJECT_ID
REGION=$REGION

# S3 Data Lake
S3_BUCKET_NAME=$BUCKET_NAME

# Networking
VPC_ID=$VPC_ID
SUBNETS="$SUBNETS"

# Security Groups
ALB_SG_ID=$ALB_SG_ID
FARGATE_SG_ID=$FARGATE_SG_ID
EC2_SG_ID=$EC2_SG_ID

# Load Balancer
ALB_ARN=$ALB_ARN
ALB_DNS_URL=http://$ALB_DNS
TARGET_GROUP_ARN=$TG_ARN

# EC2 Instance
INSTANCE_ID=$INSTANCE_ID
EC2_PUBLIC_IP=$PUBLIC_IP
ALLOCATION_ID=$ALLOCATION_ID

# URLs de acceso
FRONTEND_URL=http://$PUBLIC_IP:5173
CHROMADB_URL=http://$PUBLIC_IP:4000
API_URL=http://$ALB_DNS
EOF

echo " Archivo de configuración creado: sga-config-$PROJECT_ID.env"

# Crear script de limpieza
create_cleanup_script

# Desactivar trap de limpieza (despliegue exitoso)
trap - ERR

# ---------------------------------------------------------
# RESUMEN FINAL
# ---------------------------------------------------------
echo -e "\n======================================================="
echo "DESPLIEGUE FINALIZADO CON ÉXITO!"
echo "======================================================="
echo " INFORMACIÓN DEL PROYECTO:"
echo "   Project ID: $PROJECT_ID"
echo "   Región: $REGION"
echo ""
echo " URLS DE ACCESO:"
echo "   Frontend Web: http://$PUBLIC_IP:5173"
echo "   ChromaDB: http://$PUBLIC_IP:4000"
echo "   API (ALB): http://$ALB_DNS"
echo ""
echo " ARCHIVOS GENERADOS:"
echo "   Configuración: sga-config-$PROJECT_ID.env"
echo "   Limpieza: cleanup-sga-$PROJECT_ID.sh"
echo ""
echo " PRÓXIMOS PASOS:"
echo "   1. Configura tu aplicación usando el archivo .env"
echo "   2. Despliega tus contenedores en ECS Fargate"
echo "   3. Configura ChromaDB en la instancia EC2"
echo ""
echo " LIMPIEZA:"
echo "   Para eliminar todos los recursos: ./cleanup-sga-$PROJECT_ID.sh"
echo "======================================================="
