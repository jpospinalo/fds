import os
import json
import boto3
from collections import defaultdict
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

# Importamos nuestro Centro de Control
from src.config import Config

def obtener_cliente_s3():
    return boto3.client('s3', 
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        aws_session_token=Config.AWS_SESSION_TOKEN,
        region_name=Config.AWS_REGION
    )

# ==========================================
# 1. CONFIGURACIÓN DE LOS SPLITTERS (LANGCHAIN)
# ==========================================
# Le enseñamos al sistema cómo reconocer la jerarquía de títulos en Markdown
headers_to_split_on = [
    ("#", "Titulo_Principal"),
    ("##", "Subtitulo_1"),
    ("###", "Subtitulo_2"),
]

markdown_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=headers_to_split_on,
    strip_headers=False # Mantenemos el título en el texto para no perder contexto semántico
)

# Configuramos el tamaño exacto del "bocado" que le daremos a la base vectorial
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=3000, 
    chunk_overlap=300, # Solapamiento para no cortar ideas por la mitad
    separators=["\n\n", "\n", ".", " ", ""]
)

# ==========================================
# 2. AGRUPADOR DE DOCUMENTOS (RECOLECTOR SILVER)
# ==========================================
def agrupar_secciones_por_documento(s3_client):
    """Busca en toda la Capa Silver y agrupa las secciones que pertenecen al mismo PDF."""
    print(" Escaneando la Capa Silver...")
    documentos = defaultdict(list)
    
    paginator = s3_client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=Config.S3_BUCKET_NAME, Prefix=Config.S3_PREFIX_SILVER):
        if 'Contents' in page:
            for obj in page['Contents']:
                if obj['Key'].endswith('.jsonl'):
                    # Extraer el doc_id del nombre del archivo (Ej: silver/seccion_2/FDS_Pintura.jsonl -> FDS_Pintura)
                    doc_id = os.path.basename(obj['Key']).replace('.jsonl', '')
                    documentos[doc_id].append(obj['Key'])
                    
    return documentos

# ==========================================
# 3. MOTOR TIER 4: CHUNKING SEMÁNTICO (GOLD)
# ==========================================
def procesar_chunking_gold():
    print(" Iniciando Pipeline Gold: Chunking Semántico")
    s3_client = obtener_cliente_s3()
    
    documentos_agrupados = agrupar_secciones_por_documento(s3_client)
    
    if not documentos_agrupados:
        print(" No se encontraron documentos procesados en la Capa Silver.")
        return

    for doc_id, rutas_secciones in documentos_agrupados.items():
        print(f"\n Ensamblando y cortando documento: {doc_id}...")
        
        # 1. Unificar el documento reconstruyéndolo desde sus partes
        texto_unificado = f"# {doc_id}\n\n"
        
        # Ordenamos las rutas para asegurarnos de que la sección 1 vaya antes que la 2
        rutas_secciones.sort() 
        
        for ruta in rutas_secciones:
            response = s3_client.get_object(Bucket=Config.S3_BUCKET_NAME, Key=ruta)
            datos_seccion = json.loads(response['Body'].read().decode('utf-8'))
            texto_unificado += f"\n\n{datos_seccion['contenido']}\n\n"
            
        # 2. Primer Corte: Por jerarquía de títulos (Markdown)
        md_splits = markdown_splitter.split_text(texto_unificado)
        
        # 3. Segundo Corte: Por tamaño (para evitar desbordar el LLM después)
        chunks_finales = text_splitter.split_documents(md_splits)
        
        # 4. Formatear y enriquecer metadatos
        chunks_jsonl = []
        for i, chunk in enumerate(chunks_finales):
            metadatos = chunk.metadata
            metadatos['doc_id'] = doc_id
            metadatos['chunk_id'] = f"{doc_id}_chunk_{i}"
            
            # Determinamos a qué sección pertenece este chunk buscando la palabra "Sección X"
            import re
            match_seccion = re.search(r'(?:SECCIÓN|SECCION)\s*(\d+)', chunk.page_content, re.IGNORECASE)
            metadatos['seccion'] = int(match_seccion.group(1)) if match_seccion else 0
            
            chunk_dict = {
                "chunk_id": metadatos['chunk_id'],
                "doc_id": metadatos['doc_id'],
                "seccion": metadatos['seccion'],
                "metadatos_jerarquia": metadatos,
                "texto": chunk.page_content
            }
            # Guardamos cada chunk como un string JSON
            chunks_jsonl.append(json.dumps(chunk_dict, ensure_ascii=False))
            
        # 5. Subir a S3 (Capa Gold)
        contenido_archivo = "\n".join(chunks_jsonl)
        ruta_s3_destino = f"{Config.S3_PREFIX_GOLD}{doc_id}_chunks.jsonl"
        
        s3_client.put_object(
            Bucket=Config.S3_BUCKET_NAME,
            Key=ruta_s3_destino,
            Body=contenido_archivo.encode('utf-8')
        )
        print(f" {len(chunks_finales)} Chunks generados y guardados en: {ruta_s3_destino}")

if __name__ == "__main__":
    procesar_chunking_gold()