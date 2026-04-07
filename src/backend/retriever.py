import os
from typing import List, Dict, Any, Optional

# Importamos nuestra configuración y módulos del backend
from src.config import Config
from src.backend.embeddings import obtener_modelo_embeddings
from src.backend.vectorstore import obtener_base_vectorial

def obtener_motor_busqueda():
    """
    Inicializa la conexión de solo lectura a ChromaDB para consultas.
    """
    embeddings = obtener_modelo_embeddings()
    # Reutilizamos la conexión limpia que ya armaste en vectorstore
    return obtener_base_vectorial(embeddings)

# ==========================================
# FUNCIÓN MAESTRA DE RECUPERACIÓN
# ==========================================
def buscar_contexto(
    query: str, 
    doc_id: Optional[str] = None, 
    num_seccion: Optional[int] = None, 
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Realiza una búsqueda híbrida (Semántica + Metadatos) en ChromaDB.
    
    Parámetros:
    - query: La pregunta o intención de búsqueda.
    - doc_id: (Opcional) Fuerza a buscar solo en un PDF específico.
    - num_seccion: (Opcional) Fuerza a buscar solo en una sección exacta (Ej: 2).
    - top_k: Número de fragmentos (chunks) a recuperar.
    """
    vector_db = obtener_motor_busqueda()
    
    # 1. Construir el filtro dinámico de metadatos (La magia del RAG-as-a-Judge)
    filtro_metadata = {}
    condiciones = []
    
    if doc_id:
        condiciones.append({"doc_id": doc_id})
    if num_seccion is not None:
        condiciones.append({"seccion": num_seccion})
        
    if condiciones:
        if len(condiciones) == 1:
            filtro_metadata = condiciones[0]
        else:
            # ChromaDB exige usar la sintaxis $and si hay múltiples filtros
            filtro_metadata = {"$and": condiciones}
            
    print(f" Ejecutando búsqueda vectorial...")
    if filtro_metadata:
        print(f"   Filtros aplicados: {filtro_metadata}")
        
    try:
        # 2. Ejecutar la búsqueda de similitud en el espacio latente
        resultados_brutos = vector_db.similarity_search(
            query=query,
            k=top_k,
            filter=filtro_metadata if filtro_metadata else None
        )
        
        # 3. Formatear la salida para que sea fácil de leer por el LLM Juez
        fragmentos_limpios = []
        for doc in resultados_brutos:
            fragmentos_limpios.append({
                "texto": doc.page_content,
                "metadatos": doc.metadata
            })
            
        print(f" Se recuperaron {len(fragmentos_limpios)} fragmentos de alta relevancia.")
        return fragmentos_limpios
        
    except Exception as e:
        print(f" Error en el Retriever conectando a ChromaDB: {e}")
        return []

# ==========================================
# PRUEBA RÁPIDA DE INTEGRACIÓN
# ==========================================
if __name__ == "__main__":
    print("Iniciando prueba del Retriever...")
    # Simulamos lo que haría el Juez Automático al evaluar la sección 2 de un documento
    # Nota: Asegúrate de cambiar "FDS_Prueba" por el nombre de un doc real que tengas en Chroma
    resultados = buscar_contexto(
        query="Información de peligros y pictogramas SGA",
        doc_id="FDS_Prueba", # <-- Cambia esto si quieres correr el test localmente
        num_seccion=2,
        top_k=3
    )
    
    if resultados:
        print("\nFRAGMENTO TOP 1 RECUPERADO:")
        print(resultados[0]['texto'][:200] + "...\n")