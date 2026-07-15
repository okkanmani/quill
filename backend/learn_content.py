"""Load Markdown learning material from backend/data/learn/<subject>/ and SQLite."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import db

LEARN_DIR = Path(__file__).parent / "data" / "learn"


def _slugify(text: str, *, max_len: int = 60) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower().strip())
    return s.strip("-")[:max_len] or "section"


def _normalize_subject_key(key: str) -> str:
    return _slugify(key, max_len=80)


def _db_subject_catalog() -> dict[str, dict]:
    """subject_key → {title, description} from newest row per key."""
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT subject_key, subject_title, subject_description, grade, curriculum, created_at
            FROM learn_sections
            ORDER BY created_at DESC
            """
        ).fetchall()
        out: dict[str, dict] = {}
        for row in rows:
            key = row["subject_key"]
            if key in out:
                continue
            title = row["subject_title"] or key.replace("-", " ").title()
            desc = row["subject_description"] or ""
            if row["grade"] and row["curriculum"]:
                desc = desc or f"Grade {row['grade']} · {row['curriculum']}"
            out[key] = {"key": key, "title": title, "description": desc}
        return out
    finally:
        conn.close()


def _db_sections(subject_key: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT section_id, title, markdown, group_id, group_title
            FROM learn_sections
            WHERE subject_key = ?
            ORDER BY id ASC
            """,
            (subject_key,),
        ).fetchall()
        return [
            {
                "id": row["section_id"],
                "title": row["title"],
                "markdown": row["markdown"],
                "group_id": row["group_id"] or "main",
                "group_title": row["group_title"] or "Sections",
            }
            for row in rows
        ]
    finally:
        conn.close()


def list_admin_learn_sections() -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT subject_key, section_id, title, subject_title, subject_description, created_at
            FROM learn_sections
            ORDER BY subject_key ASC, id ASC
            """
        ).fetchall()
        return [
            {
                "subject_key": row["subject_key"],
                "section_id": row["section_id"],
                "title": row["title"],
                "subject_title": row["subject_title"]
                or row["subject_key"].replace("-", " ").title(),
                "subject_description": row["subject_description"] or "",
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def list_subjects() -> list[dict]:
    out: list[dict] = []
    if LEARN_DIR.is_dir():
        for d in sorted(LEARN_DIR.iterdir()):
            if not d.is_dir():
                continue
            man = d / "manifest.json"
            if not man.exists():
                continue
            with open(man, encoding="utf-8") as f:
                m = json.load(f)
            out.append(
                {
                    "key": d.name,
                    "title": m.get("title", d.name),
                    "description": m.get("description", ""),
                }
            )
    db_catalog = _db_subject_catalog()
    keys = {s["key"] for s in out}
    for key, meta in db_catalog.items():
        if key not in keys:
            out.append(meta)
    out.sort(key=lambda s: s["key"])
    return out


def learn_collection_key(*, subject: str, grade: int, curriculum: str) -> str:
    return _normalize_subject_key(f"{subject}-{curriculum}-g{grade}")


def _fs_subject_meta(subject_key: str) -> dict | None:
    subj_dir = LEARN_DIR / subject_key.strip().lower()
    man_path = subj_dir / "manifest.json"
    if not man_path.exists():
        return None
    with open(man_path, encoding="utf-8") as f:
        manifest = json.load(f)
    return {
        "title": manifest.get("title", subject_key),
        "description": manifest.get("description", ""),
    }


def list_learn_hub() -> dict:
    """Hub layout for Learn landing page (flat subjects or grouped)."""
    subjects_by_key = {s["key"]: s for s in list_subjects()}
    hub_path = LEARN_DIR / "hub.json"
    if not hub_path.is_file():
        return {
            "entries": [{"type": "subject", **s} for s in subjects_by_key.values()]
        }

    with open(hub_path, encoding="utf-8") as f:
        raw = json.load(f)

    entries: list[dict] = []
    for item in raw.get("entries", []):
        kind = item.get("type", "subject")
        if kind == "group":
            group_subjects: list[dict] = []
            for ref in item.get("items", []):
                key = ref if isinstance(ref, str) else ref.get("key")
                if key and key in subjects_by_key:
                    group_subjects.append(subjects_by_key[key])
            if group_subjects:
                entries.append(
                    {
                        "type": "group",
                        "id": item.get("id", ""),
                        "title": item.get("title", ""),
                        "description": item.get("description", ""),
                        "subjects": group_subjects,
                    }
                )
        elif kind == "subject":
            key = item.get("key")
            if key and key in subjects_by_key:
                entries.append({"type": "subject", **subjects_by_key[key]})
    if not entries:
        return {
            "entries": [{"type": "subject", **s} for s in subjects_by_key.values()]
        }

    hub_keys: set[str] = set()
    for entry in entries:
        if entry.get("type") == "subject":
            hub_keys.add(entry["key"])
        elif entry.get("type") == "group":
            for subj in entry.get("subjects", []):
                hub_keys.add(subj["key"])
    for key, meta in subjects_by_key.items():
        if key not in hub_keys:
            entries.append({"type": "subject", **meta})

    return {"entries": entries}


def _is_hidden_learn_group(group_id: str, group_title: str) -> bool:
    gid = (group_id or "").strip().lower()
    gtitle = (group_title or "").strip()
    if gid in ("main", "ai-generated"):
        return True
    if not gtitle or gtitle.lower() in ("sections", "ai generated"):
        return True
    return False


def _ungrouped_bucket(groups_out: list, by_group: dict) -> dict:
    key = ""
    if key not in by_group:
        bucket = {"id": "", "title": "", "sections": []}
        groups_out.append(bucket)
        by_group[key] = bucket
    return by_group[key]
def _merge_db_sections(subject_key: str, groups_out: list, flat_sections: list) -> None:
    db_secs = _db_sections(subject_key)
    if not db_secs:
        return
    by_group: dict[str, dict] = {}
    for g in groups_out:
        gid = g.get("id") or ""
        by_group[gid] = g
    for sec in db_secs:
        gid = sec.pop("group_id", "main")
        gtitle = sec.pop("group_title", "")
        loaded = {**sec, "source": "db", "group_id": gid, "group_title": gtitle}
        if _is_hidden_learn_group(gid, gtitle):
            bucket = _ungrouped_bucket(groups_out, by_group)
            bucket["sections"].append(loaded)
        else:
            if gid not in by_group:
                bucket = {"id": gid, "title": gtitle, "sections": []}
                groups_out.append(bucket)
                by_group[gid] = bucket
            by_group[gid]["sections"].append(loaded)
        flat_sections.append(loaded)


def publish_learn_section(
    *,
    subject_key: str,
    section_title: str,
    markdown: str,
    subject_title: str | None = None,
    subject_description: str | None = None,
    group_id: str = "main",
    group_title: str = "",
    grade: int | None = None,
    curriculum: str | None = None,
) -> dict:
    subject_key = _normalize_subject_key(subject_key)
    if not subject_key:
        raise ValueError("Learn collection key is required.")
    section_title = (section_title or "").strip()
    markdown = (markdown or "").strip()
    if not section_title:
        raise ValueError("Section title is required.")
    if not markdown:
        raise ValueError("Markdown content is required.")

    base_id = _slugify(section_title)
    section_id = base_id
    conn = db.connect()
    try:
        existing_ids = {
            row[0]
            for row in conn.execute(
                "SELECT section_id FROM learn_sections WHERE subject_key = ?",
                (subject_key,),
            ).fetchall()
        }
        n = 2
        while section_id in existing_ids:
            section_id = f"{base_id}-{n}"
            n += 1

        fs_meta = _fs_subject_meta(subject_key)
        if fs_meta and not subject_title:
            subject_title = fs_meta.get("title")
        if fs_meta and not subject_description:
            subject_description = fs_meta.get("description")

        if not subject_title:
            subject_title = subject_key.replace("-", " ").title()
        if not subject_description and grade and curriculum:
            subject_description = f"Grade {grade} · {curriculum}"

        created_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO learn_sections (
                subject_key, section_id, title, markdown,
                group_id, group_title, subject_title, subject_description,
                grade, curriculum, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_key,
                section_id,
                section_title,
                markdown,
                (group_id or "main").strip() or "main",
                (group_title or "").strip(),
                subject_title,
                subject_description,
                grade,
                (curriculum or "").strip() or None,
                created_at,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "subject_key": subject_key,
        "section_id": section_id,
        "title": section_title,
        "learn_url": f"/student/learn/{subject_key}#{section_id}",
    }


def update_learn_section(
    *,
    subject_key: str,
    section_id: str,
    title: str,
    markdown: str,
) -> dict:
    subject_key = subject_key.strip().lower()
    section_id = section_id.strip().lower()
    title = (title or "").strip()
    markdown = (markdown or "").strip()
    if not title:
        raise ValueError("Section title is required.")
    if not markdown:
        raise ValueError("Markdown content is required.")

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM learn_sections
            WHERE subject_key = ? AND section_id = ?
            """,
            (subject_key, section_id),
        ).fetchone()
        if not row:
            raise ValueError("Learning resource not found or not editable.")

        conn.execute(
            """
            UPDATE learn_sections
            SET title = ?, markdown = ?
            WHERE subject_key = ? AND section_id = ?
            """,
            (title, markdown, subject_key, section_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "subject_key": subject_key,
        "section_id": section_id,
        "title": title,
        "learn_url": f"/student/learn/{subject_key}#{section_id}",
    }


def delete_learn_section(*, subject_key: str, section_id: str) -> dict:
    subject_key = subject_key.strip().lower()
    section_id = section_id.strip().lower()

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM learn_sections
            WHERE subject_key = ? AND section_id = ?
            """,
            (subject_key, section_id),
        ).fetchone()
        if not row:
            raise ValueError("Learning resource not found or not deletable.")

        conn.execute(
            "DELETE FROM learn_sections WHERE subject_key = ? AND section_id = ?",
            (subject_key, section_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"subject_key": subject_key, "section_id": section_id}


def _load_section(subj_dir: Path, sec: dict) -> dict | None:
    fid = sec.get("file")
    if not fid:
        return None
    path = subj_dir / fid
    if not path.is_file():
        return None
    body = path.read_text(encoding="utf-8")
    sid = sec.get("id", Path(fid).stem)
    return {
        "id": sid,
        "title": sec.get("title", sid),
        "markdown": body,
        "source": "file",
    }


def _load_fs_subject(subject: str) -> dict | None:
    subj_dir = LEARN_DIR / subject.strip().lower()
    man_path = subj_dir / "manifest.json"
    if not man_path.exists():
        return None
    with open(man_path, encoding="utf-8") as f:
        manifest = json.load(f)

    groups_out: list[dict] = []
    flat_sections: list[dict] = []

    raw_groups = manifest.get("groups")
    if raw_groups:
        for g in raw_groups:
            gid = (g.get("id") or "").strip()
            gtitle = (g.get("title") or "").strip()
            bucket: list[dict] = []
            for sec in g.get("sections", []):
                loaded = _load_section(subj_dir, sec)
                if not loaded:
                    continue
                loaded = {**loaded, "group_id": gid, "group_title": gtitle, "source": "file"}
                bucket.append(loaded)
                flat_sections.append(loaded)
            if bucket:
                groups_out.append({"id": gid, "title": gtitle, "sections": bucket})
    else:
        for sec in manifest.get("sections", []):
            loaded = _load_section(subj_dir, sec)
            if loaded:
                loaded = {**loaded, "source": "file"}
                flat_sections.append(loaded)
        if flat_sections:
            groups_out.append(
                {"id": "", "title": "", "sections": flat_sections},
            )

    return {
        "key": subj_dir.name,
        "title": manifest.get("title", subject),
        "description": manifest.get("description", ""),
        "groups": groups_out,
        "sections": flat_sections,
    }


def get_subject(subject: str) -> dict | None:
    subject = subject.strip().lower()
    data = _load_fs_subject(subject)
    if data:
        _merge_db_sections(subject, data["groups"], data["sections"])
        return data

    catalog = _db_subject_catalog()
    db_secs = _db_sections(subject)
    if subject not in catalog and not db_secs:
        return None

    meta = catalog.get(
        subject,
        {"key": subject, "title": subject.replace("-", " ").title(), "description": ""},
    )
    groups_out: list[dict] = []
    flat_sections: list[dict] = []
    _merge_db_sections(subject, groups_out, flat_sections)
    if not flat_sections:
        return None

    return {
        "key": subject,
        "title": meta.get("title", subject),
        "description": meta.get("description", ""),
        "groups": groups_out,
        "sections": flat_sections,
    }
