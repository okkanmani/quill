"""Admins and students stored in SQLite (replaces flat auth.json for runtime auth)."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import bcrypt

import db

AUTH_JSON = Path(__file__).parent / "data" / "auth.json"
VALID_GRADES = frozenset(range(1, 13))


def validate_grade(grade: int | None) -> int:
    if not isinstance(grade, int) or grade not in VALID_GRADES:
        raise ValueError("grade must be an integer from 1 to 12.")
    return grade


def normalize_student_curriculum(curriculum: str | None) -> str | None:
    cleaned = (curriculum or "").strip()
    return cleaned or None


def _student_row_dict(row) -> dict:
    out = {"id": row["id"], "name": row["name"]}
    if row["grade"] is not None:
        out["grade"] = int(row["grade"])
    curriculum = None
    if "curriculum" in row.keys():
        curriculum = normalize_student_curriculum(row["curriculum"])
    if curriculum:
        out["curriculum"] = curriculum
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


def authenticate_student(admin_name: str, name: str, password: str) -> dict | None:
    """Return {id, name, admin_id} or None."""
    admin_name = admin_name.strip()
    name = name.strip()
    if not admin_name or not name or not password:
        return None
    conn = db.connect()
    try:
        admin = conn.execute(
            "SELECT id FROM admins WHERE name = ? COLLATE NOCASE",
            (admin_name,),
        ).fetchone()
        if not admin:
            return None
        row = conn.execute(
            """
            SELECT id, admin_id, name, password_hash, grade, curriculum
            FROM students
            WHERE admin_id = ? AND name = ? COLLATE NOCASE
            """,
            (admin["id"], name),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    if bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        out = {"id": row["id"], "name": row["name"], "admin_id": row["admin_id"]}
        if row["grade"] is not None:
            out["grade"] = int(row["grade"])
        curriculum = normalize_student_curriculum(
            row["curriculum"] if "curriculum" in row.keys() else None
        )
        if curriculum:
            out["curriculum"] = curriculum
        return out
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
            SELECT id, name, grade, curriculum FROM students
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
            SELECT id, name, grade, curriculum FROM students
            WHERE admin_id = ? AND name = ?
            """,
            (admin_id, name),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return _student_row_dict(row)


def add_student(
    admin_id: int,
    name: str,
    password: str,
    grade: int,
    *,
    curriculum: str | None = None,
) -> int:
    name = name.strip()
    grade = validate_grade(grade)
    curriculum = normalize_student_curriculum(curriculum)
    h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            INSERT INTO students (admin_id, name, password_hash, grade, curriculum)
            VALUES (?, ?, ?, ?, ?)
            """,
            (admin_id, name, h, grade, curriculum),
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
            "SELECT id, name, grade, curriculum, admin_id FROM students WHERE id = ?",
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


def get_student_auth_row(student_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, admin_id, name, password_hash, grade, curriculum
            FROM students WHERE id = ?
            """,
            (student_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    out = {
        "id": int(row["id"]),
        "admin_id": int(row["admin_id"]),
        "name": row["name"],
        "password_hash": row["password_hash"],
    }
    if row["grade"] is not None:
        out["grade"] = int(row["grade"])
    curriculum = normalize_student_curriculum(
        row["curriculum"] if "curriculum" in row.keys() else None
    )
    if curriculum:
        out["curriculum"] = curriculum
    return out


def get_admin_auth_row(admin_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id, name, password_hash FROM admins WHERE id = ?",
            (admin_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "password_hash": row["password_hash"],
    }


def _rename_student_name(conn, old_name: str, new_name: str) -> None:
    tables = (
        "results",
        "writing_submissions",
        "focus_area_discussed",
        "student_revision_worksheets",
        "learn_page_notes",
        "learn_page_highlights",
        "worksheet_drafts",
        "timed_attempts",
        "student_worksheet_locks",
        "student_gifted_week_locks",
    )
    for table in tables:
        conn.execute(
            f"UPDATE {table} SET student = ? WHERE student = ?",
            (new_name, old_name),
        )


def _validate_account_fields(
    *,
    name: str | None,
    new_password: str | None,
) -> tuple[str | None, str | None]:
    next_name = name.strip() if name is not None else None
    if next_name is not None and not next_name:
        raise ValueError("Username cannot be empty.")
    next_password = new_password if new_password is not None else None
    if next_password is not None and len(next_password) < 4:
        raise ValueError("New password must be at least 4 characters.")
    if next_name is None and next_password is None:
        raise ValueError("Enter a new username and/or new password.")
    return next_name, next_password


def update_student_account(
    student_id: int,
    *,
    current_password: str,
    name: str | None = None,
    new_password: str | None = None,
) -> dict:
    row = get_student_auth_row(student_id)
    if not row:
        raise ValueError("Student account not found.")
    if not current_password:
        raise ValueError("Current password is required.")
    if not bcrypt.checkpw(current_password.encode(), row["password_hash"].encode()):
        raise ValueError("Current password is incorrect.")

    next_name, next_password = _validate_account_fields(
        name=name,
        new_password=new_password,
    )
    final_name = next_name if next_name is not None else row["name"]

    conn = db.connect()
    try:
        if final_name != row["name"]:
            taken = conn.execute(
                """
                SELECT id FROM students
                WHERE admin_id = ? AND name = ? AND id != ?
                """,
                (row["admin_id"], final_name, student_id),
            ).fetchone()
            if taken:
                raise ValueError("That username is already taken.")
            _rename_student_name(conn, row["name"], final_name)
            conn.execute(
                "UPDATE students SET name = ? WHERE id = ?",
                (final_name, student_id),
            )

        if next_password is not None:
            password_hash = bcrypt.hashpw(
                next_password.encode(),
                bcrypt.gensalt(),
            ).decode()
            conn.execute(
                "UPDATE students SET password_hash = ? WHERE id = ?",
                (password_hash, student_id),
            )

        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise ValueError("That username is already taken.") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    out = {"id": student_id, "name": final_name}
    if row.get("grade") is not None:
        out["grade"] = row["grade"]
    return out


def update_admin_account(
    admin_id: int,
    *,
    current_password: str,
    name: str | None = None,
    new_password: str | None = None,
) -> dict:
    row = get_admin_auth_row(admin_id)
    if not row:
        raise ValueError("Admin account not found.")
    if not current_password:
        raise ValueError("Current password is required.")
    if not bcrypt.checkpw(current_password.encode(), row["password_hash"].encode()):
        raise ValueError("Current password is incorrect.")

    next_name, next_password = _validate_account_fields(
        name=name,
        new_password=new_password,
    )
    final_name = next_name if next_name is not None else row["name"]

    conn = db.connect()
    try:
        if final_name != row["name"]:
            taken = conn.execute(
                """
                SELECT id FROM admins
                WHERE name = ? COLLATE NOCASE AND id != ?
                """,
                (final_name, admin_id),
            ).fetchone()
            if taken:
                raise ValueError("That username is already taken.")
            conn.execute(
                "UPDATE admins SET name = ? WHERE id = ?",
                (final_name, admin_id),
            )

        if next_password is not None:
            password_hash = bcrypt.hashpw(
                next_password.encode(),
                bcrypt.gensalt(),
            ).decode()
            conn.execute(
                "UPDATE admins SET password_hash = ? WHERE id = ?",
                (password_hash, admin_id),
            )

        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise ValueError("That username is already taken.") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"id": admin_id, "name": final_name}


def update_student_by_admin(
    admin_id: int,
    student_id: int,
    *,
    name: str | None = None,
    grade: int | None = None,
    password: str | None = None,
    curriculum: str | None = None,
) -> dict | None:
    if (
        name is None
        and grade is None
        and password is None
        and curriculum is None
    ):
        raise ValueError("No changes to save.")

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, name, grade, password_hash, curriculum
            FROM students
            WHERE id = ? AND admin_id = ?
            """,
            (student_id, admin_id),
        ).fetchone()
        if not row:
            return None

        final_name = row["name"]
        final_grade = int(row["grade"]) if row["grade"] is not None else None
        final_curriculum = normalize_student_curriculum(
            row["curriculum"] if "curriculum" in row.keys() else None
        )

        if name is not None:
            next_name = name.strip()
            if not next_name:
                raise ValueError("Student name cannot be empty.")
            if next_name != row["name"]:
                taken = conn.execute(
                    """
                    SELECT id FROM students
                    WHERE admin_id = ? AND name = ? AND id != ?
                    """,
                    (admin_id, next_name, student_id),
                ).fetchone()
                if taken:
                    raise ValueError("A student with that name already exists.")
                _rename_student_name(conn, row["name"], next_name)
                conn.execute(
                    "UPDATE students SET name = ? WHERE id = ? AND admin_id = ?",
                    (next_name, student_id, admin_id),
                )
                final_name = next_name

        if grade is not None:
            final_grade = validate_grade(grade)
            conn.execute(
                "UPDATE students SET grade = ? WHERE id = ? AND admin_id = ?",
                (final_grade, student_id, admin_id),
            )

        if password is not None:
            if len(password) < 4:
                raise ValueError("Password must be at least 4 characters.")
            password_hash = bcrypt.hashpw(
                password.encode(),
                bcrypt.gensalt(),
            ).decode()
            conn.execute(
                "UPDATE students SET password_hash = ? WHERE id = ? AND admin_id = ?",
                (password_hash, student_id, admin_id),
            )

        if curriculum is not None:
            final_curriculum = normalize_student_curriculum(curriculum)
            conn.execute(
                "UPDATE students SET curriculum = ? WHERE id = ? AND admin_id = ?",
                (final_curriculum, student_id, admin_id),
            )

        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise ValueError("A student with that name already exists.") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    out = {"id": student_id, "name": final_name, "grade": final_grade}
    if final_curriculum:
        out["curriculum"] = final_curriculum
    return out


def update_student_grade(admin_id: int, student_id: int, grade: int) -> dict | None:
    return update_student_by_admin(admin_id, student_id, grade=grade)


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
        conn.execute(
            "DELETE FROM student_revision_worksheets WHERE student = ?",
            (row["name"],),
        )
        conn.execute("DELETE FROM learn_page_notes WHERE student = ?", (row["name"],))
        conn.execute("DELETE FROM learn_page_highlights WHERE student = ?", (row["name"],))
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
