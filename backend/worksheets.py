import json
from datetime import datetime, timezone
from pathlib import Path

import db
from learn_content import get_subject

WORKSHEETS_DIR = Path(__file__).parent / "data" / "worksheets"


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
    conn.execute(
        """
        INSERT INTO worksheets (id, title, subject, scratchpad, passages, sort_ts, learn_subject, learn_section)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (ws_id, title, subject, scratchpad, passages, sort_ts, learn_subject, learn_section),
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


def merge_worksheets_from_json_files() -> None:
    """Upsert each worksheet that has a JSON file; other rows in the DB are unchanged."""
    conn = db.connect()
    try:
        for path in sorted(WORKSHEETS_DIR.glob("*.json")):
            with open(path) as f:
                data = json.load(f)
            ws_id = path.stem
            conn.execute("DELETE FROM worksheets WHERE id = ?", (ws_id,))
            _insert_worksheet(conn, ws_id, data, path)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_worksheets(student_name: str | None = None) -> list:
    """If student_name is set, done = this student submitted. If None (admin), done = any submission."""
    conn = db.connect()
    try:
        # Scalar subqueries avoid GROUP BY + EXISTS quirks in SQLite.
        if student_name is not None:
            rows = conn.execute(
                """
                SELECT t.id, t.title, t.subject, t.scratchpad, t.sort_ts, t.question_count, t.done,
                       t.learn_subject, t.learn_section, t.last_score, t.last_total
                FROM (
                    SELECT w.id, w.title, w.subject, w.scratchpad, w.sort_ts,
                           w.learn_subject, w.learn_section,
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
                       t.learn_subject, t.learn_section, t.last_score, t.last_total
                FROM (
                    SELECT w.id, w.title, w.subject, w.scratchpad, w.sort_ts,
                           w.learn_subject, w.learn_section,
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
            SELECT title, subject, scratchpad, passages, learn_subject, learn_section
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
        return out
    finally:
        conn.close()


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
