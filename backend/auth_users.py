"""Admins and students stored in SQLite (replaces flat auth.json for runtime auth)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import bcrypt

import db

AUTH_JSON = Path(__file__).parent / "data" / "auth.json"


def migrate_legacy_from_auth_json(conn) -> None:
    """One-time import from legacy auth.json when admins table is empty."""
    if conn.execute("SELECT COUNT(*) FROM admins").fetchone()[0] > 0:
        return
    if not AUTH_JSON.exists():
        return
    with open(AUTH_JSON) as f:
        data = json.load(f)
    admin_hash_str = data["admin"]["password_hash"]
    if isinstance(admin_hash_str, bytes):
        admin_hash_str = admin_hash_str.decode()
    cur = conn.execute(
        "INSERT INTO admins (password_hash) VALUES (?)", (admin_hash_str,)
    )
    admin_id = cur.lastrowid
    student_name = data["student"]["name"].strip()
    default_pw = os.environ.get("DEFAULT_STUDENT_PASSWORD", "changeme")
    st_hash = bcrypt.hashpw(default_pw.encode(), bcrypt.gensalt()).decode()
    conn.execute(
        "INSERT INTO students (admin_id, name, password_hash) VALUES (?, ?, ?)",
        (admin_id, student_name, st_hash),
    )


def authenticate_student(name: str, password: str) -> dict | None:
    """Return {id, name, admin_id} or None."""
    name = name.strip()
    if not name or not password:
        return None
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT id, admin_id, name, password_hash FROM students WHERE name = ?",
            (name,),
        ).fetchall()
    finally:
        conn.close()
    for r in rows:
        if bcrypt.checkpw(password.encode(), r["password_hash"].encode()):
            return {"id": r["id"], "name": r["name"], "admin_id": r["admin_id"]}
    return None


def authenticate_admin_for_student(student_name: str, admin_password: str) -> dict | None:
    """Verify admin password; student must belong to that admin."""
    student_name = student_name.strip()
    if not student_name or not admin_password:
        return None
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT s.id AS student_id, s.name AS student_name, s.admin_id, a.password_hash AS admin_hash
            FROM students s
            JOIN admins a ON s.admin_id = a.id
            WHERE s.name = ?
            """,
            (student_name,),
        ).fetchall()
    finally:
        conn.close()
    for r in rows:
        if bcrypt.checkpw(admin_password.encode(), r["admin_hash"].encode()):
            return {
                "admin_id": r["admin_id"],
                "student_id": r["student_id"],
                "student_name": r["student_name"],
            }
    return None


def add_admin(password: str) -> int:
    h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = db.connect()
    try:
        cur = conn.execute("INSERT INTO admins (password_hash) VALUES (?)", (h,))
        rid = cur.lastrowid
        conn.commit()
        return rid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def add_student(admin_id: int, name: str, password: str) -> int:
    name = name.strip()
    h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO students (admin_id, name, password_hash) VALUES (?, ?, ?)",
            (admin_id, name, h),
        )
        rid = cur.lastrowid
        conn.commit()
        return rid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
