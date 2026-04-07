import re
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import PlainTextResponse
from api.schemas.models import ConvertRequest, ConvertResponse

router = APIRouter(prefix="/convert", tags=["Conversión"])


def txt_to_markdown(texto: str) -> str:
    """
    Convierte texto plano a Markdown inteligente para FDS/SGA.
    Detecta patrones comunes en fichas de seguridad:
    - SECCIÓN X: Título  →  ## Sección X: Título
    - X.Y. Subtítulo     →  ### X.Y Subtítulo
    - Líneas en mayúsculas →  **texto**
    - Listas con guión   →  - elemento
    - Tablas simples     →  | col | col |
    """
    lineas = texto.split("\n")
    resultado = []

    for linea in lineas:
        stripped = linea.strip()

        if not stripped:
            resultado.append("")
            continue

        # SECCIÓN X: Título  →  ## SECCIÓN X: Título
        if re.match(r"^(?:SECCIÓN|SECCION)\s*\d+", stripped, re.IGNORECASE):
            resultado.append(f"## {stripped}")
            continue

        # X.Y.Z. Subtítulo  →  ### X.Y.Z Subtítulo
        if re.match(r"^\d+\.\d+\.?\s+\w", stripped):
            resultado.append(f"### {stripped}")
            continue

        # X. Subtítulo principal
        if re.match(r"^\d+\.\s+[A-ZÁÉÍÓÚÑ]", stripped):
            resultado.append(f"### {stripped}")
            continue

        # Líneas completamente en mayúsculas (títulos sin formato)
        if stripped.isupper() and len(stripped) > 3 and not stripped.startswith("-"):
            resultado.append(f"**{stripped}**")
            continue

        # Listas: líneas que empiezan con - o •
        if stripped.startswith(("- ", "• ", "* ")):
            resultado.append(stripped.replace("• ", "- ").replace("* ", "- "))
            continue

        # Detectar pares Clave: Valor  →  **Clave:** Valor
        match_kv = re.match(r"^([^:]{3,40}):\s+(.+)$", stripped)
        if match_kv:
            clave, valor = match_kv.group(1), match_kv.group(2)
            # Solo si la clave no tiene números (evitar falsos positivos en tablas)
            if not re.search(r"\d{4,}", clave):
                resultado.append(f"**{clave}:** {valor}")
                continue

        resultado.append(stripped)

    # Limpiar saltos de línea excesivos
    texto_md = "\n".join(resultado)
    texto_md = re.sub(r"\n{3,}", "\n\n", texto_md)
    return texto_md.strip()


@router.post("/", response_model=ConvertResponse, summary="Convertir texto plano a Markdown")
def convert_txt_to_md(req: ConvertRequest):
    """
    Convierte texto plano (típicamente copiado de una FDS) a Markdown estructurado.
    Detecta secciones SGA, subtítulos, listas y pares clave-valor automáticamente.
    """
    if not req.texto.strip():
        raise HTTPException(400, "El texto no puede estar vacío")
    md = txt_to_markdown(req.texto)
    return ConvertResponse(
        markdown=md,
        nombre_archivo=req.nombre_archivo or "documento",
    )


@router.post("/upload", summary="Subir archivo .txt y recibir Markdown")
async def upload_txt_file(file: UploadFile = File(...)):
    """
    Acepta un archivo .txt y devuelve el contenido convertido a Markdown.
    """
    if not file.filename.endswith(".txt"):
        raise HTTPException(400, "Solo se aceptan archivos .txt")
    contenido = await file.read()
    texto = contenido.decode("utf-8", errors="replace")
    md = txt_to_markdown(texto)
    nombre = file.filename.replace(".txt", "")
    return ConvertResponse(markdown=md, nombre_archivo=nombre)