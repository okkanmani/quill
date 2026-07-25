"""Per-admin UI preferences stored on the admins row."""

from __future__ import annotations

import db


def expert_json_warning_enabled(admin_id: int) -> bool:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT expert_json_warning_enabled FROM admins WHERE id = ?",
            (admin_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return True
    return bool(row["expert_json_warning_enabled"])


def set_expert_json_warning_enabled(admin_id: int, enabled: bool) -> None:
    conn = db.connect()
    try:
        conn.execute(
            "UPDATE admins SET expert_json_warning_enabled = ? WHERE id = ?",
            (1 if enabled else 0, admin_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
