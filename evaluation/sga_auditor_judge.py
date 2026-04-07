# ==========================================
# RAG-AS-A-JUDGE: AUDITOR AUTOMÁTICO SGA
# Archivo: evaluation/sga_auditor_judge.py
# ==========================================
import os
import re
import pandas as pd
from pathlib import Path
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# Importamos nuestro Centro de Control y el Motor de Búsqueda
from src.config import Config
from src.backend.retriever import buscar_contexto

# ==========================================
# 1. CONFIGURACIÓN DEL JUEZ (LLM)
# ==========================================
def obtener_llm_juez():
    """Inicializa a Gemini en modo estricto (Temperatura 0) para evitar alucinaciones."""
    print("⚖️  Inicializando Juez Auditor (Gemini 2.5 Flash)...")
    return ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite-preview", 
        temperature=0, 
        google_api_key=Config.GOOGLE_API_KEY
    )

# Plantilla estricta para forzar la salida tabular
PROMPT_AUDITOR = PromptTemplate.from_template(
    """Eres un Auditor Experto en Seguridad Química (SGA). 
    Tu tarea es evaluar la Sección {num_seccion} de una Ficha de Datos de Seguridad (FDS) utilizando ESTRICTAMENTE el siguiente instrumento normativo.

    INSTRUMENTO DE EVALUACIÓN (RÚBRICA):
    {rubrica}

    TEXTO EXTRAÍDO DE LA FDS DEL USUARIO:
    {texto_fds}

    INSTRUCCIONES CRÍTICAS:
    1. Lee cuidadosamente el texto de la FDS.
    2. Aplica las reglas del instrumento paso a paso para todos los ítems listados en la tabla del instrumento.
    3. NO inventes información. Si un elemento de la rúbrica no está presente en el texto, evalúalo como 'NO_Conf'.
    4. Tu salida debe ser ÚNICAMENTE el reporte en formato estructurado (TSV/Texto separado por tabulaciones) tal como lo pide la rúbrica. Sin saludos, sin explicaciones extra, y sin bloques de código Markdown (```).
    """
)

# ==========================================
# 2. MOTOR DE AUDITORÍA AUTOMATIZADA
# ==========================================
def auditar_documento_completo(doc_id: str):
    print(f"\n==================================================")
    print(f" INICIANDO AUDITORÍA OFICIAL SGA: {doc_id}")
    print(f"==================================================\n")
    
    llm_juez = obtener_llm_juez()
    cadena_auditoria = PROMPT_AUDITOR | llm_juez
    
    # Aseguramos que exista la carpeta para guardar los reportes
    reportes_dir = Config.DATA_DIR / "evaluation_reports"
    reportes_dir.mkdir(parents=True, exist_ok=True)
    
    # Ruta a tu carpeta de evaluadores
    ruta_rubricas = Config.ROOT_DIR / "evaluadores"
    
    if not ruta_rubricas.exists():
        print(" Error: No se encontró la carpeta 'evaluadores/' con las rúbricas.")
        return

    resultados_totales = {}

    # Iterar sobre todos los archivos .md en la carpeta de evaluadores
    archivos_rubricas = list(ruta_rubricas.glob("instrumento-secci[óo]n-*.md"))
    archivos_rubricas.sort() # Para que evalúe en orden del 1 al 16

    for archivo_rubrica in archivos_rubricas:
        # Extraer el número de la sección del nombre del archivo (Ej: instrumento-sección-2.md -> 2)
        match = re.search(r'secci[óo]n-(\d+)', archivo_rubrica.name, re.IGNORECASE)
        if not match: continue
        
        num_seccion = int(match.group(1))
        print(f" Evaluando Sección {num_seccion}...")
        
        # 1. Leer la ley (Rúbrica)
        with open(archivo_rubrica, 'r', encoding='utf-8') as f:
            texto_rubrica = f.read()
            
        # 2. Buscar la evidencia (Contexto en ChromaDB)
        query_busqueda = f"Contenido de la sección {num_seccion}"
        fragmentos = buscar_contexto(query=query_busqueda, doc_id=doc_id, num_seccion=num_seccion, top_k=10)
        
        if not fragmentos:
            print(f"  No hay datos en la base vectorial para la Sección {num_seccion}.")
            resultados_totales[f"Seccion_{num_seccion}"] = "ERROR: Sección no encontrada en la FDS."
            continue
            
        texto_evidencia = "\n\n".join([f['texto'] for f in fragmentos])
        
        # 3. Emitir Veredicto (Inferencia LLM)
        try:
            respuesta = cadena_auditoria.invoke({
                "num_seccion": num_seccion,
                "rubrica": texto_rubrica,
                "texto_fds": texto_evidencia
            })
            
            veredicto = respuesta.content.strip()
            resultados_totales[f"Seccion_{num_seccion}"] = veredicto
            print(f"   Auditoría Sección {num_seccion} completada.")
            
        except Exception as e:
            print(f"   Error al auditar Sección {num_seccion}: {e}")
            resultados_totales[f"Seccion_{num_seccion}"] = "ERROR: Falló la evaluación del LLM."

    # ==========================================
    # 3. GENERACIÓN DE REPORTE FINAL
    # ==========================================
    ruta_reporte = reportes_dir / f"Auditoria_SGA_{doc_id}.txt"
    with open(ruta_reporte, 'w', encoding='utf-8') as f:
        f.write(f"REPORTE DE AUDITORÍA SGA - {doc_id}\n")
        f.write("="*50 + "\n\n")
        for seccion, veredicto in resultados_totales.items():
            f.write(f"--- {seccion.upper()} ---\n")
            f.write(f"{veredicto}\n\n")
            
    print(f"\n AUDITORÍA FINALIZADA. Reporte guardado en: {ruta_reporte}")
    return ruta_reporte

# ==========================================
# PUNTO DE ENTRADA (PRUEBA)
# ==========================================
if __name__ == "__main__":
    # Pon aquí el nombre exacto de uno de tus documentos guardados en ChromaDB
    DOCUMENTO_PRUEBA = "FDS 22 - Esmalte Uretano AR Comp. B" 
    auditar_documento_completo(DOCUMENTO_PRUEBA)