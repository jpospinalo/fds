import os
from api_backend.config import Config

# Importamos ambos proveedores
from langchain_openai import AzureOpenAIEmbeddings
from langchain_ollama import OllamaEmbeddings

def obtener_modelo_embeddings():
    """
    Inicializa y retorna la conexión con el modelo de Embeddings.
    Soporta ejecución local (Ollama) o en la nube (Azure).
    """
    # Verificamos qué proveedor está configurado en el entorno
    provider = getattr(Config, "EMBEDDINGS_PROVIDER", "azure").lower()

    if provider == "ollama":
        print(f"🦙 Conectando con modelo local de Embeddings (Ollama: {Config.OLLAMA_EMBEDDINGS_MODEL})...")
        return OllamaEmbeddings(
            model=Config.OLLAMA_EMBEDDINGS_MODEL,
            base_url=Config.OLLAMA_BASE_URL
        )
    else:
        print("🧠 Conectando con Azure OpenAI Embeddings...")
        return AzureOpenAIEmbeddings(
            azure_deployment=Config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
            openai_api_version=Config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=Config.AZURE_OPENAI_ENDPOINT,
            api_key=Config.AZURE_OPENAI_API_KEY
        )