"""Ephemeral focus-area practice worksheets (not published to the worksheet catalog)."""

from __future__ import annotations

import os
import random

import httpx

from ai_worksheet import (
    OPENAI_CHAT_URL,
    _openai_error_message,
    _parse_ai_json,
    _subject_label,
)

PRACTICE_QUESTION_COUNT = 5
STAR_PATTERN = (2, 2, 2, 3, 3)


def _area_label(area: str) -> str:
    return (area or "").strip().replace("-", " ")


def _format_example_block(index: int, example: dict) -> str:
    question = (example.get("question") or "").strip()
    if not question:
        return ""

    lines = [f"Example {index}:", f"Question: {question}"]
    choices = example.get("choices") or []
    if isinstance(choices, list) and choices:
        labeled = []
        for i, choice in enumerate(choices):
            label = chr(ord("A") + i) if i < 26 else str(i + 1)
            text = str(choice).strip()
            if text:
                labeled.append(f"{label}. {text}")
        if labeled:
            lines.append("Options: " + " | ".join(labeled))

    answer = (example.get("answer") or "").strip()
    if answer:
        if answer == "[scratchpad response]":
            lines.append("Student response: drew/wrote on scratchpad (no typed answer).")
        else:
            lines.append(f"Student answered: {answer}")
    else:
        lines.append("Student response: did not answer.")

    expected = (example.get("expected") or "").strip()
    if expected:
        lines.append(f"Correct answer: {expected}")

    return "\n".join(lines)


def _build_ai_prompt(
    *,
    subject: str,
    area: str,
    grade: int | None,
    examples: list[dict],
) -> str:
    subject_text = _subject_label(subject.strip().lower())
    area_text = _area_label(area)
    stars_line = ", ".join(str(stars) for stars in STAR_PATTERN)
    grade_line = (
        f"Student grade level: {grade}\n" if isinstance(grade, int) and 1 <= grade <= 12 else ""
    )

    blocks = []
    for i, example in enumerate(examples, start=1):
        block = _format_example_block(i, example)
        if block:
            blocks.append(block)
    examples_text = (
        "\n\n".join(blocks)
        if blocks
        else "No specific wrong-answer examples were provided — infer appropriate practice from the skill area."
    )

    return f"""Generate a short follow-up practice worksheet as JSON only.

Subject: {subject_text}
Focus skill area: {area_text}
{grade_line}
The student just finished a teacher discussion about this skill. Create fresh practice questions
(not copies of the examples below) that reinforce the same skill.

Wrong-answer examples from recent work (for context only):
---
{examples_text}
---

Requirements:
- Exactly {PRACTICE_QUESTION_COUNT} multiple-choice questions.
- Use this star difficulty sequence in order: {stars_line} (2 = medium, 3 = harder).
- Each question must have exactly 4 distinct, plausible choices and correct_index 0–3.
- Do not prefix choices with letters.
- Questions should progress from medium practice to slightly harder application.
- Age-appropriate for the grade when given.
- Title under 80 characters, specific to the skill area.

Return JSON only:
{{
  "title": "short worksheet title",
  "questions": [
    {{
      "prompt": "question text",
      "stars": 2,
      "choices": ["...", "...", "...", "..."],
      "correct_index": 0
    }}
  ]
}}
"""


def _normalize_ai_questions(raw_questions: list, *, area_slug: str) -> list[dict]:
    if not isinstance(raw_questions, list) or len(raw_questions) < PRACTICE_QUESTION_COUNT:
        raise ValueError(
            f"AI must return at least {PRACTICE_QUESTION_COUNT} questions for focus practice."
        )
    if len(raw_questions) > PRACTICE_QUESTION_COUNT:
        raw_questions = raw_questions[:PRACTICE_QUESTION_COUNT]

    questions = []
    for index, raw in enumerate(raw_questions):
        prefix = f"questions[{index}]"
        if not isinstance(raw, dict):
            raise ValueError(f"{prefix} is invalid.")
        prompt = raw.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"{prefix}.prompt is required.")

        stars = raw.get("stars", STAR_PATTERN[index])
        if not isinstance(stars, int) or stars not in (1, 2, 3):
            stars = STAR_PATTERN[index]

        choices = raw.get("choices")
        correct_index = raw.get("correct_index")
        if not isinstance(choices, list) or len(choices) != 4:
            raise ValueError(f"{prefix} must have 4 choices.")
        trimmed = [str(c).strip() for c in choices]
        if any(not c for c in trimmed):
            raise ValueError(f"{prefix} has empty choices.")
        if len(set(trimmed)) < 4:
            raise ValueError(f"{prefix} has duplicate choices.")
        if not isinstance(correct_index, int) or correct_index not in (0, 1, 2, 3):
            raise ValueError(f"{prefix} has invalid correct_index.")

        questions.append(
            {
                "id": f"focus-practice-{index + 1}",
                "prompt": prompt.strip(),
                "type": "multiple_choice",
                "stars": stars,
                "area": area_slug,
                "choices": trimmed,
                "answer": trimmed[correct_index],
            }
        )
    return questions


def _worksheet_shell(
    *,
    subject_key: str,
    area_slug: str,
    title: str,
    questions: list[dict],
    grade: int | None,
    mock: bool,
) -> dict:
    area_label = _area_label(area_slug)
    subject_text = _subject_label(subject_key)
    grade_note = f" · Grade {grade}" if isinstance(grade, int) and 1 <= grade <= 12 else ""
    star_values = [q.get("stars") or 2 for q in questions]

    return {
        "ephemeral": True,
        "mock": mock,
        "title": title.strip() or f"Focus practice: {area_label}",
        "subject": subject_key,
        "subject_label": subject_text,
        "focus_area": area_slug,
        "focus_area_label": area_label,
        "evaluation": "auto",
        "timed": False,
        "time_limit_minutes": None,
        "scratchpad": subject_key in ("math", "data"),
        "difficulty_min": min(star_values) if star_values else 2,
        "difficulty_max": max(star_values) if star_values else 3,
        "question_count": len(questions),
        "questions": questions,
        "subtitle": f"5-question AI follow-up after discussion{grade_note}",
    }


def _choice_set(area_label: str, index: int, stars: int) -> tuple[list[str], str]:
    correct = f"Apply {area_label} correctly (Q{index + 1})"
    distractors = [
        f"Common slip: misread the {area_label} setup (Q{index + 1})",
        f"Arithmetic error while using {area_label} (Q{index + 1})",
        f"Partial step without finishing {area_label} (Q{index + 1})",
    ]
    choices = [correct, *distractors]
    rng = random.Random(index * 17 + stars * 31 + len(area_label))
    rng.shuffle(choices)
    return choices, correct


def _prompt_for_question(
    *,
    area_label: str,
    index: int,
    stars: int,
    examples: list[dict],
) -> str:
    if examples:
        source = examples[index % len(examples)]
        base = (source.get("question") or "").strip()
        if base:
            if stars >= 3:
                return f"Challenge: rework this idea — {base}"
            return f"Practice: {base}"

    if stars >= 3:
        return (
            f"Challenge ({stars}★): solve a multi-step problem about {area_label}. "
            f"Show careful reasoning."
        )
    return (
        f"Practice ({stars}★): apply {area_label} in a grade-appropriate problem "
        f"(question {index + 1} of {PRACTICE_QUESTION_COUNT})."
    )


def generate_mock_focus_practice_worksheet(
    *,
    subject: str,
    area: str,
    grade: int | None = None,
    examples: list[dict] | None = None,
) -> dict:
    subject_key = (subject or "").strip().lower()
    area_slug = (area or "").strip().lower()
    if not subject_key:
        raise ValueError("subject is required.")
    if not area_slug:
        raise ValueError("area is required.")

    area_label = _area_label(area_slug)
    example_rows = examples or []

    questions = []
    for index, stars in enumerate(STAR_PATTERN):
        choices, answer = _choice_set(area_label, index, stars)
        questions.append(
            {
                "id": f"focus-practice-{index + 1}",
                "prompt": _prompt_for_question(
                    area_label=area_label,
                    index=index,
                    stars=stars,
                    examples=example_rows,
                ),
                "type": "multiple_choice",
                "stars": stars,
                "area": area_slug,
                "choices": choices,
                "answer": answer,
            }
        )

    return _worksheet_shell(
        subject_key=subject_key,
        area_slug=area_slug,
        title=f"Focus practice: {area_label}",
        questions=questions,
        grade=grade,
        mock=True,
    )


def generate_ai_focus_practice_worksheet(
    *,
    subject: str,
    area: str,
    grade: int | None = None,
    examples: list[dict] | None = None,
    api_key: str,
) -> dict:
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("Add your OpenAI API key under Admin → Settings.")

    subject_key = (subject or "").strip().lower()
    area_slug = (area or "").strip().lower()
    if not subject_key:
        raise ValueError("subject is required.")
    if not area_slug:
        raise ValueError("area is required.")

    normalized_examples = []
    for i, raw in enumerate(examples or []):
        if not isinstance(raw, dict):
            raise ValueError(f"examples[{i}] must be an object.")
        normalized_examples.append(
            {
                "question": str(raw.get("question") or ""),
                "answer": str(raw.get("answer") or ""),
                "expected": str(raw.get("expected") or ""),
                "choices": raw.get("choices") or [],
            }
        )

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    user_prompt = _build_ai_prompt(
        subject=subject_key,
        area=area_slug,
        grade=grade,
        examples=normalized_examples,
    )

    try:
        with httpx.Client(timeout=120.0) as client:
            res = client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You write short K-12 multiple-choice practice worksheets. "
                                "Return only valid JSON."
                            ),
                        },
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.6,
                },
            )
    except httpx.TimeoutException as exc:
        raise ValueError("AI request timed out. Try again.") from exc
    except httpx.HTTPError as exc:
        raise ValueError("Could not reach the AI service.") from exc

    if res.status_code != 200:
        raise ValueError(_openai_error_message(res.status_code, res.text))

    payload = res.json()
    try:
        raw = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Unexpected AI response format.") from exc

    parsed = _parse_ai_json(raw)
    title = parsed.get("title") if isinstance(parsed.get("title"), str) else ""
    questions = _normalize_ai_questions(parsed.get("questions"), area_slug=area_slug)

    return _worksheet_shell(
        subject_key=subject_key,
        area_slug=area_slug,
        title=title,
        questions=questions,
        grade=grade,
        mock=False,
    )


def generate_focus_practice_worksheet(
    *,
    subject: str,
    area: str,
    grade: int | None = None,
    examples: list[dict] | None = None,
    use_ai: bool = False,
    api_key: str | None = None,
) -> dict:
    if use_ai:
        return generate_ai_focus_practice_worksheet(
            subject=subject,
            area=area,
            grade=grade,
            examples=examples,
            api_key=api_key or "",
        )
    return generate_mock_focus_practice_worksheet(
        subject=subject,
        area=area,
        grade=grade,
        examples=examples,
    )
