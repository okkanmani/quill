"""Generate teacher discussion references for Analysis focus areas via OpenAI."""

from __future__ import annotations

import os

import httpx

from ai_worksheet import OPENAI_CHAT_URL, _openai_error_message, _parse_ai_json, _subject_label


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


def _build_discussion_prompt(
    *,
    subject: str,
    area: str,
    examples: list[dict],
    grade: int | None = None,
) -> str:
    subject_text = _subject_label(subject.strip().lower())
    area_text = (area or "").replace("-", " ").strip()
    blocks = []
    for i, example in enumerate(examples, start=1):
        block = _format_example_block(i, example)
        if block:
            blocks.append(block)

    if not blocks:
        raise ValueError("At least one question example is required.")

    examples_text = "\n\n".join(blocks)
    grade_line = (
        f"Student grade level: {grade}\n" if isinstance(grade, int) and 1 <= grade <= 12 else ""
    )

    return f"""You are helping a teacher prepare a short 1:1 discussion with a student who missed questions in a specific skill area.

Subject: {subject_text}
Focus skill area: {area_text}
{grade_line}
Wrong-answer examples from recent worksheets:
---
{examples_text}
---

Write concise teacher-facing notes (not student-facing prose). Include:
• What concept or skill this area targets
• Likely misconception(s) suggested by the student response(s)
• 2–4 concrete talking points or questions the teacher can use in discussion
• One quick re-teach tip or mini practice idea

Use plain text with bullet lines starting with "• ". Keep it practical and under 220 words.
Do not invent worksheet details beyond what is given.

Return JSON only:
{{
  "reference": "bullet notes as plain text"
}}
"""


def generate_focus_discussion_reference(
    *,
    subject: str,
    area: str,
    examples: list[dict],
    grade: int | None = None,
    api_key: str,
) -> str:
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("Add your OpenAI API key under Admin → Settings.")

    subject = (subject or "").strip().lower()
    if not subject:
        raise ValueError("subject is required.")
    area = (area or "").strip()
    if not area:
        raise ValueError("area is required.")

    normalized: list[dict] = []
    for i, raw in enumerate(examples or []):
        if not isinstance(raw, dict):
            raise ValueError(f"examples[{i}] must be an object.")
        question = (raw.get("question") or "").strip()
        if not question:
            raise ValueError(f"examples[{i}].question is required.")
        choices = raw.get("choices")
        if choices is not None and not isinstance(choices, list):
            raise ValueError(f"examples[{i}].choices must be a list.")
        normalized.append(
            {
                "question": question,
                "answer": str(raw.get("answer") or ""),
                "expected": str(raw.get("expected") or ""),
                "choices": choices or [],
            }
        )

    if not normalized:
        raise ValueError("At least one question example is required.")

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    user_prompt = _build_discussion_prompt(
        subject=subject,
        area=area,
        examples=normalized,
        grade=grade,
    )

    try:
        with httpx.Client(timeout=90.0) as client:
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
                                "You help teachers prepare focused tutoring conversations. "
                                "Return only valid JSON."
                            ),
                        },
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.5,
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
    reference = parsed.get("reference")
    if not isinstance(reference, str) or not reference.strip():
        raise ValueError("AI did not return usable discussion notes.")
    return reference.strip()
