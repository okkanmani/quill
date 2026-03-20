import json
from datetime import datetime, timezone
from pathlib import Path

WORKSHEETS_DIR = Path(__file__).parent / "data" / "worksheets"
RESULTS_DIR = Path(__file__).parent / "data" / "results"


def list_worksheets() -> list:
    worksheets = []
    for file in WORKSHEETS_DIR.glob("*.json"):
        with open(file) as f:
            data = json.load(f)
            worksheets.append(
                {
                    "id": file.stem,
                    "title": data.get("title", file.stem),
                    "subject": data.get("subject", "general"),
                    "question_count": len(data.get("questions", [])),
                }
            )
    return worksheets


def get_worksheet(worksheet_id: str) -> dict | None:
    path = WORKSHEETS_DIR / f"{worksheet_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def save_result(result: dict):
    RESULTS_DIR.mkdir(exist_ok=True)
    path = RESULTS_DIR / f"{result['worksheet_id']}.json"
    result["submitted_at"] = datetime.now(timezone.utc).isoformat()
    with open(path, "w") as f:
        json.dump(result, f, indent=2)


def list_results() -> list:
    results = []
    for file in RESULTS_DIR.glob("*.json"):
        with open(file) as f:
            results.append(json.load(f))
    results.sort(key=lambda r: r["worksheet_id"])
    return results
