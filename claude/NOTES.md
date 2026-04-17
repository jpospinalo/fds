# NOTES — Sesión 2026-04-16

## Qué se hizo

### Infraestructura Claude
- Creados `claude/CLAUDE.md`, `claude/STRUCTURE.md`, `claude/IGNORE_PATHS.md`, `claude/NOTES.md`, `claude/RULES.md`

### Bug crítico corregido: frontend no conectaba al backend
- `client.ts` tenía `BASE_URL = "http://localhost:8000"` → CORS bloqueaba peticiones del browser
- `vite.config.ts` usaba `loadEnv(mode, cwd, "")` que leía variables del sistema; `VITE_API_URL` estaba seteada con el endpoint de Azure → proxy apuntaba a Azure
- Fix: `BASE_URL = ""`, proxy hardcodeado a `localhost:8000`, eliminado `loadEnv`

### Implementación PLAN.md (primera versión)
1. **Caché SQLite** (`cache/audit_store.py`): persiste resultados de auditoría entre reinicios. Prioridad de lectura: memoria → SQLite → TXT legacy
2. **Estado de secciones en Home**: badges coloreados para las 16 secciones. Grises sin auditoría; verde/amarillo/rojo según cobertura auditada leída desde SQLite
3. **Visor de contenido en auditoría**: botón "Ver contenido §N" en cada sección; carga desde `/api/documents/{doc_id}/section/{n}`
4. **Mejora de descargas**: TXT tabla alineada, CSV con 5 columnas, MD con tabla por sección + emojis

### Multi-entorno (local + EC2)
- `client.ts`: `BASE_URL = import.meta.env.VITE_API_URL ?? ""`
- `.env.development`: sin `VITE_API_URL` → usa proxy Vite
- `.env.production`: `VITE_API_URL=http://IP_EC2:8000` → llamadas directas al backend
- `.env.production` agregado a `.gitignore`

## Estado al cerrar
- Backend y frontend funcionando en local
- Caché SQLite activa
- Pendiente: actualizar `VITE_API_URL` en `.env.production` con la IP real de EC2 antes del siguiente deploy
