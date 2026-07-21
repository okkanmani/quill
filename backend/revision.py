"""Student revision worksheets — persisted focus practice after teacher discussion."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import db
from focus_reinforcement import should_trigger_reinforcement, weighted_score_totals


def _normalize_subject(subject: str) -> str:
    return (subject or "").strip().lower()


def _normalize_area(area: str) -> str:
    return (area or "").strip().lower()


def _stars_by_question_id(payload: dict) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for question in payload.get("questions") or []:
        if not isinstance(question, dict):
            continue
        question_id = question.get("id")
        if not isinstance(question_id, str) or not question_id:
            continue
        stars = question.get("stars")
        if isinstance(stars, int) and 1 <= stars <= 3:
            mapping[question_id] = stars
    return mapping


def _enrich_answers_with_stars(answers: list[dict], payload: dict) -> list[dict]:
    stars_by_id = _stars_by_question_id(payload)
    enriched: list[dict] = []
    for answer in answers:
        if not isinstance(answer, dict):
            continue
        row = dict(answer)
        stars = row.get("stars")
        if not isinstance(stars, int) or stars not in (1, 2, 3):
            question_id = row.get("question_id")
            row["stars"] = stars_by_id.get(question_id, 2)
        enriched.append(row)
    return enriched


def _practice_questions_from_attempt(
    answers: list[dict],
    payload: dict,
    *,
    focus_area: str,
) -> list[dict]:
    enriched = _enrich_answers_with_stars(answers, payload)
    questions: list[dict] = []
    for answer in enriched:
        questions.append(
            {
                "question_id": answer.get("question_id"),
                "question": answer.get("prompt") or answer.get("question") or "",
                "answer": answer.get("given") or answer.get("answer") or "",
                "expected": answer.get("expected") or "",
                "choices": answer.get("choices") or [],
                "correct": answer.get("correct"),
                "stars": answer.get("stars", 2),
                "area": answer.get("area") or focus_area,
            }
        )
    return questions


def _iso_to_sort_ts(iso: str | None) -> int:
    if not iso:
        return 0
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except ValueError:
        return 0


def _list_item_from_row(row) -> dict:
    payload = json.loads(row["payload"])
    completed = bool(row["completed_at"])
    item = {
        "id": row["id"],
        "title": row["title"],
        "subject": row["subject"],
        "focus_area": row["focus_area"],
        "focus_area_label": payload.get("focus_area_label") or row["focus_area"],
        "question_count": payload.get("question_count")
        or len(payload.get("questions") or []),
        "difficulty_min": payload.get("difficulty_min", 2),
        "difficulty_max": payload.get("difficulty_max", 3),
        "content_badge": "Revision",
        "created_at": row["created_at"],
        "sort_ts": _iso_to_sort_ts(row["created_at"]),
        "discussed_at": row["discussed_at"],
        "done": completed,
    }
    if completed and row["score"] is not None:
        item["last_score"] = row["score"]
        item["last_total"] = row["total"]
        item["completed_at"] = row["completed_at"]
    return item


def save_revision_worksheet(
    *,
    student: str,
    worksheet: dict,
    discussed_at: str | None = None,
) -> dict:
    student = (student or "").strip()
    if not student:
        raise ValueError("Student is required.")

    subject = _normalize_subject(worksheet.get("subject") or "")
    focus_area = _normalize_area(worksheet.get("focus_area") or "")
    title = (worksheet.get("title") or "").strip()
    if not subject:
        raise ValueError("Worksheet subject is required.")
    if not focus_area:
        raise ValueError("Focus area is required.")
    if not title:
        raise ValueError("Worksheet title is required.")

    questions = worksheet.get("questions") or []
    total = len(questions) if questions else 5
    created_at = datetime.now(timezone.utc).isoformat()
    payload = json.dumps(worksheet)

    conn = db.connect()
    try:
        if discussed_at is None:
            row = conn.execute(
                """
                SELECT discussed_at
                FROM focus_area_discussed
                WHERE student = ? AND subject = ? AND area = ?
                """,
                (student, subject, focus_area),
            ).fetchone()
            discussed_at = row["discussed_at"] if row else None

        cur = conn.execute(
            """
            INSERT INTO student_revision_worksheets (
                student, subject, focus_area, title, payload,
                discussed_at, created_at, total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                student,
                subject,
                focus_area,
                title,
                payload,
                discussed_at,
                created_at,
                total,
            ),
        )
        conn.commit()
        revision_id = cur.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "id": revision_id,
        "student": student,
        "subject": subject,
        "focus_area": focus_area,
        "title": title,
        "created_at": created_at,
        "discussed_at": discussed_at,
        "total": total,
    }


def list_revision_worksheets(student_name: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, student, subject, focus_area, title, payload,
                   discussed_at, created_at, completed_at, score, total
            FROM student_revision_worksheets
            WHERE student = ?
            ORDER BY created_at DESC
            """,
            (student_name,),
        ).fetchall()
        return [_list_item_from_row(r) for r in rows]
    finally:
        conn.close()


def get_revision_worksheet(revision_id: int, student_name: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, student, subject, focus_area, title, payload,
                   discussed_at, created_at, completed_at, score, total, answers
            FROM student_revision_worksheets
            WHERE id = ? AND student = ?
            """,
            (revision_id, student_name),
        ).fetchone()
        if not row:
            return None
        worksheet = json.loads(row["payload"])
        worksheet["revision_id"] = row["id"]
        worksheet["created_at"] = row["created_at"]
        worksheet["discussed_at"] = row["discussed_at"]
        if row["completed_at"]:
            worksheet["completed_at"] = row["completed_at"]
            worksheet["last_score"] = row["score"]
            worksheet["last_total"] = row["total"]
            if row["answers"]:
                try:
                    parsed = json.loads(row["answers"])
                    if isinstance(parsed, list):
                        worksheet["submitted_answers"] = parsed
                except json.JSONDecodeError:
                    pass
        return worksheet
    finally:
        conn.close()


def complete_revision_worksheet(
    revision_id: int,
    student_name: str,
    *,
    score: int,
    total: int,
    answers: list[dict] | None = None,
) -> dict | None:
    if score < 0:
        raise ValueError("Score must be zero or greater.")
    if total <= 0:
        raise ValueError("Total must be greater than zero.")
    if score > total:
        raise ValueError("Score cannot exceed total.")

    completed_at = datetime.now(timezone.utc).isoformat()
    answers_json = json.dumps(answers or [])
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, completed_at
            FROM student_revision_worksheets
            WHERE id = ? AND student = ?
            """,
            (revision_id, student_name),
        ).fetchone()
        if not row:
            return None
        if row["completed_at"]:
            raise ValueError("This practice worksheet was already submitted.")
        conn.execute(
            """
            UPDATE student_revision_worksheets
            SET completed_at = ?, score = ?, total = ?, answers = ?
            WHERE id = ? AND student = ?
            """,
            (completed_at, score, total, answers_json, revision_id, student_name),
        )
        row_meta = conn.execute(
            """
            SELECT subject, focus_area, payload
            FROM student_revision_worksheets
            WHERE id = ? AND student = ?
            """,
            (revision_id, student_name),
        ).fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    if row_meta and answers:
        try:
            payload = json.loads(row_meta["payload"])
        except json.JSONDecodeError:
            payload = {}
        practice_questions = _practice_questions_from_attempt(
            answers,
            payload,
            focus_area=row_meta["focus_area"],
        )
        if should_trigger_reinforcement(practice_questions):
            from focus_discussion import record_reinforcement_if_needed

            record_reinforcement_if_needed(
                student_name,
                row_meta["subject"],
                row_meta["focus_area"],
                completed_at,
            )

    return {
        "id": revision_id,
        "completed_at": completed_at,
        "score": score,
        "total": total,
        "done": True,
        "last_score": score,
        "last_total": total,
    }


def list_practice_results(student_name: str) -> list[dict]:
    """Completed focus practice worksheets for admin Results → Practice."""
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, subject, focus_area, title, payload,
                   completed_at, score, total, answers
            FROM student_revision_worksheets
            WHERE student = ? AND completed_at IS NOT NULL
            ORDER BY completed_at DESC
            """,
            (student_name,),
        ).fetchall()
        records = []
        for row in rows:
            try:
                payload = json.loads(row["payload"])
            except json.JSONDecodeError:
                payload = {}
            answers = []
            if row["answers"]:
                try:
                    parsed = json.loads(row["answers"])
                    if isinstance(parsed, list):
                        answers = parsed
                except json.JSONDecodeError:
                    answers = []
            records.append(
                {
                    "id": row["id"],
                    "title": row["title"] or payload.get("title") or "",
                    "subject": row["subject"],
                    "focus_area": row["focus_area"],
                    "focus_area_label": payload.get("focus_area_label")
                    or row["focus_area"],
                    "score": row["score"],
                    "total": row["total"],
                    "completed_at": row["completed_at"],
                    "manual": bool(payload.get("manual")),
                    "answers": answers,
                }
            )
        return records
    finally:
        conn.close()


def list_revision_analysis_records(student_name: str) -> list[dict]:
    """Completed revision attempts that triggered needs-reinforcing for Analysis."""
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, subject, focus_area, payload, completed_at, answers
            FROM student_revision_worksheets
            WHERE student = ? AND completed_at IS NOT NULL
            ORDER BY completed_at DESC
            """,
            (student_name,),
        ).fetchall()
        records = []
        for row in rows:
            answers_raw = row["answers"]
            if not answers_raw:
                continue
            try:
                answers = json.loads(answers_raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(answers, list):
                continue
            try:
                payload = json.loads(row["payload"])
            except json.JSONDecodeError:
                payload = {}
            practice_questions = _practice_questions_from_attempt(
                answers,
                payload,
                focus_area=row["focus_area"],
            )
            if not should_trigger_reinforcement(practice_questions):
                continue
            wrong = [
                q for q in practice_questions if q.get("correct") is False
            ]
            if not wrong:
                continue
            records.append(
                {
                    "revision_id": row["id"],
                    "subject": row["subject"],
                    "focus_area": row["focus_area"],
                    "title": payload.get("title") or "",
                    "completed_at": row["completed_at"],
                    "questions": wrong,
                }
            )
        return records
    finally:
        conn.close()


def list_revision_practice_display_records(student_name: str) -> list[dict]:
    """Latest completed focus-practice attempts for Analysis detail panels."""
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, subject, focus_area, payload, completed_at, score, total, answers
            FROM student_revision_worksheets
            WHERE student = ? AND completed_at IS NOT NULL
            ORDER BY completed_at DESC
            """,
            (student_name,),
        ).fetchall()
        latest_by_area: dict[tuple[str, str], dict] = {}
        for row in rows:
            answers_raw = row["answers"]
            if not answers_raw:
                continue
            try:
                answers = json.loads(answers_raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(answers, list):
                continue
            try:
                payload = json.loads(row["payload"])
            except json.JSONDecodeError:
                payload = {}
            subject = _normalize_subject(row["subject"])
            focus_area = _normalize_area(row["focus_area"])
            area_key = (subject, focus_area)
            if area_key in latest_by_area:
                continue
            practice_questions = _practice_questions_from_attempt(
                answers,
                payload,
                focus_area=focus_area,
            )
            if not practice_questions:
                continue
            earned, maximum = weighted_score_totals(practice_questions)
            latest_by_area[area_key] = {
                "revision_id": row["id"],
                "subject": subject,
                "focus_area": focus_area,
                "title": payload.get("title") or "",
                "completed_at": row["completed_at"],
                "score": row["score"],
                "total": row["total"],
                "weighted_score": earned,
                "max_weighted_score": maximum,
                "triggered_reinforcement": should_trigger_reinforcement(
                    practice_questions
                ),
                "questions": practice_questions,
            }
        return list(latest_by_area.values())
    finally:
        conn.close()


def delete_revision_worksheets_for_student(student_name: str) -> None:
    conn = db.connect()
    try:
        conn.execute(
            "DELETE FROM student_revision_worksheets WHERE student = ?",
            (student_name,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
