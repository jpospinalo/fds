import os
from langchain_openai import AzureOpenAIEmbeddings

# Importamos nuestro Centro de Control
from src.config import Config

def obtener_modelo_embeddings():
    """
    Inicializa y retorna la conexión con el modelo de Embeddings.
    Aislado aquí para facilitar futuros cambios de proveedor (ej. pasar a Ollama o Vertex AI).
    """
    print("🧠 Conectando con Azure OpenAI Embeddings...")
    
    return AzureOpenAIEmbeddings(
        azure_deployment=Config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
        openai_api_version=Config.AZURE_OPENAI_API_VERSION,
        azure_endpoint=Config.AZURE_OPENAI_ENDPOINT,
        api_key=Config.AZURE_OPENAI_API_KEY
    )