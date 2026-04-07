# ==========================================
# REGLAS MAESTRAS DE EXTRACCIÓN (SGA / FDS)
# Archivo: src/ingest/sections_config.py
# ==========================================

REGLAS_SECCIONES = {
    1: {
        "titulo": "Identificación del producto",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*1[\.\:\-]?\s*Identificaci[óo]n",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*2[\.\:\-]?\s*Identificaci[óo]n de los peligros",
        "tipo": "texto_puro"
    },
    2: {
        "titulo": "Identificación de los peligros",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*2[\.\:\-]?\s*Identificaci[óo]n de los peligros",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*3[\.\:\-]?\s*Composici[óo]n",
        "tipo": "multimodal" # Contiene Pictogramas SGA (Rombos rojos)
    },
    3: {
        "titulo": "Composición/información sobre los componentes",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*3[\.\:\-]?\s*Composici[óo]n",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*4[\.\:\-]?\s*(?:Medidas de )?Primeros auxilios",
        "tipo": "texto_puro"
    },
    4: {
        "titulo": "Medidas de primeros auxilios",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*4[\.\:\-]?\s*(?:Medidas de )?Primeros auxilios",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*5[\.\:\-]?\s*Medidas contra incendios",
        "tipo": "texto_puro"
    },
    5: {
        "titulo": "Medidas de lucha contra incendios",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*5[\.\:\-]?\s*Medidas contra incendios",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*6[\.\:\-]?\s*Medidas en caso de vertido",
        "tipo": "texto_puro"
    },
    6: {
        "titulo": "Medidas en caso de vertido accidental",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*6[\.\:\-]?\s*Medidas en caso de vertido",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*7[\.\:\-]?\s*Manipulaci[óo]n",
        "tipo": "texto_puro"
    },
    7: {
        "titulo": "Manipulación y almacenamiento",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*7[\.\:\-]?\s*Manipulaci[óo]n",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*8[\.\:\-]?\s*Controles de exposici[óo]n",
        "tipo": "texto_puro"
    },
    8: {
        "titulo": "Controles de exposición/protección personal",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*8[\.\:\-]?\s*Controles de exposici[óo]n",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*9[\.\:\-]?\s*Propiedades f[íi]sicas",
        "tipo": "multimodal" # Contiene Iconos de EPP (Guantes, Gafas, Máscaras)
    },
    9: {
        "titulo": "Propiedades físicas y químicas",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*9[\.\:\-]?\s*Propiedades f[íi]sicas",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*10[\.\:\-]?\s*Estabilidad",
        "tipo": "texto_puro"
    },
    10: {
        "titulo": "Estabilidad y reactividad",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*10[\.\:\-]?\s*Estabilidad",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*11[\.\:\-]?\s*Informaci[óo]n toxicol[óo]gica",
        "tipo": "texto_puro"
    },
    11: {
        "titulo": "Información toxicológica",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*11[\.\:\-]?\s*Informaci[óo]n toxicol[óo]gica",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*12[\.\:\-]?\s*Informaci[óo]n ecol[óo]gica",
        "tipo": "texto_puro"
    },
    12: {
        "titulo": "Información ecológica",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*12[\.\:\-]?\s*Informaci[óo]n ecol[óo]gica",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*13[\.\:\-]?\s*Consideraciones relativas a la eliminaci[óo]n",
        "tipo": "texto_puro"
    },
    13: {
        "titulo": "Consideraciones relativas a la eliminación",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*13[\.\:\-]?\s*Consideraciones relativas a la eliminaci[óo]n",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*14[\.\:\-]?\s*Informaci[óo]n relativa al transporte",
        "tipo": "texto_puro"
    },
    14: {
        "titulo": "Información relativa al transporte",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*14[\.\:\-]?\s*Informaci[óo]n relativa al transporte",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*15[\.\:\-]?\s*Informaci[óo]n reglamentaria",
        "tipo": "multimodal" # Contiene Rombos de transporte (ONU, DOT, IMDG)
    },
    15: {
        "titulo": "Información reglamentaria",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*15[\.\:\-]?\s*Informaci[óo]n reglamentaria",
        "regex_fin": r"(?:SECCIÓN|SECCION)?\s*16[\.\:\-]?\s*Otra informaci[óo]n",
        "tipo": "texto_puro"
    },
    16: {
        "titulo": "Otras informaciones",
        "regex_inicio": r"(?:SECCIÓN|SECCION)?\s*16[\.\:\-]?\s*Otra informaci[óo]n",
        "regex_fin": r"\Z", # \Z significa "el final absoluto del documento"
        "tipo": "texto_puro"
    }
}