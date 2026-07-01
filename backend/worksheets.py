import json
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import db
from learn_content import get_subject

WORKSHEETS_DIR = Path(__file__).parent / "data" / "worksheets"
VALID_SUBJECTS = frozenset({"math", "english", "science", "data", "general"})
VALID_EVALUATION = frozenset({"auto", "manual"})
VALID_QUESTION_TYPES = frozenset({"multiple_choice", "short_answer"})
VALID_CHART_TYPES = frozenset({"bar", "line", "pie"})
WORKSHEET_ID_RE = re.compile(r"^questions_\d+$")
STARS_DEFAULT_QUESTION_COUNTS = {1: 25, 2: 20, 3: 15}

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


def _load_bundled_sheet_data(worksheet_id: str) -> dict | None:
    json_path = WORKSHEETS_DIR / f"{worksheet_id}.json"
    if not json_path.is_file():
        return None
    try:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _subject_from_sheet_data(data: dict) -> str | None:
    subject = data.get("subject")
    if isinstance(subject, str):
        key = subject.strip().lower()
        if key in VALID_SUBJECTS:
            return key
    return None


def _resolve_subject(worksheet_id: str, row_subject) -> str:
    """Prefer subject from bundled JSON when the file exists (repo source of truth)."""
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        from_file = _subject_from_sheet_data(data)
        if from_file:
            return from_file
    raw = row_subject
    if raw is not None and str(raw).strip():
        key = str(raw).strip().lower()
        if key in VALID_SUBJECTS:
            return key
    return "general"


def _resolve_title(worksheet_id: str, row_title, ws_id: str) -> str:
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        title = data.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()
    return row_title or ws_id


def _timed_from_sheet_data(data: dict) -> tuple[bool, int | None]:
    if data.get("timed") is True:
        raw = data.get("time_limit_minutes")
        if isinstance(raw, bool):
            raw = None
        if isinstance(raw, (int, float)) and int(raw) > 0:
            return True, int(raw)
    return False, None


def _math_enrichment_from_sheet_data(data: dict) -> bool:
    return data.get("math_enrichment") is True


def _resolve_math_enrichment(worksheet_id: str, row_flag) -> dict:
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        flag = _math_enrichment_from_sheet_data(data)
    else:
        flag = bool(row_flag)
    return {"math_enrichment": flag}


def _gifted_track_from_sheet_data(data: dict) -> bool:
    return data.get("gifted_track") is True


def _resolve_gifted_track(worksheet_id: str, row_flag) -> dict:
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        flag = _gifted_track_from_sheet_data(data)
    else:
        flag = bool(row_flag)
    return {"gifted_track": flag}


GIFTED_TRACK_WEEK_MIN = 1
GIFTED_TRACK_WEEK_MAX = 12
_QUEST_BADGE_RE = re.compile(r"^Quest\s*(\d+)\s*$", re.I)


def _parse_gifted_track_week_value(raw) -> int | None:
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        w = int(raw)
        if GIFTED_TRACK_WEEK_MIN <= w <= GIFTED_TRACK_WEEK_MAX:
            return w
    return None


def _infer_gifted_track_week_from_quest_badge(data: dict) -> int | None:
    badge = data.get("content_badge")
    if not isinstance(badge, str):
        return None
    m = _QUEST_BADGE_RE.match(badge.strip())
    if not m:
        return None
    n = int(m.group(1))
    if 1 <= n <= 6:
        return n * 2 - 1
    if n == 7:
        return GIFTED_TRACK_WEEK_MAX
    return None


def _gifted_track_week_from_sheet_data(data: dict) -> int | None:
    if not _gifted_track_from_sheet_data(data):
        return None
    week = _parse_gifted_track_week_value(data.get("gifted_track_week"))
    if week is not None:
        return week
    return _infer_gifted_track_week_from_quest_badge(data)


def _resolve_gifted_track_week(worksheet_id: str, row_week) -> dict:
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        week = _gifted_track_week_from_sheet_data(data)
    else:
        week = _parse_gifted_track_week_value(row_week)
    if week is not None:
        return {"gifted_track_week": week}
    return {}


def _resolve_timed(worksheet_id: str, row_is_timed, row_limit) -> dict:
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        is_timed, limit = _timed_from_sheet_data(data)
    else:
        is_timed = bool(row_is_timed)
        limit = row_limit
        if limit is not None:
            try:
                limit = int(limit)
            except (TypeError, ValueError):
                limit = None
        if is_timed and (limit is None or limit <= 0):
            is_timed = False
    meta: dict = {"timed": is_timed}
    if is_timed and limit:
        meta["time_limit_minutes"] = limit
    return meta


def _evaluation_from_sheet_data(data: dict) -> str:
    ev = data.get("evaluation", "auto")
    if isinstance(ev, str) and ev.strip().lower() in VALID_EVALUATION:
        return ev.strip().lower()
    return "auto"


def _resolve_evaluation(worksheet_id: str, row_evaluation) -> str:
    data = _load_bundled_sheet_data(worksheet_id)
    if data:
        return _evaluation_from_sheet_data(data)
    raw = row_evaluation
    if raw is not None and str(raw).strip().lower() in VALID_EVALUATION:
        return str(raw).strip().lower()
    return "auto"


def strip_reference_answers_for_student(worksheet: dict) -> dict:
    """Remove model answers from manual worksheets before sending to students."""
    if worksheet.get("evaluation") != "manual":
        return worksheet
    out = dict(worksheet)
    out["questions"] = []
    for q in worksheet.get("questions") or []:
        qc = dict(q)
        if qc.get("type") == "short_answer":
            qc.pop("answer", None)
        out["questions"].append(qc)
    return out


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


def _validate_passage_table(prefix: str, table, errors: list[str]) -> None:
    if table is None:
        return
    if not isinstance(table, dict):
        errors.append(f"{prefix}.table must be an object.")
        return
    headers = table.get("headers")
    rows = table.get("rows")
    if not isinstance(headers, list) or not headers:
        errors.append(f"{prefix}.table.headers must be a non-empty array.")
    elif not all(isinstance(h, str) and h.strip() for h in headers):
        errors.append(f"{prefix}.table.headers must be non-empty strings.")
    if not isinstance(rows, list):
        errors.append(f"{prefix}.table.rows must be an array.")
    elif headers and isinstance(headers, list):
        n = len(headers)
        for ri, row in enumerate(rows):
            if not isinstance(row, list) or len(row) != n:
                errors.append(
                    f"{prefix}.table.rows[{ri}] must be an array of length {n}."
                )


def _validate_passage_chart(prefix: str, chart, errors: list[str]) -> None:
    if chart is None:
        return
    if not isinstance(chart, dict):
        errors.append(f"{prefix}.chart must be an object.")
        return
    ctype = chart.get("type")
    if not isinstance(ctype, str) or ctype.strip().lower() not in VALID_CHART_TYPES:
        errors.append(
            f"{prefix}.chart.type must be one of: {', '.join(sorted(VALID_CHART_TYPES))}."
        )
    labels = chart.get("labels")
    values = chart.get("values")
    if not isinstance(labels, list) or not labels:
        errors.append(f"{prefix}.chart.labels must be a non-empty array.")
    elif not all(isinstance(x, str) and x.strip() for x in labels):
        errors.append(f"{prefix}.chart.labels must be non-empty strings.")
    if not isinstance(values, list) or not values:
        errors.append(f"{prefix}.chart.values must be a non-empty array.")
    elif labels and isinstance(labels, list) and len(values) != len(labels):
        errors.append(f"{prefix}.chart.values must match labels length.")
    else:
        for vi, val in enumerate(values):
            if isinstance(val, bool) or not isinstance(val, (int, float)):
                errors.append(f"{prefix}.chart.values[{vi}] must be a number.")
            elif float(val) < 0:
                errors.append(f"{prefix}.chart.values[{vi}] must be >= 0.")
    for key in ("title", "xLabel", "yLabel"):
        val = chart.get(key)
        if val is not None and (not isinstance(val, str) or not val.strip()):
            errors.append(f"{prefix}.chart.{key} must be a non-empty string when set.")


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
    evaluation = _evaluation_from_sheet_data(data)
    is_timed, time_limit = _timed_from_sheet_data(data)
    is_enrichment = _math_enrichment_from_sheet_data(data)
    is_gifted = _gifted_track_from_sheet_data(data)
    gifted_week = _gifted_track_week_from_sheet_data(data) if is_gifted else None
    conn.execute(
        """
        INSERT INTO worksheets (id, title, subject, scratchpad, passages, sort_ts, learn_subject, learn_section, content_badge, evaluation, is_timed, time_limit_minutes, is_math_enrichment, is_gifted_track, gifted_track_week)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (ws_id, title, subject, scratchpad, passages, sort_ts, learn_subject, learn_section, content_badge, evaluation, 1 if is_timed else 0, time_limit, 1 if is_enrichment else 0, 1 if is_gifted else 0, gifted_week),
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
                       t.learn_subject, t.learn_section, t.content_badge, t.evaluation,
                       t.is_timed, t.time_limit_minutes, t.is_math_enrichment, t.is_gifted_track, t.gifted_track_week,
                       t.last_score, t.last_total, t.last_status, t.draft_saved_at,
                       t.timed_locked, t.timed_started
                FROM (
                    SELECT w.id, w.title, w.subject, w.scratchpad, w.sort_ts,
                           w.learn_subject, w.learn_section, w.content_badge, w.evaluation,
                           w.is_timed, w.time_limit_minutes, w.is_math_enrichment, w.is_gifted_track, w.gifted_track_week,
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
                            ORDER BY r.submitted_at DESC LIMIT 1) AS last_total,
                           (SELECT r.status FROM results r
                            WHERE r.worksheet_id = w.id AND r.student = ?
                            ORDER BY r.submitted_at DESC LIMIT 1) AS last_status,
                           (SELECT d.saved_at FROM worksheet_drafts d
                            WHERE d.worksheet_id = w.id AND d.student = ?) AS draft_saved_at,
                           (SELECT t.locked FROM timed_attempts t
                            WHERE t.worksheet_id = w.id AND t.student = ?) AS timed_locked,
                           (SELECT 1 FROM timed_attempts t
                            WHERE t.worksheet_id = w.id AND t.student = ?) AS timed_started
                    FROM worksheets w
                ) t
                ORDER BY t.done ASC, t.sort_ts DESC, t.id DESC
                """,
                (student_name, student_name, student_name, student_name, student_name, student_name, student_name),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT t.id, t.title, t.subject, t.scratchpad, t.sort_ts, t.question_count, t.done,
                       t.learn_subject, t.learn_section, t.content_badge, t.evaluation,
                       t.is_timed, t.time_limit_minutes, t.is_math_enrichment, t.is_gifted_track, t.gifted_track_week,
                       t.last_score, t.last_total
                FROM (
                    SELECT w.id, w.title, w.subject, w.scratchpad, w.sort_ts,
                           w.learn_subject, w.learn_section, w.content_badge, w.evaluation,
                           w.is_timed, w.time_limit_minutes, w.is_math_enrichment, w.is_gifted_track, w.gifted_track_week,
                           (SELECT COUNT(*) FROM worksheet_questions q WHERE q.worksheet_id = w.id) AS question_count,
                           EXISTS (
                             SELECT 1 FROM results r
                             WHERE r.worksheet_id = w.id
                           ) AS done,
                           CAST(NULL AS INTEGER) AS last_score,
                           CAST(NULL AS INTEGER) AS last_total,
                           CAST(NULL AS TEXT) AS last_status,
                           CAST(NULL AS TEXT) AS draft_saved_at,
                           CAST(NULL AS INTEGER) AS timed_locked,
                           CAST(NULL AS INTEGER) AS timed_started
                    FROM worksheets w
                ) t
                ORDER BY t.done ASC, t.sort_ts DESC, t.id DESC
                """
            ).fetchall()
        out_list = []
        for r in rows:
            item = {
                "id": r["id"],
                "title": _resolve_title(r["id"], r["title"], r["id"]),
                "subject": _resolve_subject(r["id"], r["subject"]),
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
            last_status = r["last_status"] or "evaluated"
            item["evaluation"] = _resolve_evaluation(r["id"], r["evaluation"])
            item.update(_resolve_timed(r["id"], r["is_timed"], r["time_limit_minutes"]))
            item.update(_resolve_math_enrichment(r["id"], r["is_math_enrichment"]))
            item.update(_resolve_gifted_track(r["id"], r["is_gifted_track"]))
            item.update(_resolve_gifted_track_week(r["id"], r["gifted_track_week"]))
            draft_at = r["draft_saved_at"] if student_name is not None else None
            if draft_at and not item["done"] and not item.get("timed"):
                item["has_draft"] = True
                item["draft_saved_at"] = draft_at
            if student_name is not None and item.get("timed") and not item["done"]:
                if r["timed_started"]:
                    item["timed_started"] = True
                if r["timed_locked"]:
                    item["timed_locked"] = True
            if last_status:
                item["last_status"] = last_status
            if (
                last_status == "evaluated"
                and ls_ is not None
                and lt_ is not None
                and int(lt_) > 0
                and int(ls_) >= 0
            ):
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
            SELECT title, subject, scratchpad, passages, learn_subject, learn_section, content_badge, evaluation, is_timed, time_limit_minutes, is_math_enrichment, is_gifted_track, gifted_track_week
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
            "title": _resolve_title(worksheet_id, row["title"], worksheet_id),
            "subject": _resolve_subject(worksheet_id, row["subject"]),
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
        out["evaluation"] = _resolve_evaluation(worksheet_id, row["evaluation"])
        out.update(_resolve_timed(worksheet_id, row["is_timed"], row["time_limit_minutes"]))
        out.update(_resolve_math_enrichment(worksheet_id, row["is_math_enrichment"]))
        out.update(_resolve_gifted_track(worksheet_id, row["is_gifted_track"]))
        out.update(_resolve_gifted_track_week(worksheet_id, row["gifted_track_week"]))
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


def _worksheet_id_numeric_suffix(ws_id: str) -> int | None:
    m = re.fullmatch(r"questions_(\d+)", ws_id)
    if not m:
        return None
    return int(m.group(1))


def next_worksheet_id() -> str:
    """Allocate the next ``questions_N`` id from DB and bundled JSON files."""
    max_n = 0
    conn = db.connect()
    try:
        rows = conn.execute("SELECT id FROM worksheets").fetchall()
    finally:
        conn.close()
    for row in rows:
        n = _worksheet_id_numeric_suffix(row["id"])
        if n is not None:
            max_n = max(max_n, n)
    if WORKSHEETS_DIR.is_dir():
        for path in WORKSHEETS_DIR.glob("questions_*.json"):
            n = _worksheet_id_numeric_suffix(path.stem)
            if n is not None:
                max_n = max(max_n, n)
    return f"questions_{max_n + 1}"


def _shuffle_mcq_choices(choices: list[str], answer: str) -> list[str]:
    """Randomize choice order; ``answer`` must be one of the choice strings."""
    shuffled = list(choices)
    random.shuffle(shuffled)
    if answer not in shuffled:
        raise ValueError("answer must match one of the choices.")
    return shuffled


def worksheet_data_from_builder(body: dict) -> dict:
    """Turn admin builder payload into worksheet JSON (before upsert validation)."""
    errors: list[str] = []

    title = body.get("title")
    if not isinstance(title, str) or not title.strip():
        errors.append("title is required.")

    subject = body.get("subject", "general")
    if not isinstance(subject, str) or subject.strip().lower() not in VALID_SUBJECTS:
        errors.append(
            f"subject must be one of: {', '.join(sorted(VALID_SUBJECTS))}."
        )
    else:
        subject = subject.strip().lower()

    stars = body.get("stars")
    if not isinstance(stars, (int, float)) or int(stars) not in (1, 2, 3):
        errors.append("stars must be 1, 2, or 3.")
    else:
        stars = int(stars)

    fmt = body.get("format")
    if fmt not in ("multiple_choice", "short_answer"):
        errors.append("format must be multiple_choice or short_answer.")

    if fmt == "short_answer" and subject != "math":
        errors.append("short_answer worksheets must use subject math (manual grading).")

    timed = body.get("timed") is True
    time_limit = body.get("time_limit_minutes")
    if timed:
        if not isinstance(time_limit, (int, float)) or int(time_limit) <= 0:
            errors.append("time_limit_minutes must be a positive integer when timed is true.")
        else:
            time_limit = int(time_limit)

    raw_questions = body.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        errors.append("questions must be a non-empty array.")
    if errors:
        raise ValueError(errors)

    expected_count = body.get("question_count")
    if isinstance(expected_count, (int, float)) and int(expected_count) > 0:
        if len(raw_questions) != int(expected_count):
            raise ValueError(
                [
                    f"Expected {int(expected_count)} questions but received {len(raw_questions)}."
                ]
            )

    evaluation = "manual" if fmt == "short_answer" else "auto"
    qtype = fmt
    built_questions: list[dict] = []

    for i, raw in enumerate(raw_questions):
        prefix = f"questions[{i}]"
        if not isinstance(raw, dict):
            errors.append(f"{prefix} must be an object.")
            continue

        prompt = raw.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            errors.append(f"{prefix}.prompt is required.")
            continue

        q_obj: dict = {
            "id": f"q{i + 1}",
            "type": qtype,
            "stars": stars,
            "prompt": prompt.strip(),
            "hint": False,
        }

        if fmt == "multiple_choice":
            choices = raw.get("choices")
            correct_index = raw.get("correct_index")
            if not isinstance(choices, list) or len(choices) != 4:
                errors.append(f"{prefix}.choices must contain exactly 4 items.")
                continue
            trimmed = [str(c).strip() for c in choices]
            if any(not c for c in trimmed):
                errors.append(f"{prefix}.choices must all be non-empty.")
                continue
            if len(set(trimmed)) < 4:
                errors.append(f"{prefix}.choices must be unique.")
                continue
            if not isinstance(correct_index, (int, float)) or int(correct_index) not in (0, 1, 2, 3):
                errors.append(f"{prefix}.correct_index must be 0, 1, 2, or 3.")
                continue
            answer = trimmed[int(correct_index)]
            q_obj["choices"] = _shuffle_mcq_choices(trimmed, answer)
            q_obj["answer"] = answer
        else:
            answer = raw.get("answer")
            if not isinstance(answer, str) or not answer.strip():
                errors.append(f"{prefix}.answer is required.")
                continue
            q_obj["answer"] = answer.strip()

        built_questions.append(q_obj)

    if errors:
        raise ValueError(errors)

    data: dict = {
        "title": title.strip(),
        "subject": subject,
        "scratchpad": subject != "english",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "questions": built_questions,
    }
    if evaluation == "manual":
        data["evaluation"] = "manual"
    if timed:
        data["timed"] = True
        data["time_limit_minutes"] = time_limit
    return data


def create_worksheet_from_builder(body: dict) -> dict:
    """Validate builder input, assign id, and upsert worksheet."""
    data = worksheet_data_from_builder(body)
    ws_id = next_worksheet_id()
    return upsert_worksheet_from_data(ws_id, data)

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
                prefix = f"passages[{i}]"
                body = p.get("text") or p.get("body")
                has_body = isinstance(body, str) and body.strip()
                chart = p.get("chart")
                table = p.get("table")
                has_chart = chart is not None
                has_table = table is not None
                if not has_body and not has_chart and not has_table:
                    errors.append(
                        f"{prefix} needs text/body, chart, and/or table content."
                    )
                _validate_passage_chart(prefix, chart, errors)
                _validate_passage_table(prefix, table, errors)

    badge = data.get("content_badge")
    if badge is not None and (not isinstance(badge, str) or not badge.strip()):
        errors.append("content_badge must be a non-empty string when set.")

    evaluation = _evaluation_from_sheet_data(data)
    if evaluation == "manual":
        subj = subject.strip().lower() if isinstance(subject, str) else "general"
        if subj != "math":
            errors.append("evaluation manual is only allowed for math worksheets.")

    is_timed, time_limit = _timed_from_sheet_data(data)
    if data.get("timed") is True and not is_timed:
        errors.append("time_limit_minutes must be a positive integer when timed is true.")
    if is_timed and evaluation == "manual":
        pass  # allowed: timed written-answer worksheets

    if data.get("math_enrichment") is True and data.get("gifted_track") is True:
        errors.append("A worksheet cannot be both math_enrichment and gifted_track.")

    if data.get("math_enrichment") is True:
        subj = subject.strip().lower() if isinstance(subject, str) else "general"
        if subj != "math":
            errors.append("math_enrichment is only allowed for math worksheets.")

    if data.get("gifted_track") is True:
        if _parse_gifted_track_week_value(data.get("gifted_track_week")) is None:
            errors.append(
                f"gifted_track_week is required (integer {GIFTED_TRACK_WEEK_MIN}–"
                f"{GIFTED_TRACK_WEEK_MAX}) when gifted_track is true."
            )
    elif data.get("gifted_track_week") is not None:
        errors.append("gifted_track_week is only allowed when gifted_track is true.")

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
        if qtype not in VALID_QUESTION_TYPES:
            errors.append(
                f"questions[{i}].type must be one of: {', '.join(sorted(VALID_QUESTION_TYPES))}."
            )
            continue

        if evaluation == "manual" and qtype != "short_answer":
            errors.append(
                f"questions[{i}].type must be short_answer when evaluation is manual."
            )
        if evaluation != "manual" and qtype != "multiple_choice":
            errors.append(
                f"questions[{i}].type must be multiple_choice when evaluation is auto."
            )

        prompt = q.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            errors.append(f"questions[{i}].prompt is required.")

        answer = q.get("answer")
        if not isinstance(answer, str) or not answer.strip():
            errors.append(f"questions[{i}].answer is required.")

        if qtype == "multiple_choice":
            choices = q.get("choices")
            if not isinstance(choices, list) or len(choices) < 2:
                errors.append(f"questions[{i}].choices must have at least 2 items.")
            elif isinstance(answer, str) and answer.strip() and answer not in choices:
                errors.append(f"questions[{i}].answer must match one of choices.")
        elif qtype == "short_answer" and q.get("choices") is not None:
            errors.append(f"questions[{i}].choices must not be set for short_answer.")

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


def clear_student_progress(student_name: str, worksheet_id: str) -> None:
    conn = db.connect()
    try:
        conn.execute(
            "DELETE FROM worksheet_drafts WHERE student = ? AND worksheet_id = ?",
            (student_name, worksheet_id),
        )
        conn.execute(
            "DELETE FROM timed_attempts WHERE student = ? AND worksheet_id = ?",
            (student_name, worksheet_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_worksheet_draft(student_name: str, worksheet_id: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT answers, saved_at FROM worksheet_drafts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            return None
        answers = json.loads(row["answers"])
        if not isinstance(answers, dict):
            answers = {}
        return {"answers": answers, "saved_at": row["saved_at"]}
    finally:
        conn.close()


def save_worksheet_draft(student_name: str, worksheet_id: str, answers: dict) -> dict:
    ws = get_worksheet(worksheet_id)
    if not ws:
        raise ValueError("Worksheet not found.")
    if ws.get("timed"):
        raise ValueError("Saving progress is not allowed on timed worksheets.")
    if student_has_result_for_worksheet(student_name, worksheet_id):
        raise ValueError("Worksheet already submitted.")

    saved_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO worksheet_drafts (student, worksheet_id, answers, saved_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student, worksheet_id) DO UPDATE SET
              answers = excluded.answers,
              saved_at = excluded.saved_at
            """,
            (student_name, worksheet_id, json.dumps(answers), saved_at),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"saved_at": saved_at}


def _timed_remaining_seconds(started_at_iso: str, limit_minutes: int) -> tuple[int, bool]:
    started = datetime.fromisoformat(started_at_iso.replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    total = limit_minutes * 60
    remaining = int(max(0, total - elapsed))
    return remaining, remaining <= 0


def get_or_start_timed_session(
    student_name: str, worksheet_id: str, *, resume: bool = False
) -> dict:
    ws = get_worksheet(worksheet_id)
    if not ws:
        raise ValueError("Worksheet not found.")
    if not ws.get("timed"):
        raise ValueError("This worksheet is not timed.")
    limit = ws.get("time_limit_minutes")
    if not limit or int(limit) <= 0:
        raise ValueError("Timed worksheet is missing a time limit.")

    limit = int(limit)
    if student_has_result_for_worksheet(student_name, worksheet_id):
        raise ValueError("Worksheet already submitted.")

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT started_at, locked FROM timed_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if row:
            if int(row["locked"] or 0) == 1:
                raise ValueError(
                    "This timed worksheet is locked. Ask your teacher to unlock it."
                )
            if resume:
                started_at = row["started_at"]
            else:
                started_at = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    """
                    UPDATE timed_attempts
                    SET started_at = ?, locked = 0
                    WHERE student = ? AND worksheet_id = ?
                    """,
                    (started_at, student_name, worksheet_id),
                )
                conn.commit()
        else:
            started_at = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO timed_attempts (student, worksheet_id, started_at, locked)
                VALUES (?, ?, ?, 0)
                """,
                (student_name, worksheet_id, started_at),
            )
            conn.commit()

        remaining, expired = _timed_remaining_seconds(started_at, limit)
        expires_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        expires_at = expires_at + timedelta(minutes=limit)
        return {
            "started_at": started_at,
            "expires_at": expires_at.isoformat(),
            "remaining_seconds": remaining,
            "expired": expired,
            "time_limit_minutes": limit,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def lock_timed_worksheet(student_name: str, worksheet_id: str) -> None:
    """Lock a timed attempt when the student leaves without submitting."""
    ws = get_worksheet(worksheet_id)
    if not ws or not ws.get("timed"):
        return
    if student_has_result_for_worksheet(student_name, worksheet_id):
        return
    conn = db.connect()
    try:
        conn.execute(
            """
            UPDATE timed_attempts SET locked = 1
            WHERE student = ? AND worksheet_id = ? AND locked = 0
            """,
            (student_name, worksheet_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def unlock_timed_worksheet(student_name: str, worksheet_id: str) -> None:
    """Admin reset: remove timed attempt so the student can start again."""
    ws = get_worksheet(worksheet_id)
    if not ws:
        raise ValueError("Worksheet not found.")
    if not ws.get("timed"):
        raise ValueError("This worksheet is not timed.")
    if student_has_result_for_worksheet(student_name, worksheet_id):
        raise ValueError("Worksheet already submitted — cannot unlock.")
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            DELETE FROM timed_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        )
        if cur.rowcount == 0:
            raise ValueError("No timed attempt to unlock.")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_result(result: dict):
    submitted_at = datetime.now(timezone.utc).isoformat()
    status = result.get("status", "evaluated")
    if status not in ("pending", "evaluated"):
        status = "evaluated"
    score = result.get("score")
    if status == "pending":
        score = -1
    elif score is None:
        score = 0
    evaluated_at = result.get("evaluated_at")
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO results (worksheet_id, title, student, score, total, answers, submitted_at, status, evaluated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result["worksheet_id"],
                result["title"],
                result["student"],
                score,
                result["total"],
                json.dumps(result["answers"]),
                submitted_at,
                status,
                evaluated_at,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    clear_student_progress(result["student"], result["worksheet_id"])


def _result_row_to_dict(r) -> dict:
    status = r["status"] if r["status"] else "evaluated"
    score = r["score"]
    if status == "evaluated" and score is not None and int(score) < 0:
        score = 0
    out = {
        "id": r["id"],
        "worksheet_id": r["worksheet_id"],
        "title": r["title"],
        "student": r["student"],
        "score": score if status == "evaluated" else None,
        "total": r["total"],
        "answers": json.loads(r["answers"]),
        "submitted_at": r["submitted_at"],
        "status": status,
        "subject": r["subject"] or "general",
    }
    if r["evaluated_at"]:
        out["evaluated_at"] = r["evaluated_at"]
    return out


def get_student_result_for_worksheet(student_name: str, worksheet_id: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT r.id, r.worksheet_id, r.title, r.student, r.score, r.total,
                   r.answers, r.submitted_at, r.status, r.evaluated_at,
                   COALESCE(NULLIF(TRIM(w.subject), ''), 'general') AS subject
            FROM results r
            LEFT JOIN worksheets w ON w.id = r.worksheet_id
            WHERE r.student = ? AND r.worksheet_id = ?
            ORDER BY r.submitted_at DESC
            LIMIT 1
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            return None
        return _result_row_to_dict(row)
    finally:
        conn.close()


def student_has_result_for_worksheet(student_name: str, worksheet_id: str) -> bool:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT 1 FROM results
            WHERE student = ? AND worksheet_id = ?
            LIMIT 1
            """,
            (student_name, worksheet_id),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def evaluate_result(result_id: int, student_name: str, marks: list[dict]) -> dict:
    """Admin marks a pending submission. marks: [{question_id, correct}, ...]."""
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, worksheet_id, title, student, score, total, answers, status
            FROM results WHERE id = ?
            """,
            (result_id,),
        ).fetchone()
        if not row:
            raise ValueError("Result not found.")
        if row["student"] != student_name:
            raise ValueError("Result does not belong to the selected student.")
        if row["status"] != "pending":
            raise ValueError("This submission has already been evaluated.")

        answers = json.loads(row["answers"])
        mark_by_qid = {
            m["question_id"]: bool(m["correct"])
            for m in marks
            if isinstance(m, dict) and m.get("question_id")
        }
        score = 0
        for a in answers:
            qid = a.get("question_id")
            if qid in mark_by_qid:
                a["correct"] = mark_by_qid[qid]
            elif a.get("correct") is None:
                a["correct"] = False
            if a.get("correct"):
                score += 1

        evaluated_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            UPDATE results
            SET score = ?, answers = ?, status = 'evaluated', evaluated_at = ?
            WHERE id = ?
            """,
            (score, json.dumps(answers), evaluated_at, result_id),
        )
        conn.commit()
        updated = conn.execute(
            """
            SELECT r.id, r.worksheet_id, r.title, r.student, r.score, r.total,
                   r.answers, r.submitted_at, r.status, r.evaluated_at,
                   COALESCE(NULLIF(TRIM(w.subject), ''), 'general') AS subject
            FROM results r
            LEFT JOIN worksheets w ON w.id = r.worksheet_id
            WHERE r.id = ?
            """,
            (result_id,),
        ).fetchone()
        return _result_row_to_dict(updated)
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
                   r.answers, r.submitted_at, r.status, r.evaluated_at,
                   COALESCE(NULLIF(TRIM(w.subject), ''), 'general') AS subject,
                   COALESCE(w.evaluation, 'auto') AS evaluation
            FROM results r
            LEFT JOIN worksheets w ON w.id = r.worksheet_id
            WHERE r.student = ?
            ORDER BY r.submitted_at DESC
            """,
            (student_name,),
        ).fetchall()
        out = []
        for r in rows:
            item = _result_row_to_dict(r)
            ev = r["evaluation"]
            if ev and str(ev).strip().lower() == "manual":
                item["evaluation"] = "manual"
            out.append(item)
        return out
    finally:
        conn.close()
