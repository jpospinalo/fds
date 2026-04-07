import os
import json
import boto3
from pathlib import Path

# Importamos nuestra configuración y herramientas
from src.config import Config
from src.ingest.sections_config import REGLAS_SECCIONES
from src.ingest.extractors import procesar_seccion_texto
# from src.ingest.vision_enricher import procesar_seccion_multimodal  <-- Lo importaremos cuando lo creemos

def obtener_cliente_s3():
    return boto3.client('s3', 
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        aws_session_token=Config.AWS_SESSION_TOKEN,
        region_name=Config.AWS_REGION
    )

def procesar_capa_silver():
    print(" Iniciando Pipeline Silver: Orquestación de 16 Secciones")
    s3_client = obtener_cliente_s3()
    
    # 1. Buscar todas las cápsulas en Bronce (.md)
    paginator = s3_client.get_paginator('list_objects_v2')
    documentos_bronce = []
    for page in paginator.paginate(Bucket=Config.S3_BUCKET_NAME, Prefix=Config.S3_PREFIX_BRONCE):
        if 'Contents' in page:
            for obj in page['Contents']:
                if obj['Key'].endswith('.md'):
                    documentos_bronce.append(obj['Key'])

    # 2. Procesar documento por documento
    for s3_key in documentos_bronce:
        doc_id = os.path.basename(s3_key).replace('.md', '')
        print(f"\n Extrayendo conocimiento de: {doc_id}")
        
        # Descargar el Markdown a memoria
        response = s3_client.get_object(Bucket=Config.S3_BUCKET_NAME, Key=s3_key)
        texto_md = response['Body'].read().decode('utf-8')
        
        # 3. Iterar automáticamente por las 16 secciones
        for num_seccion, reglas in REGLAS_SECCIONES.items():
            resultado_json = None
            
            if reglas["tipo"] == "texto_puro":
                # Llama al motor que ya construimos (Regex + Gemini)
                resultado_json = procesar_seccion_texto(doc_id, texto_md, num_seccion, reglas)
                
            elif reglas["tipo"] == "multimodal":
                # Llama al motor visual (Aún por construir)
                print(f" Sección {num_seccion} requiere Auditoría Visual (Pendiente...)")
                # resultado_json = procesar_seccion_multimodal(doc_id, texto_md, num_seccion, reglas)
                continue

            # 4. Si la extracción fue exitosa, subir a la subcarpeta correcta en Silver
            if resultado_json:
                # La magia: Guarda en silver/seccion_1/, silver/seccion_2/, etc.
                ruta_s3_destino = f"{Config.S3_PREFIX_SILVER}seccion_{num_seccion}/{doc_id}.jsonl"
                
                # Subir directamente a S3 sin crear archivos locales intermedios
                s3_client.put_object(
                    Bucket=Config.S3_BUCKET_NAME,
                    Key=ruta_s3_destino,
                    Body=json.dumps(resultado_json, ensure_ascii=False).encode('utf-8')
                )
                print(f" Guardado en Capa Silver: {ruta_s3_destino}")

if __name__ == "__main__":
    procesar_capa_silver()