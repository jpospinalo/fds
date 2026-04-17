# RULES

## Frontend / Vite

- **No usar `loadEnv` con prefijo `""` en `vite.config.ts`** — carga todas las variables del sistema y puede contaminar targets del proxy con valores incorrectos (ej. `VITE_API_URL` apuntando a Azure).
- **El proxy de Vite solo aplica en dev**; en producción el frontend usa `import.meta.env.VITE_API_URL`. Si no está definida, `BASE_URL = ""` y se espera un reverse proxy (nginx u otro) delante.
- **Nunca hardcodear URLs de backend en `client.ts`** — usar `import.meta.env.VITE_API_URL ?? ""`.
- **Antes de diagnosticar CORS**, verificar primero si el proxy de Vite está activo y si el `BASE_URL` del cliente pasa por él o va directo al backend.

## Backend / FastAPI

- **CORS debe incluir siempre `http://localhost:5173`** para desarrollo local. Las URLs de EC2 van además.
- **No poner `http://http://...`** — doble protocolo es URL inválida y silencia el origen en CORS.
- **El módulo backend se importa como `api_backend.*`** porque el servidor se lanza con `--app-dir apps`. Si se lanza desde otro directorio los imports fallan.

## Entornos (local vs EC2)

- **Variables de entorno que afectan el build del frontend** van en `apps/frontend/.env.development` o `.env.production`, nunca en el `.env` raíz del proyecto (ese es para Python/backend).
- **`.env.production` debe estar en `.gitignore`** — contiene la IP real de EC2.
- **Para desplegar en EC2**: editar `VITE_API_URL` en `.env.production` y luego `npm run build`. El valor queda horneado en el bundle.

## Caché / Persistencia

- **`_audit_cache` (dict en memoria) se pierde al reiniciar el backend** — siempre complementar con SQLite (`audit_store`) para persistencia real.
- **No guardar `reporte_txt` en SQLite** — ya está en disco como `.txt`; duplicarlo desperdicia espacio. Adjuntarlo al devolver la respuesta leyéndolo desde disco.
- **Orden de lectura en `get_audit_results`**: memoria → SQLite → TXT legacy (migra a SQLite al leerlo).

## Diagnóstico

- Ante un 404 en `localhost:5173/api/...`, verificar con `curl http://localhost:8000/api/...` primero. Si el backend responde bien, el problema es el proxy de Vite, no el backend.
- Verificar qué proceso corre en el puerto con `ss -tlnp | grep PORT` y su directorio con `ls -la /proc/PID/cwd`.
- Variables de entorno activas en un proceso: `strings /proc/PID/environ | grep NOMBRE_VAR`.
