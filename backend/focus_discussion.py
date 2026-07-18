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
            SELECT subject, area, discussed_at, reinforcement_count, last_reinforced_at
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
                "reinforcement_count": int(row["reinforcement_count"] or 0),
            }
            for row in rows
        ]
    finally:
        conn.close()


def record_reinforcement_if_needed(
    student_name: str,
    subject: str,
    area: str,
    event_at: str | None = None,
) -> bool:
    """
    Increment reinforcement_count when a discussed area re-enters needs reinforcing.
    Counts once per visit (Discussed → Needs reinforcing), not per wrong question.
    """
    subject = _normalize_subject(subject)
    area = _normalize_area(area)
    if not subject or not area:
        return False

    event_at = (event_at or datetime.now(timezone.utc).isoformat()).strip()
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT discussed_at, last_reinforced_at
            FROM focus_area_discussed
            WHERE student = ? AND subject = ? AND area = ?
            """,
            (student_name, subject, area),
        ).fetchone()
        if not row:
            return False
        discussed_at = row["discussed_at"] or ""
        if not discussed_at or event_at <= discussed_at:
            return False
        last_reinforced_at = row["last_reinforced_at"]
        if last_reinforced_at and last_reinforced_at > discussed_at:
            return False
        conn.execute(
            """
            UPDATE focus_area_discussed
            SET reinforcement_count = reinforcement_count + 1,
                last_reinforced_at = ?
            WHERE student = ? AND subject = ? AND area = ?
            """,
            (event_at, student_name, subject, area),
        )
        conn.commit()
        return conn.total_changes > 0
    except Exception:
        conn.rollback()
        raise
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
            INSERT INTO focus_area_discussed (
                student, subject, area, discussed_at, reinforcement_count
            )
            VALUES (?, ?, ?, ?, 0)
            ON CONFLICT(student, subject, area) DO UPDATE SET
                discussed_at = excluded.discussed_at
            """,
            (student_name, subject, area, discussed_at),
        )
        row = conn.execute(
            """
            SELECT reinforcement_count
            FROM focus_area_discussed
            WHERE student = ? AND subject = ? AND area = ?
            """,
            (student_name, subject, area),
        ).fetchone()
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
        "reinforcement_count": int(row["reinforcement_count"] or 0) if row else 0,
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
