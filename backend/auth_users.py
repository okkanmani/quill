"""Admins and students stored in SQLite (replaces flat auth.json for runtime auth)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import bcrypt

import db

AUTH_JSON = Path(__file__).parent / "data" / "auth.json"
VALID_GRADES = frozenset(range(1, 13))


def validate_grade(grade: int | None) -> int:
    if not isinstance(grade, int) or grade not in VALID_GRADES:
        raise ValueError("grade must be an integer from 1 to 12.")
    return grade


def _student_row_dict(row) -> dict:
    out = {"id": row["id"], "name": row["name"]}
    if row["grade"] is not None:
        out["grade"] = int(row["grade"])
    return out


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
        "INSERT INTO admins (name, password_hash) VALUES (?, ?)",
        ("admin", admin_hash_str),
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
            "SELECT id, admin_id, name, password_hash, grade FROM students WHERE name = ?",
            (name,),
        ).fetchall()
    finally:
        conn.close()
    for r in rows:
        if bcrypt.checkpw(password.encode(), r["password_hash"].encode()):
            out = {"id": r["id"], "name": r["name"], "admin_id": r["admin_id"]}
            if r["grade"] is not None:
                out["grade"] = int(r["grade"])
            return out
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


def add_admin(name: str, password: str) -> int:
    name = name.strip()
    if not name:
        raise ValueError("admin name required")
    h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO admins (name, password_hash) VALUES (?, ?)", (name, h)
        )
        rid = cur.lastrowid
        conn.commit()
        return rid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def authenticate_admin_by_name(name: str, password: str) -> dict | None:
    """Return {admin_id, admin_name} or None."""
    name = name.strip()
    if not name or not password:
        return None
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id, name, password_hash FROM admins WHERE name = ? COLLATE NOCASE",
            (name,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    if bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        return {"admin_id": row["id"], "admin_name": row["name"]}
    return None


def get_admin_name(admin_id: int) -> str | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT name FROM admins WHERE id = ?", (admin_id,)
        ).fetchone()
    finally:
        conn.close()
    return row["name"] if row else None


def list_students_for_admin(admin_id: int) -> list[dict]:
    """Return [{id, name}, ...] for the given admin (no password fields)."""
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, name, grade FROM students
            WHERE admin_id = ?
            ORDER BY name COLLATE NOCASE
            """,
            (admin_id,),
        ).fetchall()
        return [_student_row_dict(r) for r in rows]
    finally:
        conn.close()


def get_student_by_admin_and_name(admin_id: int, name: str) -> dict | None:
    """Return {id, name} if this student belongs to the admin."""
    name = name.strip()
    if not name:
        return None
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, name, grade FROM students
            WHERE admin_id = ? AND name = ?
            """,
            (admin_id, name),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return _student_row_dict(row)


def add_student(admin_id: int, name: str, password: str, grade: int) -> int:
    name = name.strip()
    grade = validate_grade(grade)
    h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO students (admin_id, name, password_hash, grade) VALUES (?, ?, ?, ?)",
            (admin_id, name, h, grade),
        )
        rid = cur.lastrowid
        conn.commit()
        return rid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_student_profile(student_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id, name, grade, admin_id FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    out = _student_row_dict(row)
    if row["admin_id"] is not None:
        out["admin_id"] = int(row["admin_id"])
    return out


def get_student_admin_id(student_id: int) -> int | None:
    profile = get_student_profile(student_id)
    if not profile:
        return None
    return profile.get("admin_id")


def update_student_grade(admin_id: int, student_id: int, grade: int) -> dict | None:
    grade = validate_grade(grade)
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id, name, grade FROM students WHERE id = ? AND admin_id = ?",
            (student_id, admin_id),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE students SET grade = ? WHERE id = ? AND admin_id = ?",
            (grade, student_id, admin_id),
        )
        conn.commit()
        return {"id": row["id"], "name": row["name"], "grade": grade}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_student(admin_id: int, student_id: int) -> dict | None:
    """Delete a student owned by this admin and their worksheet results. Returns {id, name} or None."""
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id, name FROM students WHERE id = ? AND admin_id = ?",
            (student_id, admin_id),
        ).fetchone()
        if not row:
            return None
        conn.execute("DELETE FROM results WHERE student = ?", (row["name"],))
        conn.execute("DELETE FROM writing_submissions WHERE student = ?", (row["name"],))
        conn.execute("DELETE FROM focus_area_discussed WHERE student = ?", (row["name"],))
        conn.execute("DELETE FROM learn_page_notes WHERE student = ?", (row["name"],))
        conn.execute(
            "DELETE FROM students WHERE id = ? AND admin_id = ?",
            (student_id, admin_id),
        )
        conn.commit()
        return {"id": row["id"], "name": row["name"]}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
