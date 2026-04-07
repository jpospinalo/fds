import os
import re
import json
import time
from typing import Optional
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# Importamos el Centro de Control
from src.config import Config

# ==========================================
# 1. CONFIGURACIÓN DEL LLM (TIER 2)
# ==========================================
# Usamos Flash-Lite para mantener el costo bajo en la extracción masiva
llm_extractor = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite-preview", 
    temperature=0, # Estricto, sin creatividad
    google_api_key=Config.GOOGLE_API_KEY
)

# Definimos la estructura de salida que LangChain obligará a cumplir a Gemini
class SeccionExtraida(BaseModel):
    contenido: str = Field(description="El texto exacto extraído para esta sección, respetando el formato Markdown original.")
    confianza: float = Field(description="Nivel de confianza de la extracción del 0.0 al 1.0")
    notas: str = Field(description="Cualquier anomalía detectada. Si todo está bien, devuelve 'OK'.")

# ==========================================
# 2. MOTOR TIER 1: REGEX (Rápido y Costo $0)
# ==========================================
def extraer_con_regex(texto_md: str, patron_inicio: str, patron_fin: str) -> Optional[str]:
    """
    Intenta recortar la sección usando expresiones regulares.
    Retorna el texto si tiene éxito, o None si el formato está roto.
    """
    try:
        # Busca todo lo que hay entre el título de inicio y el título de la siguiente sección
        patron = rf"({patron_inicio}.*?)(?={patron_fin}|\Z)"
        resultado = re.search(patron, texto_md, re.IGNORECASE | re.DOTALL)
        
        if resultado and len(resultado.group(1).strip()) > 50: # Validar que no capturó un bloque vacío
            return resultado.group(1).strip()
        return None
    except Exception as e:
        print(f" Regex falló: {e}")
        return None

# ==========================================
# 3. MOTOR TIER 2: GEMINI FLASH (Fallback Semántico)
# ==========================================
def extraer_con_llm(texto_md: str, num_seccion: int, titulo_seccion: str) -> dict:
    """
    Si la Regex falla, el LLM lee el documento completo y extrae la sección entendiendo el contexto.
    (Consume tokens, pero salva el documento de ir a Cuarentena).
    """
    prompt = PromptTemplate.from_template(
        """Eres un experto en normativas SGA y Fichas de Datos de Seguridad (FDS).
        Tu tarea es extraer ÚNICAMENTE la 'Sección {num_seccion}: {titulo_seccion}' del siguiente documento Markdown.
        
        REGLAS:
        1. Copia el texto exactamente como está, respetando las tablas y viñetas en Markdown.
        2. NO incluyas información de la sección anterior ni de la siguiente.
        3. Si la sección está vacía o dice "No aplica", extráelo igual.

        DOCUMENTO:
        {documento}
        """
    )
    
    # Vinculamos el prompt con el LLM y forzamos la salida estructurada con Pydantic
    cadena = prompt | llm_extractor.with_structured_output(SeccionExtraida)
    
    # Ejecutamos (con reintentos en caso de saturación de API)
    for intento in range(3):
        try:
            resultado_estructurado = cadena.invoke({
                "num_seccion": num_seccion,
                "titulo_seccion": titulo_seccion,
                "documento": texto_md
            })
            return resultado_estructurado.dict()
        except Exception as e:
            print(f" Límite de API o error. Reintentando ({intento+1}/3)...")
            time.sleep(5) # Pausa activa
            
    raise Exception("El LLM falló repetidamente. Documento enviado a Cuarentena.")

# ==========================================
# 4. FUNCIÓN PRINCIPAL DE EXTRACCIÓN
# ==========================================
def procesar_seccion_texto(doc_id: str, texto_md: str, num_seccion: int, config_seccion: dict) -> dict:
    """
    Aplica el pipeline híbrido (Tier 1 -> Tier 2) para aislar la sección.
    """
    print(f"  Analizando Sección {num_seccion}...")
    
    # Intento 1: Regex (Costo cero)
    contenido = extraer_con_regex(
        texto_md, 
        config_seccion['regex_inicio'], 
        config_seccion['regex_fin']
    )
    
    metodo_usado = "Regex"
    notas = "Extracción perfecta por reglas."
    confianza = 1.0

    # Intento 2: LLM (Si Regex devolvió None)
    if not contenido:
        print(f" Formato roto detectado. Activando Tier 2 (Gemini) para Sección {num_seccion}...")
        respuesta_llm = extraer_con_llm(texto_md, num_seccion, config_seccion['titulo'])
        
        contenido = respuesta_llm['contenido']
        confianza = respuesta_llm['confianza']
        notas = respuesta_llm['notas']
        metodo_usado = "LLM (Gemini Flash)"

    # Ensamblamos el JSON final para la Capa Silver
    return {
        "doc_id": doc_id,
        "seccion": num_seccion,
        "metodo_extraccion": metodo_usado,
        "confianza": confianza,
        "notas_auditoria": notas,
        "contenido": contenido
    }