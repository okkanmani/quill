"""Student writing submissions — free-form responses to books, chapters, etc."""

from __future__ import annotations

import re
from datetime import datetime, timezone

import db

MAX_TITLE_LEN = 200
MAX_BODY_LEN = 50_000

VALID_WRITING_GRADES = (
    "A+",
    "A",
    "A−",
    "B+",
    "B",
    "B−",
    "C+",
    "C",
    "C−",
    "D+",
    "D",
    "D−",
    "F",
)


def count_words(text: str) -> int:
    parts = re.split(r"\s+", (text or "").strip())
    return len([p for p in parts if p])


def _row_to_dict(row) -> dict:
    grade = row["grade"] if row["grade"] else None
    out = {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "word_count": row["word_count"],
        "submitted_at": row["submitted_at"],
        "student": row["student"],
        "grade": grade,
        "status": "evaluated" if grade else "pending",
    }
    if row["evaluated_at"]:
        out["evaluated_at"] = row["evaluated_at"]
    return out


def list_writing_submissions(student_name: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, student, title, body, word_count, submitted_at, grade, evaluated_at
            FROM writing_submissions
            WHERE student = ?
            ORDER BY submitted_at DESC
            """,
            (student_name,),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def save_writing_submission(*, student: str, title: str, body: str) -> dict:
    title = (title or "").strip()
    body = (body or "").strip()
    if not title:
        raise ValueError("Title is required.")
    if len(title) > MAX_TITLE_LEN:
        raise ValueError(f"Title must be at most {MAX_TITLE_LEN} characters.")
    if not body:
        raise ValueError("Writing is required.")
    if len(body) > MAX_BODY_LEN:
        raise ValueError(f"Writing must be at most {MAX_BODY_LEN} characters.")

    word_count = count_words(body)
    submitted_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            INSERT INTO writing_submissions (student, title, body, word_count, submitted_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (student, title, body, word_count, submitted_at),
        )
        conn.commit()
        row_id = cur.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "id": row_id,
        "student": student,
        "title": title,
        "body": body,
        "word_count": word_count,
        "submitted_at": submitted_at,
        "grade": None,
        "status": "pending",
    }


def grade_writing_submission(
    submission_id: int,
    student_name: str,
    grade: str,
) -> dict | None:
    grade = (grade or "").strip()
    if grade not in VALID_WRITING_GRADES:
        raise ValueError(f"grade must be one of: {', '.join(VALID_WRITING_GRADES)}")

    evaluated_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, student, title, body, word_count, submitted_at, grade, evaluated_at
            FROM writing_submissions
            WHERE id = ? AND student = ?
            """,
            (submission_id, student_name),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            """
            UPDATE writing_submissions
            SET grade = ?, evaluated_at = ?
            WHERE id = ? AND student = ?
            """,
            (grade, evaluated_at, submission_id, student_name),
        )
        conn.commit()
        updated = conn.execute(
            """
            SELECT id, student, title, body, word_count, submitted_at, grade, evaluated_at
            FROM writing_submissions
            WHERE id = ?
            """,
            (submission_id,),
        ).fetchone()
        return _row_to_dict(updated) if updated else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_writing_submission(submission_id: int, student_name: str) -> bool:
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            DELETE FROM writing_submissions
            WHERE id = ? AND student = ?
            """,
            (submission_id, student_name),
        )
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
