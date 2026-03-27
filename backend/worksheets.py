import json
from datetime import datetime, timezone
from pathlib import Path

import db

WORKSHEETS_DIR = Path(__file__).parent / "data" / "worksheets"


def init_worksheet_tables() -> None:
    db.init_schema()


def sync_worksheets_from_json_files() -> None:
    """Replace worksheet rows from JSON files on disk (safe to run on each deploy)."""
    conn = db.connect()
    try:
        conn.execute("DELETE FROM worksheet_questions")
        conn.execute("DELETE FROM worksheets")
        for path in sorted(WORKSHEETS_DIR.glob("*.json")):
            with open(path) as f:
                data = json.load(f)
            ws_id = path.stem
            title = data.get("title", ws_id)
            subject = data.get("subject", "general")
            questions = data.get("questions", [])
            conn.execute(
                "INSERT INTO worksheets (id, title, subject) VALUES (?, ?, ?)",
                (ws_id, title, subject),
            )
            for order, q in enumerate(questions):
                conn.execute(
                    "INSERT INTO worksheet_questions (worksheet_id, sort_order, payload) VALUES (?, ?, ?)",
                    (ws_id, order, json.dumps(q)),
                )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_worksheets() -> list:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT w.id, w.title, w.subject, COUNT(q.sort_order) AS question_count
            FROM worksheets w
            LEFT JOIN worksheet_questions q ON q.worksheet_id = w.id
            GROUP BY w.id, w.title, w.subject
            ORDER BY w.id
            """
        ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "subject": r["subject"],
                "question_count": r["question_count"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_worksheet(worksheet_id: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT title, subject FROM worksheets WHERE id = ?",
            (worksheet_id,),
        ).fetchone()
        if not row:
            return None
        qrows = conn.execute(
            """
            SELECT payload FROM worksheet_questions
            WHERE worksheet_id = ? ORDER BY sort_order
            """,
            (worksheet_id,),
        ).fetchall()
        questions = [json.loads(r["payload"]) for r in qrows]
        return {
            "title": row["title"],
            "subject": row["subject"],
            "questions": questions,
        }
    finally:
        conn.close()


def save_result(result: dict):
    submitted_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO results (worksheet_id, title, student, score, total, answers, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result["worksheet_id"],
                result["title"],
                result["student"],
                result["score"],
                result["total"],
                json.dumps(result["answers"]),
                submitted_at,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_results() -> list:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, worksheet_id, title, student, score, total, answers, submitted_at
            FROM results
            ORDER BY submitted_at DESC
            """
        ).fetchall()
        return [
            {
                "id": r["id"],
                "worksheet_id": r["worksheet_id"],
                "title": r["title"],
                "student": r["student"],
                "score": r["score"],
                "total": r["total"],
                "answers": json.loads(r["answers"]),
                "submitted_at": r["submitted_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()
