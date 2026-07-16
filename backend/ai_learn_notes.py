"""Generate per-page study notes from learn content via OpenAI."""

from __future__ import annotations

import os

import httpx

from ai_worksheet import OPENAI_CHAT_URL, _openai_error_message, _parse_ai_json


def _build_notes_prompt(
    *,
    page_markdown: str,
    section_title: str,
    subject_title: str,
) -> str:
    section = (section_title or "this section").strip()
    subject = (subject_title or "this topic").strip()
    content = (page_markdown or "").strip()
    if len(content) > 12000:
        content = content[:12000] + "\n\n[…truncated…]"

    return f"""Write concise study notes for a student who just read one page of learning material.

Topic / collection: {subject}
Section: {section}

Page content (Markdown):
---
{content}
---

Requirements:
- Plain text only (no Markdown headings syntax like # or **).
- Use short bullet lines starting with "• " for key points.
- Capture definitions, formulas, steps, and one memorable tip if helpful.
- Age-appropriate, encouraging tone.
- Length: about 80–180 words for this single page — not a full summary of the whole section.

Return JSON only:
{{
  "notes": "bullet notes as plain text"
}}
"""


def generate_learn_page_notes(
    *,
    page_markdown: str,
    section_title: str = "",
    subject_title: str = "",
    api_key: str,
) -> str:
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("No OpenAI API key. Ask your teacher to add one under Admin → Settings.")

    content = (page_markdown or "").strip()
    if not content:
        raise ValueError("This page has no content to summarize.")

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    user_prompt = _build_notes_prompt(
        page_markdown=content,
        section_title=section_title,
        subject_title=subject_title,
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
                                "You help students take clear, concise study notes. "
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
    notes = parsed.get("notes")
    if not isinstance(notes, str) or not notes.strip():
        raise ValueError("AI did not return usable notes.")
    return notes.strip()
