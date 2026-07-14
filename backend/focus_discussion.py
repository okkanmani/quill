"""Track which focus areas a teacher has already discussed with a student."""

from __future__ import annotations

from datetime import datetime, timezone

import db


def _normalize_subject(subject: str) -> str:
    return (subject or "").strip().lower()


def _normalize_area(area: str) -> str:
    return (area or "").strip().lower()


def list_focus_areas_discussed(student_name: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT subject, area, discussed_at
            FROM focus_area_discussed
            WHERE student = ?
            ORDER BY discussed_at DESC
            """,
            (student_name,),
        ).fetchall()
        return [
            {
                "subject": row["subject"],
                "area": row["area"],
                "discussed_at": row["discussed_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def mark_focus_area_discussed(student_name: str, subject: str, area: str) -> dict:
    subject = _normalize_subject(subject)
    area = _normalize_area(area)
    if not subject:
        raise ValueError("Subject is required.")
    if not area:
        raise ValueError("Focus area is required.")

    discussed_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO focus_area_discussed (student, subject, area, discussed_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student, subject, area) DO UPDATE SET
                discussed_at = excluded.discussed_at
            """,
            (student_name, subject, area, discussed_at),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "subject": subject,
        "area": area,
        "discussed_at": discussed_at,
    }


def delete_focus_areas_discussed_for_student(student_name: str) -> None:
    conn = db.connect()
    try:
        conn.execute(
            "DELETE FROM focus_area_discussed WHERE student = ?",
            (student_name,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
