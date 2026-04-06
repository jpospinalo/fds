import os
import fitz  # PyMuPDF
import boto3
import google.generativeai as genai
from pathlib import Path

# Importamos nuestro Centro de Control
from src.config import Config

# ==========================================
# 1. CONFIGURACIÓN DEL MODELO VISUAL (GEMMA 3)
# ==========================================
# Usamos la misma llave de Google API para invocar a Gemma
genai.configure(api_key=Config.GOOGLE_API_KEY)

# Instanciamos estrictamente Gemma 3 27B (Instruction Tuned)
modelo_vision = genai.GenerativeModel('gemma-3-27b-it') 

def obtener_cliente_s3():
    return boto3.client('s3', 
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        aws_session_token=Config.AWS_SESSION_TOKEN,
        region_name=Config.AWS_REGION
    )

# ==========================================
# 2. PROCESAMIENTO DE IMÁGENES (PyMuPDF)
# ==========================================
def pdf_a_imagenes(ruta_pdf: str, output_dir: Path):
    """Convierte un PDF en una lista de imágenes de alta resolución."""
    doc = fitz.open(ruta_pdf)
    rutas_imagenes = []
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        # Zoom x2 para mayor resolución (crítico para pictogramas pequeños)
        zoom = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=zoom)
        
        ruta_img = output_dir / f"pagina_{page_num + 1}.png"
        pix.save(str(ruta_img))
        rutas_imagenes.append(ruta_img)
        
    doc.close()
    return rutas_imagenes

# ==========================================
# 3. MOTOR TIER 3: AUDITORÍA VISUAL MULTIMODAL
# ==========================================
def procesar_seccion_multimodal(doc_id: str, texto_md: str, num_seccion: int, config_seccion: dict) -> dict:
    """
    Usa Gemma 3 27B para "ver" el PDF y transcribir pictogramas SGA.
    """
    print(f"  Iniciando Auditoría Visual con Gemma 3 para la Sección {num_seccion}...")
    
    s3_client = obtener_cliente_s3()
    temp_dir = Config.DATA_DIR / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    ruta_pdf_local = temp_dir / f"{doc_id}.pdf"
    
    try:
        # 1. Descargar el PDF original desde Bronze
        s3_key_pdf = f"bronze/docs/{doc_id}.pdf"
        s3_client.download_file(Config.S3_BUCKET_NAME, s3_key_pdf, str(ruta_pdf_local))
        
        # 2. Convertir a imágenes
        print("  Extrayendo imágenes de alta resolución del PDF...")
        rutas_imagenes = pdf_a_imagenes(str(ruta_pdf_local), temp_dir)
        
        # 3. Cargar imágenes a la API
        archivos_subidos = []
        for img_path in rutas_imagenes:
            uploaded_file = genai.upload_file(path=str(img_path))
            archivos_subidos.append(uploaded_file)
            
        # 4. Prompt Multimodal para Gemma 3
        titulo = config_seccion['titulo']
        prompt = f"""
        Eres un experto en normativa SGA y lectura de Fichas de Datos de Seguridad.
        Se te han proporcionado las imágenes de un documento completo.
        
        Tu tarea es buscar y extraer ÚNICAMENTE la 'Sección {num_seccion}: {titulo}'.
        
        REGLA CRÍTICA DE VISIÓN:
        Si encuentras pictogramas del SGA (rombos con borde rojo), iconos de uso de EPP (guantes, gafas) o rombos NFPA, DEBES transcribirlos en el texto usando el siguiente formato exacto:
        [PICTOGRAMA: <descripción del dibujo>]
        Ejemplo: [PICTOGRAMA: Llama sobre círculo (Comburente)] o [PICTOGRAMA: Uso obligatorio de guantes].
        
        Devuelve el contenido en formato Markdown, conservando viñetas y tablas.
        """
        
        # 5. Ejecutar inferencia con Gemma 3
        print("  Procesando visión computacional con Gemma 3 27B...")
        response = modelo_vision.generate_content([prompt] + archivos_subidos)
        contenido = response.text.strip()
        
        # 6. Limpiar archivos de la nube
        for f in archivos_subidos:
            genai.delete_file(f.name)
            
        return {
            "doc_id": doc_id,
            "seccion": num_seccion,
            "metodo_extraccion": "Visión Multimodal (Gemma 3 - Tier 3)",
            "confianza": 0.95,
            "notas_auditoria": "Imágenes analizadas y pictogramas transcritos con éxito.",
            "contenido": contenido
        }
        
    except Exception as e:
        print(f" Error en Auditoría Visual con Gemma: {e}")
        return None
        
    finally:
        if ruta_pdf_local.exists():
            ruta_pdf_local.unlink()
        for img_path in temp_dir.glob("pagina_*.png"):
            img_path.unlink()