"""Generate worksheet drafts via OpenAI for admin review in the question builder."""

from __future__ import annotations

import json
import os

import httpx

from worksheets import STARS_DEFAULT_QUESTION_COUNTS, VALID_SUBJECTS

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


def _difficulty_label(stars: int) -> str:
    return {1: "easy", 2: "medium", 3: "hard"}.get(stars, "medium")


def _subject_label(subject: str) -> str:
    return {
        "math": "math",
        "english": "English language arts",
        "science": "science",
        "data": "data analysis and charts",
        "general": "general knowledge",
    }.get(subject, subject)


def _build_prompt(
    *,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    question_count: int,
) -> str:
    difficulty = _difficulty_label(stars)
    subject_text = _subject_label(subject)
    if fmt == "multiple_choice":
        schema = """
{
  "title": "short worksheet title",
  "questions": [
    {
      "prompt": "question text",
      "choices": ["choice A text", "choice B text", "choice C text", "choice D text"],
      "correct_index": 0
    }
  ]
}
"""
        type_rules = (
            "Each question must have exactly 4 distinct, non-empty choices. "
            "correct_index is 0 for A, 1 for B, 2 for C, 3 for D. "
            "Distractors must be plausible but clearly wrong. "
            "Do not prefix choices with letters."
        )
    else:
        schema = """
{
  "title": "short worksheet title",
  "questions": [
    {
      "prompt": "question text",
      "answer": "reference answer for grading"
    }
  ]
}
"""
        type_rules = (
            "Each question is a short written-answer math problem with one clear reference answer. "
            "Answers should be concise (number, fraction, or short phrase)."
        )

    return f"""Generate a worksheet as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: {subject_text}
Difficulty: {difficulty} (stars {stars} of 3)
Number of questions: exactly {question_count}

{type_rules}

Requirements:
- Age-appropriate vocabulary and concepts for grade {grade}.
- No duplicate or near-duplicate questions.
- Accurate answers — double-check math and facts.
- Title should be specific and under 80 characters.

Return JSON matching this schema:
{schema}
"""


def _parse_ai_json(content: str) -> dict:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("AI response must be a JSON object.")
    return data


def _normalize_draft(data: dict, *, fmt: str, question_count: int) -> dict:
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("AI draft is missing a title.")

    raw_questions = data.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        raise ValueError("AI draft has no questions.")

    if len(raw_questions) != question_count:
        raise ValueError(
            f"AI returned {len(raw_questions)} questions; expected {question_count}."
        )

    questions: list[dict] = []
    for i, raw in enumerate(raw_questions):
        if not isinstance(raw, dict):
            raise ValueError(f"AI question {i + 1} is invalid.")
        prompt = raw.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"AI question {i + 1} is missing a prompt.")

        if fmt == "multiple_choice":
            choices = raw.get("choices")
            correct_index = raw.get("correct_index")
            if not isinstance(choices, list) or len(choices) != 4:
                raise ValueError(f"AI question {i + 1} must have 4 choices.")
            trimmed = [str(c).strip() for c in choices]
            if any(not c for c in trimmed):
                raise ValueError(f"AI question {i + 1} has empty choices.")
            if len(set(trimmed)) < 4:
                raise ValueError(f"AI question {i + 1} has duplicate choices.")
            if not isinstance(correct_index, int) or correct_index not in (0, 1, 2, 3):
                raise ValueError(f"AI question {i + 1} has invalid correct_index.")
            questions.append(
                {
                    "prompt": prompt.strip(),
                    "choices": trimmed,
                    "correct_index": correct_index,
                }
            )
        else:
            answer = raw.get("answer")
            if not isinstance(answer, str) or not answer.strip():
                raise ValueError(f"AI question {i + 1} is missing an answer.")
            questions.append({"prompt": prompt.strip(), "answer": answer.strip()})

    return {"title": title.strip(), "questions": questions}


def generate_worksheet_draft(
    *,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    question_count: int | None = None,
    api_key: str,
) -> dict:
    """Call OpenAI and return builder-ready draft {title, questions}."""
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError(
            "No OpenAI API key. Add yours under Admin → Settings."
        )

    subject = subject.strip().lower()
    if subject not in VALID_SUBJECTS:
        raise ValueError(f"subject must be one of: {', '.join(sorted(VALID_SUBJECTS))}.")
    if fmt not in ("multiple_choice", "short_answer"):
        raise ValueError("format must be multiple_choice or short_answer.")
    if fmt == "short_answer" and subject != "math":
        raise ValueError("short_answer AI generation is only supported for math.")
    if stars not in (1, 2, 3):
        raise ValueError("stars must be 1, 2, or 3.")
    if not isinstance(grade, int) or grade < 1 or grade > 12:
        raise ValueError("grade must be an integer from 1 to 12.")

    count = question_count if question_count is not None else STARS_DEFAULT_QUESTION_COUNTS[stars]
    if not isinstance(count, int) or count < 1 or count > 50:
        raise ValueError("question_count must be between 1 and 50.")

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    user_prompt = _build_prompt(
        subject=subject,
        grade=grade,
        stars=stars,
        fmt=fmt,
        question_count=count,
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
                                "You are an expert K-12 worksheet author. "
                                "Return only valid JSON matching the requested schema."
                            ),
                        },
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                },
            )
    except httpx.TimeoutException as exc:
        raise ValueError("AI request timed out. Try again with fewer questions.") from exc
    except httpx.HTTPError as exc:
        raise ValueError("Could not reach the AI service.") from exc

    if res.status_code != 200:
        detail = res.text[:300]
        raise ValueError(f"AI service error ({res.status_code}): {detail}")

    payload = res.json()
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Unexpected AI response format.") from exc

    parsed = _parse_ai_json(content)
    return _normalize_draft(parsed, fmt=fmt, question_count=count)
