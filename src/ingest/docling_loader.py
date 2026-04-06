import os
import time
import boto3
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from src.config import Config

# ==========================================
# 1. INICIALIZACIÓN DE SERVICIOS
# ==========================================
def obtener_cliente_s3():
    """Inicializa y retorna el cliente de S3 usando la configuración central."""
    return boto3.client(
        's3',
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        aws_session_token=Config.AWS_SESSION_TOKEN,
        region_name=Config.AWS_REGION
    )

def inicializar_docling():
    """Configura Docling en modo ligero (sin extracción de imágenes físicas)."""
    print(" Inicializando motor Docling (Modo Ligero)...")
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_picture_images = False
    
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
    )

# ==========================================
# 2. FUNCIONES DE LECTURA EN S3
# ==========================================
def obtener_archivos_s3(s3_client, prefijo):
    """Devuelve una lista de rutas de PDFs en el bucket de origen."""
    archivos = []
    paginator = s3_client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=Config.S3_BUCKET_NAME, Prefix=prefijo):
        if 'Contents' in page:
            for obj in page['Contents']:
                if not obj['Key'].endswith('/'):
                    archivos.append(obj['Key'])
    return archivos

def obtener_carpetas_procesadas(s3_client):
    """Obtiene los nombres de los documentos que ya tienen su cápsula en Bronce."""
    carpetas = set()
    paginator = s3_client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=Config.S3_BUCKET_NAME, Prefix=Config.S3_PREFIX_BRONCE, Delimiter='/'):
        if 'CommonPrefixes' in page:
            for prefix in page['CommonPrefixes']:
                # Ej: 'bronze/processed/FDS_1/' -> 'FDS_1'
                nombre_carpeta = prefix['Prefix'].replace(Config.S3_PREFIX_BRONCE, '').strip('/')
                carpetas.add(nombre_carpeta)
    return carpetas

# ==========================================
# 3. ORQUESTADOR MAESTRO (INGESTA)
# ==========================================
def procesar_pipeline_ingesta():
    print("Iniciando Pipeline: Ingesta -> Bronce (Estructura Docling Ligera)")
    
    # Aseguramos que exista una carpeta temporal local usando nuestra ruta segura
    temp_dir = Config.DATA_DIR / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    s3_client = obtener_cliente_s3()
    doc_converter = inicializar_docling()

    pdfs_en_docs = obtener_archivos_s3(s3_client, "bronze/docs/") # Asegúrate de que este prefijo sea el correcto
    carpetas_en_bronce = obtener_carpetas_procesadas(s3_client)

    for s3_key in pdfs_en_docs:
        nombre_pdf = os.path.basename(s3_key)
        nombre_base = nombre_pdf.replace('.pdf', '')

        # Idempotencia: Saltar si ya está en Bronce
        if nombre_base in carpetas_en_bronce:
            print(f"Saltando: {nombre_pdf} (Carpeta ya existe en Bronce)")
            continue

        print(f"\n Descargando: {nombre_pdf}...")
        local_pdf_path = temp_dir / nombre_pdf
        local_md_path = temp_dir / f"{nombre_base}.md"
        
        s3_client.download_file(Config.S3_BUCKET_NAME, s3_key, str(local_pdf_path))

        print(f" Procesando con Docling: {nombre_pdf}...")
        tiempo_inicio = time.perf_counter()

        try:
            # 1. Extraer con Docling
            resultado = doc_converter.convert(str(local_pdf_path))

            # 2. Convertir a Markdown
            md_texto = resultado.document.export_to_markdown()

            # 3. Guardar temporalmente
            with open(local_md_path, 'w', encoding='utf-8') as f:
                f.write(md_texto)

            # 4. Subir a S3 (Ej: bronze/processed/FDS_1/FDS_1.md)
            ruta_s3_destino = f"{Config.S3_PREFIX_BRONCE}{nombre_base}/{nombre_base}.md"
            s3_client.upload_file(str(local_md_path), Config.S3_BUCKET_NAME, ruta_s3_destino)

            tiempo_fin = time.perf_counter() - tiempo_inicio
            print(f"  Exito. Cápsula '{nombre_base}/' creada en {tiempo_fin:.2f} seg.")

        except Exception as e:
            print(f"  Error procesando {nombre_pdf}: {e}")

        finally:
            # Limpieza local
            if local_md_path.exists():
                local_md_path.unlink()
            if local_pdf_path.exists():
                local_pdf_path.unlink()

    print("\n PIPELINE INGESTA (BRONCE) COMPLETADO.")

# ==========================================
# PUNTO DE ENTRADA DEL SCRIPT
# ==========================================
if __name__ == "__main__":
    procesar_pipeline_ingesta()