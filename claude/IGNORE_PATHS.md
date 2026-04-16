# IGNORE_PATHS.md

Rutas que Claude Code debe evitar analizar para optimizar el uso de tokens.
Estas rutas contienen dependencias de terceros, artefactos generados, datos binarios o archivos de entorno que no aportan valor al análisis de código.

## Entornos virtuales Python

- `env/`
- `apps/env/`
- `venv/`
- `.venv/`

## Dependencias Node.js

- `node_modules/`
- `apps/frontend/node_modules/`
- `frontend/node_modules/`

## Artefactos generados / caché Python

- `**/__pycache__/`
- `**/*.pyc`
- `**/*.pyo`
- `src/__pycache__/`
- `src/backend/__pycache__/`
- `api/__pycache__/`
- `api/routers/__pycache__/`
- `api/schemas/__pycache__/`

## Datos locales temporales (Medallón)

- `data/bronze/`
- `data/silver/`
- `data/gold/`
- `data/evaluation_reports/`
- `apps/data/temp_uploads/`

## Imágenes y binarios de documentación

- `docs/images/`

## Lock files (no editables manualmente)

- `package-lock.json`
- `apps/package-lock.json`
- `apps/frontend/package-lock.json`
- `frontend/package-lock.json`

## Git

- `.git/`

## Notebooks (solo lectura de referencia, no análisis profundo)

- `notebooks/bronce2silver_seccion*.ipynb`  ← 16 notebooks similares, leer uno es suficiente
