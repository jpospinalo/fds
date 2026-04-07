import os
import json
import boto3
import chromadb
from langchain_chroma import Chroma

# Importamos nuestro Centro de Control y nuestro nuevo módulo de Embeddings
from src.config import Config
from src.backend.embeddings import obtener_modelo_embeddings

def obtener_cliente_s3():
    return boto3.client('s3', 
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        aws_session_token=Config.AWS_SESSION_TOKEN,
        region_name=Config.AWS_REGION
    )

# ==========================================
# 1. CONEXIÓN AL SERVIDOR CHROMADB (EC2)
# ==========================================
def obtener_base_vectorial(embeddings_model):
    """Se conecta al servidor HTTP remoto de ChromaDB."""
    print(f"🔌 Conectando a ChromaDB en {Config.CHROMA_SERVER_HOST}:{Config.CHROMA_SERVER_PORT}...")
    chroma_client = chromadb.HttpClient(
        host=Config.CHROMA_SERVER_HOST, 
        port=Config.CHROMA_SERVER_PORT
    )
    
    return Chroma(
        client=chroma_client, 
        collection_name=Config.CHROMA_COLLECTION_NAME, 
        embedding_function=embeddings_model
    )

# ==========================================
# 2. UTILIDAD: APLANAR METADATOS
# ==========================================
def aplanar_metadatos(metadatos_crudos: dict) -> dict:
    """
    ChromaDB es estricto: los metadatos solo pueden ser strings, ints, floats o bools.
    """
    metadatos_limpios = {}
    for key, value in metadatos_crudos.items():
        if isinstance(value, (str, int, float, bool)):
            metadatos_limpios[key] = value
        elif value is None:
            metadatos_limpios[key] = ""
        else:
            metadatos_limpios[key] = str(value)
    return metadatos_limpios

# ==========================================
# 3. ORQUESTADOR MAESTRO (INGESTA VECTORIAL)
# ==========================================
def procesar_ingesta_vectorial():
    print(" Iniciando Pipeline Vectorial: Gold -> ChromaDB")
    
    s3_client = obtener_cliente_s3()
    
    # ¡AQUÍ ESTÁ LA MAGIA MODULAR! Llamamos a nuestro nuevo archivo:
    embeddings = obtener_modelo_embeddings()
    vector_db = obtener_base_vectorial(embeddings)
    
    # 1. Buscar archivos JSONL en la Capa Gold
    paginator = s3_client.get_paginator('list_objects_v2')
    archivos_gold = []
    
    for page in paginator.paginate(Bucket=Config.S3_BUCKET_NAME, Prefix=Config.S3_PREFIX_GOLD):
        if 'Contents' in page:
            for obj in page['Contents']:
                if obj['Key'].endswith('.jsonl'):
                    archivos_gold.append(obj['Key'])

    if not archivos_gold:
        print(" No se encontraron archivos en la Capa Gold para vectorizar.")
        return

    # 2. Procesar documento por documento
    for s3_key in archivos_gold:
        doc_id = os.path.basename(s3_key).replace('_chunks.jsonl', '')
        print(f"\n Vectorizando e ingestando: {doc_id}...")
        
        response = s3_client.get_object(Bucket=Config.S3_BUCKET_NAME, Key=s3_key)
        contenido = response['Body'].read().decode('utf-8')
        
        textos = []
        metadatos_lista = []
        ids = []
        
        # Leer línea por línea el JSONL
        for linea in contenido.strip().split('\n'):
            if not linea: continue
            chunk_data = json.loads(linea)
            
            textos.append(chunk_data['texto'])
            metadatos_lista.append(aplanar_metadatos(chunk_data))
            ids.append(chunk_data['chunk_id'])
            
        if textos:
            try:
                vector_db.add_texts(
                    texts=textos,
                    metadatas=metadatos_lista,
                    ids=ids
                )
                print(f"  Exito. {len(textos)} vectores guardados en ChromaDB.")
            except Exception as e:
                print(f"  Error ingestando {doc_id} en Chroma: {e}")

if __name__ == "__main__":
    procesar_ingesta_vectorial()