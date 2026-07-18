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


def _ai_generates_short_answer_reference(subject: str) -> bool:
    """Math and data get objective reference answers from AI; other subjects do not."""
    return subject in ("math", "data")


def _build_prompt(
    *,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    question_count: int,
    custom_prompt: str = "",
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
      "area": "specific skill label",
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
            "Do not prefix choices with letters. "
            "Each question must include area: a specific, narrow skill label in lowercase "
            "(e.g. order of operations, fraction division) — not broad labels like algebra."
        )
        accuracy_rule = "- Accurate correct answers — double-check math and facts.\n"
    else:
        include_reference = _ai_generates_short_answer_reference(subject)
        if include_reference:
            schema = """
{
  "title": "short worksheet title",
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label",
      "answer": "reference answer for grading"
    }
  ]
}
"""
            type_rules = (
                "Each question is a short written-answer problem with one clear reference answer. "
                "Answers should be concise (number, fraction, short phrase, or brief interpretation). "
                "Each question must include area: a specific, narrow skill label in lowercase "
                + (
                    "(e.g. reading a bar chart, mean from a table) — not broad labels like data analysis."
                    if subject == "data"
                    else "(e.g. one-step linear equations, triangle area) — not broad labels like algebra."
                )
            )
            accuracy_rule = "- Accurate reference answers — double-check math and facts.\n"
        else:
            schema = """
{
  "title": "short worksheet title",
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label"
    }
  ]
}
"""
            type_rules = (
                "Each question is a short written-answer prompt for manual teacher grading. "
                "Do NOT include reference answers, sample responses, or an answer field — "
                "the teacher will add those later. "
                "Each question must include area: a specific, narrow skill label in lowercase "
                "(e.g. photosynthesis, main idea, inference) — not broad labels like science or reading."
            )
            accuracy_rule = ""

    base = f"""Generate a worksheet as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: {subject_text}
Difficulty: {difficulty} (stars {stars} of 3)
Number of questions: exactly {question_count}

{type_rules}

Requirements:
- Age-appropriate vocabulary and concepts for grade {grade}.
- No duplicate or near-duplicate questions.
{accuracy_rule}- Title should be specific and under 80 characters.

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


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


def _normalize_rc_draft(data: dict, *, passage_specs: list[dict]) -> dict:
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("AI draft is missing a title.")

    raw_passages = data.get("passages")
    if not isinstance(raw_passages, list) or not raw_passages:
        raise ValueError("AI draft has no passages.")

    if len(raw_passages) < len(passage_specs):
        raise ValueError(
            f"AI returned {len(raw_passages)} passages; expected {len(passage_specs)}."
        )
    if len(raw_passages) > len(passage_specs):
        raw_passages = raw_passages[: len(passage_specs)]

    passages: list[dict] = []
    for i, (raw, spec) in enumerate(zip(raw_passages, passage_specs)):
        prefix = f"passages[{i}]"
        if not isinstance(raw, dict):
            raise ValueError(f"{prefix} is invalid.")
        pid = spec.get("id") or f"p{i + 1}"
        ptitle = raw.get("title")
        body = raw.get("body") or raw.get("text")
        if not isinstance(ptitle, str) or not ptitle.strip():
            raise ValueError(f"{prefix}.title is required.")
        if not isinstance(body, str) or not body.strip():
            raise ValueError(f"{prefix}.body is required.")

        expected_q = int(spec.get("question_count") or 0)
        raw_questions = raw.get("questions")
        if not isinstance(raw_questions, list) or not raw_questions:
            raise ValueError(f"{prefix} has no questions.")
        if len(raw_questions) < expected_q:
            raise ValueError(
                f"{prefix} returned {len(raw_questions)} questions; expected {expected_q}."
            )
        if len(raw_questions) > expected_q:
            raw_questions = raw_questions[:expected_q]

        questions: list[dict] = []
        for j, rq in enumerate(raw_questions):
            qprefix = f"{prefix}.questions[{j}]"
            if not isinstance(rq, dict):
                raise ValueError(f"{qprefix} is invalid.")
            prompt = rq.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError(f"{qprefix}.prompt is required.")
            area = rq.get("area")
            if not isinstance(area, str) or not area.strip():
                raise ValueError(f"{qprefix}.area is required.")
            choices = rq.get("choices")
            correct_index = rq.get("correct_index")
            if not isinstance(choices, list) or len(choices) != 4:
                raise ValueError(f"{qprefix} must have 4 choices.")
            trimmed = [str(c).strip() for c in choices]
            if any(not c for c in trimmed):
                raise ValueError(f"{qprefix} has empty choices.")
            if len(set(trimmed)) < 4:
                raise ValueError(f"{qprefix} has duplicate choices.")
            if not isinstance(correct_index, int) or correct_index not in (0, 1, 2, 3):
                raise ValueError(f"{qprefix} has invalid correct_index.")
            questions.append(
                {
                    "prompt": prompt.strip(),
                    "area": area.strip().lower(),
                    "choices": trimmed,
                    "correct_index": correct_index,
                }
            )

        passages.append(
            {
                "id": pid,
                "title": ptitle.strip(),
                "body": body.strip(),
                "questions": questions,
            }
        )

    return {"title": title.strip(), "passages": passages}


def _build_rc_prompt(
    *,
    grade: int,
    stars: int,
    passage_specs: list[dict],
    custom_prompt: str = "",
) -> str:
    difficulty = _difficulty_label(stars)
    specs_text = "\n".join(
        f"- Passage {i + 1} (id {spec.get('id', f'p{i + 1}')}): "
        f"exactly {spec.get('question_count')} multiple-choice questions; "
        f"minimum {spec.get('min_words', 200)} words in the passage body"
        + (
            f"; topic/focus: {spec.get('prompt', '').strip()}"
            if spec.get("prompt", "").strip()
            else ""
        )
        for i, spec in enumerate(passage_specs)
    )
    schema = """
{
  "title": "short worksheet title",
  "passages": [
    {
      "id": "p1",
      "title": "passage title",
      "body": "full passage prose",
      "questions": [
        {
          "prompt": "question text",
          "area": "specific skill label",
          "choices": ["choice A text", "choice B text", "choice C text", "choice D text"],
          "correct_index": 0
        }
      ]
    }
  ]
}
"""
    base = f"""Generate a reading-comprehension worksheet as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: English reading comprehension
Difficulty: {difficulty} (stars {stars} of 3)

Passage requirements:
{specs_text}

Rules:
- Each passage body must meet its stated minimum word count.
- Include at least 2 vocabulary-focused questions per passage when possible.
- Each question must have exactly 4 distinct choices and a correct_index (0-3).
- Each question must include a specific lowercase area label (e.g. vocabulary, inference, main idea).
- Questions must be answerable from their passage only.
- Do not prefix choices with letters.
- Title under 80 characters.

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


def _normalize_draft(
    data: dict,
    *,
    fmt: str,
    question_count: int,
    require_short_answer_reference: bool = True,
) -> dict:
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("AI draft is missing a title.")

    raw_questions = data.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        raise ValueError("AI draft has no questions.")

    if len(raw_questions) < question_count:
        raise ValueError(
            f"AI returned {len(raw_questions)} questions; expected {question_count}."
        )
    if len(raw_questions) > question_count:
        raw_questions = raw_questions[:question_count]

    questions: list[dict] = []
    for i, raw in enumerate(raw_questions):
        if not isinstance(raw, dict):
            raise ValueError(f"AI question {i + 1} is invalid.")
        prompt = raw.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"AI question {i + 1} is missing a prompt.")

        area = raw.get("area")
        if not isinstance(area, str) or not area.strip():
            raise ValueError(f"AI question {i + 1} is missing a specific area label.")
        area = area.strip().lower()

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
                    "area": area,
                    "choices": trimmed,
                    "correct_index": correct_index,
                }
            )
        else:
            answer = raw.get("answer")
            if require_short_answer_reference:
                if not isinstance(answer, str) or not answer.strip():
                    raise ValueError(f"AI question {i + 1} is missing an answer.")
                questions.append(
                    {"prompt": prompt.strip(), "area": area, "answer": answer.strip()}
                )
            else:
                ref = answer.strip() if isinstance(answer, str) else ""
                row = {"prompt": prompt.strip(), "area": area}
                if ref:
                    row["answer"] = ref
                questions.append(row)

    return {"title": title.strip(), "questions": questions}


def _openai_error_message(status_code: int, body: str) -> str:
    """Turn OpenAI HTTP errors into short, actionable messages."""
    try:
        payload = json.loads(body)
        err = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(err, dict):
            msg = err.get("message")
            err_type = err.get("type")
            if err_type == "insufficient_quota" or (
                isinstance(msg, str) and "exceeded your current quota" in msg.lower()
            ):
                return (
                    "Your OpenAI account has no available quota. Creating a new API key "
                    "does not add credits — open platform.openai.com/settings/billing, "
                    "add a payment method or prepaid balance, then try again."
                )
            if isinstance(msg, str) and msg.strip():
                return msg.strip()
    except json.JSONDecodeError:
        pass
    return f"AI service error ({status_code}). Check your OpenAI account billing and try again."


def generate_worksheet_draft(
    *,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    question_count: int | None = None,
    custom_prompt: str = "",
    english_type: str = "",
    min_words: int | None = None,
    passage_specs: list[dict] | None = None,
    api_key: str,
) -> dict:
    """Call OpenAI and return builder-ready draft."""
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
    if stars not in (1, 2, 3):
        raise ValueError("stars must be 1, 2, or 3.")
    if not isinstance(grade, int) or grade < 1 or grade > 12:
        raise ValueError("grade must be an integer from 1 to 12.")

    english_type = (english_type or "").strip().lower()
    specs = passage_specs or []
    is_rc = subject == "english" and english_type == "reading_comprehension" and specs

    if is_rc:
        normalized_specs = []
        for i, spec in enumerate(specs):
            if not isinstance(spec, dict):
                raise ValueError(f"passage_specs[{i}] must be an object.")
            qcount = spec.get("question_count")
            if not isinstance(qcount, int) or qcount < 1 or qcount > 15:
                raise ValueError(
                    f"passage_specs[{i}].question_count must be between 1 and 15."
                )
            min_w = spec.get("min_words")
            if not isinstance(min_w, int):
                min_w = min_words if isinstance(min_words, int) else 200
            if min_w < 50 or min_w > 2000:
                raise ValueError(
                    f"passage_specs[{i}].min_words must be between 50 and 2000."
                )
            normalized_specs.append(
                {
                    "id": (spec.get("id") or f"p{i + 1}").strip(),
                    "question_count": qcount,
                    "prompt": (spec.get("prompt") or "").strip(),
                    "min_words": min_w,
                }
            )
        user_prompt = _build_rc_prompt(
            grade=grade,
            stars=stars,
            passage_specs=normalized_specs,
            custom_prompt=custom_prompt,
        )
    else:
        count = question_count if question_count is not None else STARS_DEFAULT_QUESTION_COUNTS[stars]
        if not isinstance(count, int) or count < 1 or count > 50:
            raise ValueError("question_count must be between 1 and 50.")
        user_prompt = _build_prompt(
            subject=subject,
            grade=grade,
            stars=stars,
            fmt=fmt,
            question_count=count,
            custom_prompt=custom_prompt,
        )

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    try:
        with httpx.Client(timeout=180.0) as client:
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
        raise ValueError(_openai_error_message(res.status_code, res.text))

    payload = res.json()
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Unexpected AI response format.") from exc

    parsed = _parse_ai_json(content)
    if is_rc:
        return _normalize_rc_draft(parsed, passage_specs=normalized_specs)

    count = question_count if question_count is not None else STARS_DEFAULT_QUESTION_COUNTS[stars]
    return _normalize_draft(
        parsed,
        fmt=fmt,
        question_count=count,
        require_short_answer_reference=(
            fmt != "short_answer" or _ai_generates_short_answer_reference(subject)
        ),
    )
