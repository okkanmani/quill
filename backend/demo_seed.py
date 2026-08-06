"""Seed accounts and sample content when QUILL_DEMO_MODE is enabled."""

from __future__ import annotations

import json
from pathlib import Path

import db
from auth_users import add_admin, add_student, get_student_by_admin_and_name
from demo_mode import is_demo_mode
from focus_discussion import mark_focus_area_discussed
from learn_content import publish_learn_section
from question_bank import create_question_bank_item
from question_bank_passages import create_question_bank_passage
from worksheets import (
    analyze_result_for_focus,
    list_results,
    save_result,
    upsert_worksheet_from_data,
)

DEMO_ADMIN_NAME = "demo"
DEMO_PASSWORD = "quill-demo"
DEMO_STUDENTS = (
    ("Alex", 5, "Ontario"),
    ("Sam", 7, "Ontario"),
)
WORKSHEET_FIXTURES = (
    ("demo-algebra", "questions_4.json"),
    ("demo-math-g5", "questions_11.json"),
)
LEARN_SUBJECT_KEY = "demo-fractions"
LEARN_SUBJECT_TITLE = "Fractions"
LEARN_SECTIONS = (
    (
        "intro",
        "What is a fraction?",
        "# What is a fraction?\n\nA **fraction** names part of a whole.\n\n"
        "The top number is the **numerator** — how many parts you have.\n"
        "The bottom number is the **denominator** — how many equal parts the whole is split into.\n\n"
        "Example: `3/4` means 3 equal parts out of 4.\n",
    ),
    (
        "equivalent",
        "Equivalent fractions",
        "# Equivalent fractions\n\nDifferent fractions can name the same amount.\n\n"
        "- `1/2` = `2/4` = `3/6`\n"
        "- Multiply or divide numerator and denominator by the same number.\n\n"
        "**Try it:** What fraction is equivalent to `2/3` with denominator 12?\n",
    ),
    (
        "add",
        "Adding fractions",
        "# Adding fractions\n\nWhen denominators match, add the numerators and keep the denominator.\n\n"
        "`2/5 + 1/5 = 3/5`\n\n"
        "When denominators differ, find a common denominator first.\n",
    ),
)


def _worksheets_dir() -> Path:
    return Path(__file__).resolve().parent / "data" / "worksheets"


def _demo_admin_id(conn) -> int | None:
    row = conn.execute(
        "SELECT id FROM admins WHERE name = ? COLLATE NOCASE",
        (DEMO_ADMIN_NAME,),
    ).fetchone()
    return int(row["id"]) if row else None


def _load_worksheet_json(filename: str) -> dict:
    path = _worksheets_dir() / filename
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def _seed_sample_result(admin_id: int, student_name: str, worksheet_id: str, data: dict) -> None:
    questions = data.get("questions") or []
    if not questions:
        return

    answers = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            continue
        qid = question.get("id") or f"q{index + 1}"
        expected = question.get("answer") or ""
        choices = question.get("choices") or []
        # First question correct, second wrong, rest correct — useful for analysis preview.
        if index == 1 and choices:
            given = choices[0] if choices[0] != expected else (choices[1] if len(choices) > 1 else expected)
            correct = False
        else:
            given = expected
            correct = True
        answers.append(
            {
                "question_id": qid,
                "prompt": question.get("prompt") or "",
                "given": given,
                "expected": expected,
                "choices": choices,
                "correct": correct,
                "area": question.get("area") or "",
                "stars": question.get("stars") or 2,
            }
        )

    score = sum(1 for row in answers if row.get("correct") is True)
    save_result(
        {
            "worksheet_id": worksheet_id,
            "title": data.get("title") or worksheet_id,
            "student": student_name,
            "score": score,
            "total": len(answers),
            "answers": answers,
            "status": "evaluated",
        }
    )

    rows = list_results(student_name)
    matching = [row for row in rows if row.get("worksheet_id") == worksheet_id]
    if not matching:
        return
    result_id = matching[0]["id"]
    try:
        analyze_result_for_focus(int(result_id), student_name)
    except ValueError:
        pass

    first_area = next(
        (row.get("area") for row in answers if row.get("area")),
        None,
    )
    if first_area:
        mark_focus_area_discussed(student_name, data.get("subject") or "math", first_area)


def _seed_question_bank(admin_id: int) -> None:
    passage = create_question_bank_passage(
        admin_id=admin_id,
        data={
            "title": "The Science Fair",
            "body": (
                "Maya stayed after school to finish her volcano model. "
                "She carefully mixed baking soda and vinegar while her classmates cheered."
            ),
            "subject": "english",
            "tier": 2,
            "stars": 2,
        },
    )
    create_question_bank_item(
        admin_id=admin_id,
        data={
            "subject": "english",
            "area": "reading comprehension",
            "stars": 2,
            "prompt": "Why did Maya stay after school?",
            "choices": [
                "To finish her volcano model",
                "To practice basketball",
                "To meet the principal",
                "To clean the classroom",
            ],
            "answer": "To finish her volcano model",
            "passage_id": passage["id"],
        },
    )
    create_question_bank_item(
        admin_id=admin_id,
        data={
            "subject": "math",
            "area": "algebra",
            "stars": 2,
            "prompt": "Solve for x: 2x + 4 = 12",
            "choices": ["2", "4", "6", "8"],
            "answer": "4",
        },
    )


def _seed_learn(admin_id: int) -> None:
    for _section_id, title, markdown in LEARN_SECTIONS:
        publish_learn_section(
            subject_key=LEARN_SUBJECT_KEY,
            section_title=title,
            markdown=markdown,
            subject_title=LEARN_SUBJECT_TITLE,
            subject_description="Demo collection for walkthroughs",
            grade=5,
            curriculum="Ontario",
            admin_id=admin_id,
        )


def ensure_demo_seed() -> None:
    if not is_demo_mode():
        return

    db.init_schema()
    conn = db.connect()
    try:
        if _demo_admin_id(conn) is not None:
            return
    finally:
        conn.close()

    admin_id = add_admin(DEMO_ADMIN_NAME, DEMO_PASSWORD)
    for name, grade, curriculum in DEMO_STUDENTS:
        add_student(
            admin_id=admin_id,
            name=name,
            password=DEMO_PASSWORD,
            grade=grade,
            curriculum=curriculum,
        )

    primary_data = None
    for worksheet_id, filename in WORKSHEET_FIXTURES:
        data = _load_worksheet_json(filename)
        upsert_worksheet_from_data(worksheet_id, data, admin_id=admin_id)
        if worksheet_id == "demo-algebra":
            primary_data = data

    if primary_data and get_student_by_admin_and_name(admin_id, "Alex"):
        _seed_sample_result(admin_id, "Alex", "demo-algebra", primary_data)

    _seed_learn(admin_id)
    try:
        _seed_question_bank(admin_id)
    except ValueError:
        pass
