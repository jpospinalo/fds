import os
from pathlib import Path
from dotenv import load_dotenv

# Forzar la carga del .env desde la raíz del proyecto
# Esto asegura que sin importar desde dónde ejecutes el script, encuentre las variables
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env", override=True)

class Config:
    # Rutas Locales
    ROOT_DIR = ROOT_DIR
    DATA_DIR = ROOT_DIR / "data"
    
    # Credenciales AWS
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_SESSION_TOKEN = os.getenv("AWS_SESSION_TOKEN")
    AWS_REGION = os.getenv("AWS_REGION")
    
    # Configuración S3
    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
    S3_PREFIX_BRONCE = "bronze/processed/"
    S3_PREFIX_SILVER = "silver/"
    S3_PREFIX_GOLD = "gold/"
    S3_PREFIX_QUARANTINE = "Quarantine/"
    
    # --- PROVEEDOR DE EMBEDDINGS ---
    # Puede ser 'azure' u 'ollama'
    EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "azure")

    # --- CONFIGURACIÓN OLLAMA ---
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_EMBEDDINGS_MODEL = os.getenv("OLLAMA_EMBEDDINGS_MODEL", "nomic-embed-text")
    
    
    # Credenciales Azure OpenAI (Embeddings)
    EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "azure")
    AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
    AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT")
    
    
    # --- CONFIGURACIÓN OLLAMA ---
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_EMBEDDINGS_MODEL = os.getenv("OLLAMA_EMBEDDINGS_MODEL", "nomic-embed-text")
    
    # Credenciales Google (Gemini / Gemma)
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    
    # ChromaDB EC2
    CHROMA_SERVER_HOST = os.getenv("CHROMA_SERVER_HOST")
    CHROMA_SERVER_PORT = os.getenv("CHROMA_SERVER_PORT")
    CHROMA_COLLECTION_NAME = "fds_quimicos"

# Verificación rápida al importar
if not Config.AZURE_OPENAI_API_KEY:
    print("⚠️ ADVERTENCIA: No se cargaron las credenciales de Azure desde el .env")