import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from api_backend.config import Config

DB_PATH: Path = Config.DATA_DIR / "audit_cache.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audits (
            doc_id      TEXT PRIMARY KEY,
            created_at  TEXT NOT NULL,
            results_json TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def save(doc_id: str, result: dict) -> None:
    # No persiste reporte_txt ni reporte_csv — están en disco como .txt
    slim = {k: v for k, v in result.items() if k not in ("reporte_txt", "reporte_csv")}
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO audits (doc_id, created_at, results_json)
            VALUES (?, ?, ?)
            ON CONFLICT(doc_id) DO UPDATE SET
                created_at   = excluded.created_at,
                results_json = excluded.results_json
            """,
            (doc_id, datetime.now(timezone.utc).isoformat(), json.dumps(slim)),
        )


def load(doc_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT results_json FROM audits WHERE doc_id = ?", (doc_id,)
        ).fetchone()
    return json.loads(row[0]) if row else None


def exists(doc_id: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM audits WHERE doc_id = ?", (doc_id,)
        ).fetchone()
    return row is not None
