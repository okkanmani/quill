"""Per-student notes on learn resource pages."""

from __future__ import annotations

from datetime import datetime, timezone

import db
from ai_learn_notes import generate_learn_page_notes


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    return {
        "section_id": row["section_id"],
        "page_index": int(row["page_index"]),
        "body": row["body"] or "",
        "ai_used": bool(row["ai_used"]),
        "saved_at": row["saved_at"],
    }


def list_notes_for_subject(student: str, subject_key: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT section_id, page_index, body, ai_used, saved_at
            FROM learn_page_notes
            WHERE student = ? AND subject_key = ?
            ORDER BY section_id, page_index
            """,
            (student, subject_key),
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_dict(row) for row in rows]


def get_note(student: str, subject_key: str, section_id: str, page_index: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT section_id, page_index, body, ai_used, saved_at
            FROM learn_page_notes
            WHERE student = ? AND subject_key = ? AND section_id = ? AND page_index = ?
            """,
            (student, subject_key, section_id, page_index),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_dict(row) if row else None


def save_note(
    student: str,
    subject_key: str,
    section_id: str,
    page_index: int,
    body: str,
) -> dict:
    if page_index < 0:
        raise ValueError("page_index must be >= 0")
    section_id = (section_id or "").strip()
    if not section_id:
        raise ValueError("section_id is required.")
    saved_at = _now_iso()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO learn_page_notes
                (student, subject_key, section_id, page_index, body, ai_used, saved_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
            ON CONFLICT(student, subject_key, section_id, page_index) DO UPDATE SET
                body = excluded.body,
                saved_at = excluded.saved_at
            """,
            (student, subject_key, section_id, page_index, body or "", saved_at),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT section_id, page_index, body, ai_used, saved_at
            FROM learn_page_notes
            WHERE student = ? AND subject_key = ? AND section_id = ? AND page_index = ?
            """,
            (student, subject_key, section_id, page_index),
        ).fetchone()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return _row_to_dict(row)


def generate_and_save_note(
    *,
    student: str,
    subject_key: str,
    section_id: str,
    page_index: int,
    page_markdown: str,
    section_title: str,
    subject_title: str,
    api_key: str,
) -> dict:
    if page_index < 0:
        raise ValueError("page_index must be >= 0")
    section_id = (section_id or "").strip()
    if not section_id:
        raise ValueError("section_id is required.")

    existing = get_note(student, subject_key, section_id, page_index)
    if existing and existing["ai_used"]:
        raise ValueError("AI notes can only be generated once for this page.")

    notes_text = generate_learn_page_notes(
        page_markdown=page_markdown,
        section_title=section_title,
        subject_title=subject_title,
        api_key=api_key,
    )
    saved_at = _now_iso()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO learn_page_notes
                (student, subject_key, section_id, page_index, body, ai_used, saved_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(student, subject_key, section_id, page_index) DO UPDATE SET
                body = excluded.body,
                ai_used = 1,
                saved_at = excluded.saved_at
            """,
            (student, subject_key, section_id, page_index, notes_text, saved_at),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT section_id, page_index, body, ai_used, saved_at
            FROM learn_page_notes
            WHERE student = ? AND subject_key = ? AND section_id = ? AND page_index = ?
            """,
            (student, subject_key, section_id, page_index),
        ).fetchone()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return _row_to_dict(row)
