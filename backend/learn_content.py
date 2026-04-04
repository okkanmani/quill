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


def get_subject(subject: str) -> dict | None:
    subj_dir = LEARN_DIR / subject.strip().lower()
    man_path = subj_dir / "manifest.json"
    if not man_path.exists():
        return None
    with open(man_path, encoding="utf-8") as f:
        manifest = json.load(f)
    sections: list[dict] = []
    for sec in manifest.get("sections", []):
        fid = sec.get("file")
        if not fid:
            continue
        path = subj_dir / fid
        if not path.is_file():
            continue
        body = path.read_text(encoding="utf-8")
        sections.append(
            {
                "id": sec.get("id", Path(fid).stem),
                "title": sec.get("title", sec.get("id", "")),
                "markdown": body,
            }
        )
    return {
        "key": subj_dir.name,
        "title": manifest.get("title", subject),
        "description": manifest.get("description", ""),
        "sections": sections,
    }
