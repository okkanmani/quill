import json
import re
from datetime import datetime, timezone
from pathlib import Path

import db
from learn_content import get_subject

WORKSHEETS_DIR = Path(__file__).parent / "data" / "worksheets"
VALID_SUBJECTS = frozenset({"math", "english", "science", "general"})
WORKSHEET_ID_RE = re.compile(r"^questions_\d+$")

# Worksheets uploaded within this window appear under Latest (ms).
LATEST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000


def _is_latest_sort_ts(sort_ts: int, now_ms: int | None = None) -> bool:
    if sort_ts <= 0:
        return False
    if now_ms is None:
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return now_ms - sort_ts <= LATEST_WINDOW_MS


def _learn_fields_from_sheet_data(data: dict) -> tuple[str | None, str | None]:
    ls = data.get("learn_subject")
    learn_subject = (
        str(ls).strip().lower()
        if ls is not None and str(ls).strip()
        else None
    )
    lc = data.get("learn_section")
    learn_section = None
    if learn_subject and lc is not None and str(lc).strip():
        learn_section = str(lc).strip().lower()
    return learn_subject, learn_section


def _content_badge_from_sheet_data(data: dict) -> str | None:
    badge = data.get("content_badge")
    if badge is not None and str(badge).strip():
        return str(badge).strip()
    return None


def _resolve_content_badge_metadata(
    worksheet_id: str,
    row_content_badge,
) -> dict:
    """content_badge from bundled JSON (preferred) or DB."""
    content_badge = None
    json_path = WORKSHEETS_DIR / f"{worksheet_id}.json"
    if json_path.is_file():
        try:
            with open(json_path, encoding="utf-8") as f:
                content_badge = _content_badge_from_sheet_data(json.load(f))
        except (OSError, json.JSONDecodeError):
            pass
    if content_badge is None and row_content_badge is not None and str(row_content_badge).strip():
        content_badge = str(row_content_badge).strip()
    meta: dict = {}
    if content_badge:
        meta["content_badge"] = content_badge
    return meta


def _apply_learn_section_title(out: dict) -> None:
    """Add learn_section_title when learn_subject + learn_section match the learn manifest."""
    out.pop("learn_section_title", None)
    sec_id = out.get("learn_section")
    subj_key = out.get("learn_subject")
    if not sec_id or not subj_key:
        return
    sdata = get_subject(subj_key)
    if not sdata:
        return
    for sec in sdata.get("sections") or []:
        if sec.get("id") == sec_id:
            out["learn_section_title"] = sec.get("title", sec_id)
            break


def _difficulty_from_sheet_data(data: dict) -> dict:
    """Difficulty 1=easy, 2=medium, 3=hard. From worksheet difficulty or per-question stars."""
    meta: dict = {}
    root = data.get("difficulty")
    if isinstance(root, bool):
        root = None
    if isinstance(root, (int, float)) and int(root) in (1, 2, 3):
        d = int(root)
        meta["difficulty_min"] = d
        meta["difficulty_max"] = d
        return meta
    stars: list[int] = []
    for q in data.get("questions") or []:
        s = q.get("stars")
        if isinstance(s, bool):
            s = None
        if isinstance(s, (int, float)) and int(s) in (1, 2, 3):
            stars.append(int(s))
    if stars:
        meta["difficulty_min"] = min(stars)
        meta["difficulty_max"] = max(stars)
    return meta


def _difficulty_from_db_questions(worksheet_id: str) -> dict:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT payload FROM worksheet_questions
            WHERE worksheet_id = ? ORDER BY sort_order
            """,
            (worksheet_id,),
        ).fetchall()
        questions = [json.loads(r["payload"]) for r in rows]
        return _difficulty_from_sheet_data({"questions": questions})
    finally:
        conn.close()


def _resolve_difficulty_metadata(worksheet_id: str) -> dict:
    json_path = WORKSHEETS_DIR / f"{worksheet_id}.json"
    if json_path.is_file():
        try:
            with open(json_path, encoding="utf-8") as f:
                return _difficulty_from_sheet_data(json.load(f))
        except (OSError, json.JSONDecodeError):
            pass
    return _difficulty_from_db_questions(worksheet_id)


def _resolve_learn_metadata(
    worksheet_id: str,
    row_learn_subject,
    row_learn_section,
) -> dict:
    """learn_* from bundled JSON (preferred) or DB. Used for GET worksheet and list."""
    learn_subject, learn_section = None, None
    json_path = WORKSHEETS_DIR / f"{worksheet_id}.json"
    if json_path.is_file():
        try:
            with open(json_path, encoding="utf-8") as f:
                file_data = json.load(f)
            learn_subject, learn_section = _learn_fields_from_sheet_data(file_data)
        except (OSError, json.JSONDecodeError):
            pass

    if learn_subject is None:
        ls = row_learn_subject
        if ls is not None and str(ls).strip():
            learn_subject = str(ls).strip().lower()
    if learn_section is None and learn_subject is not None:
        lsec = row_learn_section
        if lsec is not None and str(lsec).strip():
            learn_section = str(lsec).strip().lower()

    meta: dict = {}
    if learn_subject:
        meta["learn_subject"] = learn_subject
    if learn_section:
        meta["learn_section"] = learn_section
    _apply_learn_section_title(meta)
    return meta


def _worksheet_sort_ts_ms(data: dict, path: Path) -> int:
    """Milliseconds since epoch; higher = newer (listed first)."""
    raw = data.get("sort_ts")
    if isinstance(raw, bool):
        raw = None
    if isinstance(raw, (int, float)):
        return int(raw)
    if isinstance(raw, str) and raw.strip().isdigit():
        return int(raw.strip())
    created = data.get("created_at")
    if isinstance(created, str) and created.strip():
        s = created.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass
    try:
        return int(path.stat().st_mtime * 1000)
    except OSError:
        return 0


def init_worksheet_tables() -> None:
    db.init_schema()


def _insert_worksheet(conn, ws_id: str, data: dict, path: Path) -> None:
    """Insert one worksheet and its questions (worksheet id must not already exist)."""
    title = data.get("title", ws_id)
    subject = data.get("subject", "general")
    scratchpad = 1 if data.get("scratchpad", True) else 0
    passages = json.dumps(data.get("passages", []))
    sort_ts = _worksheet_sort_ts_ms(data, path)
    questions = data.get("questions", [])
    learn_subject, learn_section = _learn_fields_from_sheet_data(data)
    content_badge = _content_badge_from_sheet_data(data)
    conn.execute(
        """
        INSERT INTO worksheets (id, title, subject, scratchpad, passages, sort_ts, learn_subject, learn_section, content_badge)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (ws_id, title, subject, scratchpad, passages, sort_ts, learn_subject, learn_section, content_badge),
    )
    for order, q in enumerate(questions):
        conn.execute(
            "INSERT INTO worksheet_questions (worksheet_id, sort_order, payload) VALUES (?, ?, ?)",
            (ws_id, order, json.dumps(q)),
        )


def sync_worksheets_from_json_files() -> None:
    """Replace ALL worksheets from JSON files. Destructive — use empty DB, reset, or tooling."""
    conn = db.connect()
    try:
        conn.execute("DELETE FROM worksheet_questions")
        conn.execute("DELETE FROM worksheets")
        for path in sorted(WORKSHEETS_DIR.glob("*.json")):
            with open(path) as f:
                data = json.load(f)
            _insert_worksheet(conn, path.stem, data, path)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def seed_worksheets_from_json_if_empty() -> bool:
    """Import JSON only when the worksheets table is empty (first boot / fresh DB)."""
    conn = db.connect()
    try:
        n = conn.execute("SELECT COUNT(*) FROM worksheets").fetchone()[0]
    finally:
        conn.close()
    if n == 0:
        sync_worksheets_from_json_files()
        return True
    return False


def _worksheet_subject_key(data: dict) -> str:
    s = data.get("subject", "general")
    return str(s).strip().lower() or "general"


def merge_worksheets_from_json_files(
    subjects: frozenset[str] | None = None,
) -> dict[str, object]:
    """Upsert each worksheet that has a JSON file; other rows in the DB are unchanged.

    If ``subjects`` is set, only merge files whose worksheet ``subject`` (normalized)
    is in that set. Returns counts for logging and cron responses.
    """
    conn = db.connect()
    merged_ids: list[str] = []
    skipped_count = 0
    try:
        for path in sorted(WORKSHEETS_DIR.glob("*.json")):
            with open(path) as f:
                data = json.load(f)
            if subjects is not None and _worksheet_subject_key(data) not in subjects:
                skipped_count += 1
                continue
            ws_id = path.stem
            conn.execute("DELETE FROM worksheets WHERE id = ?", (ws_id,))
            _insert_worksheet(conn, ws_id, data, path)
            merged_ids.append(ws_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {
        "merged_count": len(merged_ids),
        "skipped_count": skipped_count,
        "merged_ids": merged_ids,
    }


def list_worksheets(student_name: str | None = None) -> list:
    """If student_name is set, done = this student submitted. If None (admin), done = any submission."""
    conn = db.connect()
    try:
        # Scalar subqueries avoid GROUP BY + EXISTS quirks in SQLite.
        if student_name is not None:
            rows = conn.execute(
                """
                SELECT t.id, t.title, t.subject, t.scratchpad, t.sort_ts, t.question_count, t.done,
                       t.learn_subject, t.learn_section, t.content_badge, t.last_score, t.last_total
                FROM (
                    SELECT w.id, w.title, w.subject, w.scratchpad, w.sort_ts,
                           w.learn_subject, w.learn_section, w.content_badge,
                           (SELECT COUNT(*) FROM worksheet_questions q WHERE q.worksheet_id = w.id) AS question_count,
                           EXISTS (
                             SELECT 1 FROM results r
                             WHERE r.worksheet_id = w.id AND r.student = ?
                           ) AS done,
                           (SELECT r.score FROM results r
                            WHERE r.worksheet_id = w.id AND r.student = ?
                            ORDER BY r.submitted_at DESC LIMIT 1) AS last_score,
                           (SELECT r.total FROM results r
                            WHERE r.worksheet_id = w.id AND r.student = ?
                            ORDER BY r.submitted_at DESC LIMIT 1) AS last_total
                    FROM worksheets w
                ) t
                ORDER BY t.done ASC, t.sort_ts DESC, t.id DESC
                """,
                (student_name, student_name, student_name),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT t.id, t.title, t.subject, t.scratchpad, t.sort_ts, t.question_count, t.done,
                       t.learn_subject, t.learn_section, t.content_badge, t.last_score, t.last_total
                FROM (
                    SELECT w.id, w.title, w.subject, w.scratchpad, w.sort_ts,
                           w.learn_subject, w.learn_section, w.content_badge,
                           (SELECT COUNT(*) FROM worksheet_questions q WHERE q.worksheet_id = w.id) AS question_count,
                           EXISTS (
                             SELECT 1 FROM results r
                             WHERE r.worksheet_id = w.id
                           ) AS done,
                           CAST(NULL AS INTEGER) AS last_score,
                           CAST(NULL AS INTEGER) AS last_total
                    FROM worksheets w
                ) t
                ORDER BY t.done ASC, t.sort_ts DESC, t.id DESC
                """
            ).fetchall()
        out_list = []
        for r in rows:
            item = {
                "id": r["id"],
                "title": r["title"],
                "subject": r["subject"],
                "scratchpad": bool(r["scratchpad"]),
                "question_count": r["question_count"],
                "sort_ts": r["sort_ts"],
                "done": bool(r["done"]),
            }
            item.update(
                _resolve_learn_metadata(
                    r["id"], r["learn_subject"], r["learn_section"]
                )
            )
            item.update(
                _resolve_content_badge_metadata(r["id"], r["content_badge"])
            )
            item.update(_resolve_difficulty_metadata(r["id"]))
            item["is_latest"] = _is_latest_sort_ts(int(r["sort_ts"] or 0))
            ls_ = r["last_score"]
            lt_ = r["last_total"]
            if ls_ is not None and lt_ is not None and int(lt_) > 0:
                item["last_score"] = int(ls_)
                item["last_total"] = int(lt_)
            out_list.append(item)
        return out_list
    finally:
        conn.close()


def get_worksheet(worksheet_id: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT title, subject, scratchpad, passages, learn_subject, learn_section, content_badge
            FROM worksheets WHERE id = ?
            """,
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
        passage_list = json.loads(row["passages"] or "[]")
        out = {
            "title": row["title"],
            "subject": row["subject"],
            "scratchpad": bool(row["scratchpad"]),
            "questions": questions,
        }
        if passage_list:
            out["passages"] = passage_list

        out.update(
            _resolve_learn_metadata(
                worksheet_id, row["learn_subject"], row["learn_section"]
            )
        )
        out.update(
            _resolve_content_badge_metadata(worksheet_id, row["content_badge"])
        )
        out.update(_resolve_difficulty_metadata(worksheet_id))
        return out
    finally:
        conn.close()


def worksheet_id_from_filename(filename: str) -> str | None:
    """Return worksheet id when filename is ``questions_N.json``."""
    if not filename or not filename.lower().endswith(".json"):
        return None
    stem = Path(filename).stem
    if WORKSHEET_ID_RE.fullmatch(stem):
        return stem
    return None


def validate_worksheet_data(data: dict) -> list[str]:
    """Return human-readable validation errors; empty list means valid."""
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["JSON must be an object."]

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        errors.append("title is required (non-empty string).")

    subject = data.get("subject", "general")
    if not isinstance(subject, str) or subject.strip().lower() not in VALID_SUBJECTS:
        errors.append(
            f"subject must be one of: {', '.join(sorted(VALID_SUBJECTS))}."
        )

    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        errors.append("questions must be a non-empty array.")
        return errors

    passage_ids: set[str] = set()
    passages = data.get("passages")
    if passages is not None:
        if not isinstance(passages, list):
            errors.append("passages must be an array when present.")
        else:
            for i, p in enumerate(passages):
                if not isinstance(p, dict):
                    errors.append(f"passages[{i}] must be an object.")
                    continue
                pid = p.get("id")
                if not isinstance(pid, str) or not pid.strip():
                    errors.append(f"passages[{i}].id is required.")
                else:
                    passage_ids.add(pid.strip())
                body = p.get("text") or p.get("body")
                if not isinstance(body, str) or not body.strip():
                    errors.append(f"passages[{i}].text or body is required.")

    seen_qids: set[str] = set()
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            errors.append(f"questions[{i}] must be an object.")
            continue
        qid = q.get("id")
        if not isinstance(qid, str) or not qid.strip():
            errors.append(f"questions[{i}].id is required.")
        elif qid in seen_qids:
            errors.append(f"Duplicate question id: {qid}.")
        else:
            seen_qids.add(qid)

        qtype = q.get("type")
        if qtype != "multiple_choice":
            errors.append(f"questions[{i}].type must be multiple_choice.")

        prompt = q.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            errors.append(f"questions[{i}].prompt is required.")

        choices = q.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            errors.append(f"questions[{i}].choices must have at least 2 items.")
            continue

        answer = q.get("answer")
        if not isinstance(answer, str) or not answer.strip():
            errors.append(f"questions[{i}].answer is required.")
        elif answer not in choices:
            errors.append(f"questions[{i}].answer must match one of choices.")

        passage_id = q.get("passage_id")
        if passage_id is not None:
            if not isinstance(passage_id, str) or not passage_id.strip():
                errors.append(f"questions[{i}].passage_id must be a non-empty string.")
            elif passage_ids and passage_id.strip() not in passage_ids:
                errors.append(
                    f"questions[{i}].passage_id references unknown passage: {passage_id}."
                )

        stars = q.get("stars")
        if stars is not None and not (
            isinstance(stars, (int, float)) and int(stars) in (1, 2, 3)
        ):
            errors.append(f"questions[{i}].stars must be 1, 2, or 3 when set.")

    badge = data.get("content_badge")
    if badge is not None and (not isinstance(badge, str) or not badge.strip()):
        errors.append("content_badge must be a non-empty string when set.")

    return errors


def upsert_worksheet_from_data(ws_id: str, data: dict) -> dict:
    """Validate and upsert one worksheet into SQLite."""
    errors = validate_worksheet_data(data)
    if errors:
        raise ValueError(errors)

    # Portal upload = newly published; use now so Latest tab picks it up.
    payload = dict(data)
    payload["sort_ts"] = int(datetime.now(timezone.utc).timestamp() * 1000)

    conn = db.connect()
    try:
        conn.execute("DELETE FROM worksheets WHERE id = ?", (ws_id,))
        path = WORKSHEETS_DIR / f"{ws_id}.json"
        _insert_worksheet(conn, ws_id, payload, path)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    questions = data.get("questions") or []
    return {
        "id": ws_id,
        "title": data.get("title", ws_id),
        "subject": str(data.get("subject", "general")).strip().lower(),
        "question_count": len(questions),
    }


def delete_worksheet(worksheet_id: str) -> bool:
    """Remove worksheet from DB (questions cascade). JSON files are not used after initial seed."""
    conn = db.connect()
    try:
        cur = conn.execute("DELETE FROM worksheets WHERE id = ?", (worksheet_id,))
        deleted = cur.rowcount > 0
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return deleted


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


def list_results(student_name: str) -> list:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT r.id, r.worksheet_id, r.title, r.student, r.score, r.total,
                   r.answers, r.submitted_at,
                   COALESCE(NULLIF(TRIM(w.subject), ''), 'general') AS subject
            FROM results r
            LEFT JOIN worksheets w ON w.id = r.worksheet_id
            WHERE r.student = ?
            ORDER BY r.submitted_at DESC
            """,
            (student_name,),
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
                "subject": r["subject"] or "general",
            }
            for r in rows
        ]
    finally:
        conn.close()
