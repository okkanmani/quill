"""Load Markdown learning material from backend/data/learn/<subject>/."""

import json
from pathlib import Path

LEARN_DIR = Path(__file__).parent / "data" / "learn"


def list_subjects() -> list[dict]:
    if not LEARN_DIR.is_dir():
        return []
    out: list[dict] = []
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
    return out


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
    }


def get_subject(subject: str) -> dict | None:
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
                loaded = {**loaded, "group_id": gid, "group_title": gtitle}
                bucket.append(loaded)
                flat_sections.append(loaded)
            if bucket:
                groups_out.append({"id": gid, "title": gtitle, "sections": bucket})
    else:
        for sec in manifest.get("sections", []):
            loaded = _load_section(subj_dir, sec)
            if loaded:
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
