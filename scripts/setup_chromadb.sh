#!/bin/bash

set -e

echo " Iniciando setup de ChromaDB..."

# Variables (puedes cambiarlas)

USER_HOME="/home/ubuntu"
APP_DIR="$USER_HOME/chromadb"
VENV_DIR="$USER_HOME/venv"
PORT=4000

echo " Creando directorio de datos..."
mkdir -p $APP_DIR

echo " Creando entorno virtual..."
python3 -m venv $VENV_DIR

echo " Activando entorno e instalando ChromaDB..."
source $VENV_DIR/bin/activate
pip install --upgrade pip
pip install chromadb

echo " Verificando instalación..."
CHROMA_PATH=$(which chroma)

if [ -z "$CHROMA_PATH" ]; then
echo " Error: chroma no se instaló correctamente"
exit 1
fi

echo "Chroma encontrado en: $CHROMA_PATH"

echo " Creando servicio systemd..."

sudo bash -c "cat > /etc/systemd/system/chromadb.service" <<EOL
[Unit]
Description=ChromaDB Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=$APP_DIR
ExecStart=$CHROMA_PATH run --host 0.0.0.0 --port $PORT --path $APP_DIR
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOL

echo " Recargando systemd..."
sudo systemctl daemon-reload

echo " Habilitando servicio..."
sudo systemctl enable chromadb

echo " Iniciando servicio..."
sudo systemctl start chromadb

echo " Estado del servicio:"
sudo systemctl status chromadb --no-pager

echo " ChromaDB está corriendo en puerto $PORT"
echo " Prueba: curl [http://localhost:$PORT/api/v1/heartbeat](http://localhost:$PORT/api/v1/heartbeat)"
