"""Generate learning resource markdown via OpenAI."""

from __future__ import annotations

import json
import os

import httpx

from ai_worksheet import OPENAI_CHAT_URL, _openai_error_message, _parse_ai_json

VALID_LEARN_SUBJECTS = frozenset({"math", "english", "science", "data", "general"})


def _subject_label(subject: str) -> str:
    return {
        "math": "math",
        "english": "English language arts",
        "science": "science",
        "data": "data analysis and charts",
        "general": "general knowledge",
    }.get(subject, subject)


def _build_learn_prompt(
    *,
    subject: str,
    grade: int,
    curriculum: str,
    section_title: str,
    custom_prompt: str = "",
) -> str:
    extra = (custom_prompt or "").strip()
    if len(extra) > 2000:
        extra = extra[:2000]

    base = f"""Write a student-facing learning resource as Markdown only.

Audience: grade {grade} students.
Subject area: {_subject_label(subject)}
Curriculum / program: {curriculum.strip()}
Topic: {section_title.strip()}

Style and structure:
- Start with a short intro paragraph (no top-level # title — the app shows the section title separately).
- Use ## and ### headings to organize concepts.
- Include worked **Examples** where helpful.
- Use markdown tables or bullet lists when they clarify ideas.
- Friendly, clear tone for home learning — not a full textbook chapter.
- Accurate facts and age-appropriate vocabulary for grade {grade}.
- Length: roughly 400–900 words unless the topic needs more.

Return JSON only:
{{
  "section_title": "display title for this resource",
  "markdown": "full markdown body"
}}
"""
    if extra:
        base += f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


def generate_learn_resource(
    *,
    subject: str,
    grade: int,
    curriculum: str,
    section_title: str,
    custom_prompt: str = "",
    api_key: str,
) -> dict:
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("No OpenAI API key. Add yours under Admin → Settings.")

    subject = (subject or "").strip().lower()
    if subject not in VALID_LEARN_SUBJECTS:
        raise ValueError(
            f"subject must be one of: {', '.join(sorted(VALID_LEARN_SUBJECTS))}."
        )
    curriculum = (curriculum or "").strip()
    if not curriculum:
        raise ValueError("Curriculum is required.")
    section_title = (section_title or "").strip()
    if not section_title:
        raise ValueError("Section title / topic is required.")
    if not isinstance(grade, int) or grade < 1 or grade > 12:
        raise ValueError("grade must be an integer from 1 to 12.")

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    user_prompt = _build_learn_prompt(
        subject=subject,
        grade=grade,
        curriculum=curriculum,
        section_title=section_title,
        custom_prompt=custom_prompt,
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
                                "You are an expert K-12 educator writing concise "
                                "home-learning reference notes. Return only valid JSON."
                            ),
                        },
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
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
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Unexpected AI response format.") from exc

    parsed = _parse_ai_json(content)
    title = parsed.get("section_title")
    markdown = parsed.get("markdown")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("AI draft is missing a section title.")
    if not isinstance(markdown, str) or not markdown.strip():
        raise ValueError("AI draft is missing markdown content.")

    return {
        "section_title": title.strip(),
        "markdown": markdown.strip(),
    }
