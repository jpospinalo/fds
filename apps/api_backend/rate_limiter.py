import json
import os
import threading
import time
from collections import deque
from datetime import date
from pathlib import Path

_lock = threading.Lock()

RPM_LIMIT: int = int(os.getenv("GEMINI_RPM_LIMIT", "15"))
TPM_LIMIT: int = int(os.getenv("GEMINI_TPM_LIMIT", "250000"))
RPD_LIMIT: int = int(os.getenv("GEMINI_RPD_LIMIT", "500"))
RPD_CAP: int = int(os.getenv("GEMINI_RPD_CAP", "380"))
CALLS_PER_DOC: int = 4  # SECCIONES_OBJETIVO tiene 4 secciones

_rpm: deque = deque()       # timestamps monotónicos
_tpm: deque = deque()       # (timestamp, tokens)
_rpd_count: int = 0
_rpd_date: date = date.today()

_STATE_FILE = Path(__file__).parent.parent / "data" / "gemini_rate_state.json"


def _load() -> None:
    global _rpd_count, _rpd_date
    try:
        if _STATE_FILE.exists():
            d = json.loads(_STATE_FILE.read_text())
            saved = date.fromisoformat(d["date"])
            if saved == date.today():
                _rpd_count = int(d.get("rpd", 0))
                _rpd_date = saved
                return
    except Exception:
        pass
    _rpd_count = 0
    _rpd_date = date.today()


def _save() -> None:
    try:
        _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _STATE_FILE.write_text(json.dumps({"date": _rpd_date.isoformat(), "rpd": _rpd_count}))
    except Exception:
        pass


def _clean(now: float) -> None:
    cutoff = now - 60
    while _rpm and _rpm[0] < cutoff:
        _rpm.popleft()
    while _tpm and _tpm[0][0] < cutoff:
        _tpm.popleft()


def record_call(tokens: int = 0) -> None:
    global _rpd_count, _rpd_date
    now = time.monotonic()
    today = date.today()
    with _lock:
        if today != _rpd_date:
            _rpd_count = 0
            _rpd_date = today
        _rpd_count += 1
        _rpm.append(now)
        if tokens > 0:
            _tpm.append((now, tokens))
        _save()


def get_status() -> dict:
    global _rpd_count, _rpd_date
    now = time.monotonic()
    today = date.today()
    with _lock:
        if today != _rpd_date:
            _rpd_count = 0
            _rpd_date = today
        _clean(now)
        rpm = len(_rpm)
        rpd = _rpd_count
        tpm = sum(t for _, t in _tpm)

    rpd_restante = max(0, RPD_CAP - rpd)
    docs_restantes = rpd_restante // CALLS_PER_DOC
    rpm_warn = max(1, RPM_LIMIT - 2)
    rpd_warn = int(RPD_CAP * 0.85)

    if rpd >= RPD_CAP:
        nivel = "bloqueado"
        mensaje = f"Cuota diaria agotada ({rpd}/{RPD_CAP}). Reintentar mañana."
    elif rpd >= rpd_warn or rpm >= rpm_warn:
        nivel = "advertencia"
        mensaje = f"Acercándote al límite. Quedan ~{docs_restantes} documentos auditables hoy."
    else:
        nivel = "normal"
        mensaje = f"Sistema operando con normalidad. ~{docs_restantes} documentos auditables hoy."

    return {
        "rpm": {"actual": rpm, "limite": RPM_LIMIT, "pct": round(rpm / RPM_LIMIT * 100)},
        "rpd": {
            "actual": rpd,
            "limite": RPD_CAP,
            "limite_real": RPD_LIMIT,
            "restante": rpd_restante,
            "pct": round(rpd / RPD_CAP * 100),
        },
        "tpm": {
            "actual": tpm,
            "limite": TPM_LIMIT,
            "pct": round(tpm / TPM_LIMIT * 100) if TPM_LIMIT else 0,
        },
        "docs_restantes_hoy": docs_restantes,
        "nivel": nivel,
        "mensaje": mensaje,
    }


def can_call() -> tuple[bool, str]:
    status = get_status()
    if status["rpd"]["actual"] >= RPD_CAP:
        return False, status["mensaje"]
    return True, "ok"


def wait_if_needed() -> None:
    """Bloquea hasta que sea seguro llamar a Gemini. Lanza RuntimeError si RPD agotado."""
    can, msg = can_call()
    if not can:
        raise RuntimeError(msg)
    # Esperar ventana RPM
    while True:
        now = time.monotonic()
        with _lock:
            _clean(now)
            if len(_rpm) < RPM_LIMIT:
                break
            wait_sec = max(0.1, _rpm[0] + 60 - now + 1.0)
        time.sleep(wait_sec)


# Cargar estado persistido al importar
_load()
