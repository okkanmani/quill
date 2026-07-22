"""Generate worksheet drafts via OpenAI for admin review in the question builder."""

from __future__ import annotations

import json
import os

import httpx

from worksheets import (
    STARS_DEFAULT_QUESTION_COUNTS,
    VALID_SUBJECTS,
    _sanitize_passage_chart,
    _validate_passage_chart,
    _validate_passage_table,
)

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
CRITICAL: The questions array must contain exactly {question_count} items — count before responding.

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


def _normalize_data_draft(data: dict, *, passage_specs: list[dict]) -> dict:
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
        body = raw.get("body") or raw.get("text") or ""
        if not isinstance(ptitle, str) or not ptitle.strip():
            raise ValueError(f"{prefix}.title is required.")
        if not isinstance(body, str):
            raise ValueError(f"{prefix}.body must be a string when provided.")

        chart = _sanitize_passage_chart(raw.get("chart"))
        table = raw.get("table")
        chart_errors: list[str] = []
        table_errors: list[str] = []
        _validate_passage_chart(prefix, chart, chart_errors)
        _validate_passage_table(prefix, table, table_errors)
        if chart_errors:
            raise ValueError(chart_errors[0])
        if table_errors:
            raise ValueError(table_errors[0])
        has_body = bool(body.strip())
        has_chart = isinstance(chart, dict) and chart.get("type")
        has_table = isinstance(table, dict) and table.get("headers")
        if not has_body and not has_chart and not has_table:
            raise ValueError(
                f"{prefix} must include a short body, chart, and/or table for students to read."
            )
        if not has_chart and not has_table:
            raise ValueError(f"{prefix} must include a chart or table with numeric data.")

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

        passage_obj: dict = {
            "id": pid,
            "title": ptitle.strip(),
            "body": body.strip(),
            "questions": questions,
        }
        if isinstance(chart, dict):
            passage_obj["chart"] = chart
        if isinstance(table, dict):
            passage_obj["table"] = table
        passages.append(passage_obj)

    return {"title": title.strip(), "passages": passages}


def _build_data_prompt(
    *,
    grade: int,
    stars: int,
    passage_specs: list[dict],
    custom_prompt: str = "",
) -> str:
    difficulty = _difficulty_label(stars)
    specs_text = "\n".join(
        f"- Data set {i + 1} (id {spec.get('id', f'p{i + 1}')}): "
        f"exactly {spec.get('question_count')} multiple-choice questions; "
        "include one chart (bar, line, or pie) and/or a table with realistic numeric data"
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
      "title": "data set title",
      "body": "one short sentence introducing the chart or table",
      "chart": {
        "type": "bar",
        "title": "chart title",
        "labels": ["Label A", "Label B"],
        "values": [10, 20],
        "xLabel": "category axis label",
        "yLabel": "value axis label"
      },
      "table": {
        "headers": ["Column A", "Column B"],
        "rows": [["Row1A", "Row1B"], ["Row2A", "Row2B"]]
      },
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
    base = f"""Generate a data-analysis worksheet as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: data analysis (reading charts, tables, and numeric reasoning)
Difficulty: {difficulty} (stars {stars} of 3)

Data set requirements:
{specs_text}

Rules:
- Each data set MUST include a chart and/or table with consistent numeric data students can read.
- chart.type must be bar, line, or pie. labels and values must be the same length; values are non-negative numbers.
- xLabel and yLabel are optional; omit them entirely if unused — never use empty strings.
- table.headers is a non-empty string array; each row matches header length.
- body is one short sentence (optional if chart/table titles are clear).
- Vary chart types across data sets when possible (bar, line, pie).
- Each question must have exactly 4 distinct choices and a correct_index (0-3).
- Each question must include a specific lowercase area label (e.g. read bar chart, mean from table, percent change).
- Questions must be answerable from that data set's chart/table only — do not hide needed numbers in the question text alone.
- Do not prefix choices with letters.
- Title under 80 characters.
- Use realistic grade-appropriate contexts (sports, school, weather, sales, science measurements).

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


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


TOPUP_MAX_MISSING = 5
TEST_TOPUP_MAX_BATCH = 20
TEST_TOPUP_MAX_ROUNDS = 5


def _openai_json_completion(
    *,
    api_key: str,
    messages: list[dict],
    timeout: float = 180.0,
    system_role: str = "worksheet",
) -> dict:
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    system_content = (
        "You are an expert K-12 assessment author. "
        "Return only valid JSON matching the requested schema."
        if system_role == "test"
        else "You are an expert K-12 worksheet author. "
        "Return only valid JSON matching the requested schema."
    )
    try:
        with httpx.Client(timeout=timeout) as client:
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
                        {"role": "system", "content": system_content},
                        *messages,
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

    return _parse_ai_json(content)


def _existing_question_prompts(questions: list) -> list[str]:
    prompts: list[str] = []
    for question in questions:
        if not isinstance(question, dict):
            continue
        prompt = question.get("prompt")
        if isinstance(prompt, str) and prompt.strip():
            prompts.append(prompt.strip())
    return prompts


def _build_topup_prompt(
    *,
    missing: int,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    existing_prompts: list[str],
    custom_prompt: str = "",
) -> str:
    difficulty = _difficulty_label(stars)
    subject_text = _subject_label(subject)
    existing_block = "\n".join(f"- {text}" for text in existing_prompts[:40])
    if fmt == "multiple_choice":
        schema = """
{
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
            "Each question must have exactly 4 distinct, non-empty choices and correct_index 0-3. "
            "Do not prefix choices with letters."
        )
    elif _ai_generates_short_answer_reference(subject):
        schema = """
{
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label",
      "answer": "reference answer for grading"
    }
  ]
}
"""
        type_rules = "Each question needs a concise reference answer."
    else:
        schema = """
{
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label"
    }
  ]
}
"""
        type_rules = "Do not include reference answers."

    base = f"""Generate exactly {missing} additional worksheet questions as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: {subject_text}
Difficulty: {difficulty} (stars {stars} of 3)

These questions continue an existing worksheet. Do NOT repeat or closely paraphrase any question below.

Existing questions:
{existing_block or "(none listed)"}

{type_rules}
- Each question must include a specific lowercase area label.
- No duplicate or near-duplicate questions.

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


def _topup_worksheet_questions(
    parsed: dict,
    *,
    missing: int,
    api_key: str,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    custom_prompt: str = "",
) -> dict:
    if missing <= 0 or missing > TOPUP_MAX_MISSING:
        return parsed
    existing = parsed.get("questions")
    if not isinstance(existing, list):
        existing = []
    topup = _openai_json_completion(
        api_key=api_key,
        messages=[
            {
                "role": "user",
                "content": _build_topup_prompt(
                    missing=missing,
                    subject=subject,
                    grade=grade,
                    stars=stars,
                    fmt=fmt,
                    existing_prompts=_existing_question_prompts(existing),
                    custom_prompt=custom_prompt,
                ),
            }
        ],
    )
    extra_questions = topup.get("questions")
    if not isinstance(extra_questions, list):
        return parsed
    merged = [*existing, *extra_questions]
    return {**parsed, "questions": merged}


def _finalize_worksheet_draft(
    parsed: dict,
    *,
    api_key: str,
    subject: str,
    grade: int,
    stars: int,
    fmt: str,
    question_count: int,
    custom_prompt: str = "",
) -> dict:
    require_reference = fmt != "short_answer" or _ai_generates_short_answer_reference(
        subject
    )
    draft = parsed
    questions = draft.get("questions")
    if isinstance(questions, list):
        missing = question_count - len(questions)
        if 0 < missing <= TOPUP_MAX_MISSING:
            draft = _topup_worksheet_questions(
                draft,
                missing=missing,
                api_key=api_key,
                subject=subject,
                grade=grade,
                stars=stars,
                fmt=fmt,
                custom_prompt=custom_prompt,
            )
    return _normalize_draft(
        draft,
        fmt=fmt,
        question_count=question_count,
        require_short_answer_reference=require_reference,
    )


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
    is_data = subject == "data" and fmt == "multiple_choice" and specs

    if is_rc or is_data:
        normalized_specs = []
        for i, spec in enumerate(specs):
            if not isinstance(spec, dict):
                raise ValueError(f"passage_specs[{i}] must be an object.")
            qcount = spec.get("question_count")
            if not isinstance(qcount, int) or qcount < 1 or qcount > 15:
                raise ValueError(
                    f"passage_specs[{i}].question_count must be between 1 and 15."
                )
            entry = {
                "id": (spec.get("id") or f"p{i + 1}").strip(),
                "question_count": qcount,
                "prompt": (spec.get("prompt") or "").strip(),
            }
            if is_rc:
                min_w = spec.get("min_words")
                if not isinstance(min_w, int):
                    min_w = min_words if isinstance(min_words, int) else 200
                if min_w < 50 or min_w > 2000:
                    raise ValueError(
                        f"passage_specs[{i}].min_words must be between 50 and 2000."
                    )
                entry["min_words"] = min_w
            normalized_specs.append(entry)
        if is_rc:
            user_prompt = _build_rc_prompt(
                grade=grade,
                stars=stars,
                passage_specs=normalized_specs,
                custom_prompt=custom_prompt,
            )
        else:
            user_prompt = _build_data_prompt(
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

    def _request_draft() -> dict:
        return _openai_json_completion(
            api_key=api_key,
            messages=[{"role": "user", "content": user_prompt}],
        )

    if is_rc:
        parsed = _request_draft()
        return _normalize_rc_draft(parsed, passage_specs=normalized_specs)
    if is_data:
        parsed = _request_draft()
        return _normalize_data_draft(parsed, passage_specs=normalized_specs)

    count = question_count if question_count is not None else STARS_DEFAULT_QUESTION_COUNTS[stars]
    last_error: ValueError | None = None
    for attempt in range(2):
        parsed = _request_draft()
        try:
            return _finalize_worksheet_draft(
                parsed,
                api_key=api_key,
                subject=subject,
                grade=grade,
                stars=stars,
                fmt=fmt,
                question_count=count,
                custom_prompt=custom_prompt,
            )
        except ValueError as exc:
            message = str(exc)
            if attempt == 0 and "questions; expected" in message:
                last_error = exc
                continue
            raise
    if last_error:
        raise last_error
    raise ValueError("Could not generate worksheet draft.")


def _build_test_prompt(
    *,
    subject: str,
    grade: int,
    sitting_count: int,
    adaptive: bool,
    custom_prompt: str = "",
) -> str:
    subject_text = _subject_label(subject)
    if adaptive:
        per_tier = sitting_count
        total = per_tier * 3
        bank_rules = f"""
Generate exactly {total} multiple-choice questions in total:
- exactly {per_tier} questions with "stars": 1 (easy)
- exactly {per_tier} questions with "stars": 2 (medium)
- exactly {per_tier} questions with "stars": 3 (hard)

CRITICAL: The questions array must contain exactly {total} items with the tier counts above — count before responding.

These feed an adaptive test where each student answers {sitting_count} questions per sitting and difficulty adjusts by tier after each response.
"""
    else:
        total = max(sitting_count + 4, int(sitting_count * 1.2))
        bank_rules = f"""
Generate {total} multiple-choice questions with a mix of "stars" values 1, 2, and 3.
CRITICAL: The questions array must contain at least {total} items — count before responding.
The sitting uses {sitting_count} questions — include a small buffer so the teacher can review, edit, and reorder before publish.
Extra questions beyond the sitting are trimmed automatically when the test is published.
"""

    schema = """
{
  "title": "short test title",
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label",
      "stars": 2,
      "choices": ["choice A text", "choice B text", "choice C text", "choice D text"],
      "correct_index": 0
    }
  ]
}
"""

    base = f"""Generate a timed assessment question bank as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: {subject_text}
{bank_rules}

Rules:
- Each question must have exactly 4 distinct, non-empty choices.
- correct_index is 0 for A, 1 for B, 2 for C, 3 for D.
- Do not prefix choices with letters.
- Each question must include area: a specific, narrow skill label in lowercase.
- stars must be 1, 2, or 3 for every question.
- No duplicate or near-duplicate questions.
- Accurate correct answers — double-check math and facts.
- Title should be specific and under 80 characters.

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


def _parse_single_test_question(raw: dict, index: int) -> dict:
    prefix = f"AI question {index + 1}"
    if not isinstance(raw, dict):
        raise ValueError(f"{prefix} is invalid.")
    prompt = raw.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError(f"{prefix} is missing a prompt.")

    area = raw.get("area")
    if not isinstance(area, str) or not area.strip():
        raise ValueError(f"{prefix} is missing a specific area label.")

    stars = raw.get("stars")
    if not isinstance(stars, (int, float)) or int(stars) not in (1, 2, 3):
        raise ValueError(f"{prefix} must have stars 1, 2, or 3.")
    stars = int(stars)

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

    return {
        "prompt": prompt.strip(),
        "area": area.strip().lower(),
        "stars": stars,
        "choices": trimmed,
        "correct_index": correct_index,
    }


def _build_test_tier_prompt(
    *,
    subject: str,
    grade: int,
    tier: int,
    count: int,
    custom_prompt: str = "",
) -> str:
    subject_text = _subject_label(subject)
    difficulty = _difficulty_label(tier)
    schema = """
{
  "title": "short test title (optional on later tiers)",
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label",
      "stars": 1,
      "choices": ["choice A text", "choice B text", "choice C text", "choice D text"],
      "correct_index": 0
    }
  ]
}
"""
    base = f"""Generate a timed assessment question bank as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: {subject_text}
Difficulty tier: {difficulty} (stars {tier} of 3)

Generate exactly {count} multiple-choice questions.
CRITICAL: Every question must have "stars": {tier}. The questions array must contain exactly {count} items — count before responding.

Rules:
- Each question must have exactly 4 distinct, non-empty choices.
- correct_index is 0 for A, 1 for B, 2 for C, 3 for D.
- Do not prefix choices with letters.
- Each question must include area: a specific, narrow skill label in lowercase.
- No duplicate or near-duplicate questions.
- Accurate correct answers — double-check math and facts.

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


def _build_test_topup_prompt(
    *,
    missing: int,
    subject: str,
    grade: int,
    sitting_count: int,
    adaptive: bool,
    tier: int | None,
    existing_prompts: list[str],
    custom_prompt: str = "",
) -> str:
    subject_text = _subject_label(subject)
    existing_block = "\n".join(f"- {text}" for text in existing_prompts[:60])
    tier_rule = (
        f'Every question must have "stars": {tier} ({_difficulty_label(tier)}).'
        if tier is not None
        else "Use a mix of stars values 1, 2, and 3."
    )
    schema = """
{
  "questions": [
    {
      "prompt": "question text",
      "area": "specific skill label",
      "stars": 2,
      "choices": ["choice A text", "choice B text", "choice C text", "choice D text"],
      "correct_index": 0
    }
  ]
}
"""
    base = f"""Generate exactly {missing} additional timed-assessment questions as JSON only.

Audience: grade {grade} students in Canada/US curriculum style.
Subject: {subject_text}
Sitting size: {sitting_count} questions per attempt
Mode: {"adaptive tier bank" if adaptive else "fixed-order bank with review buffer"}

These questions continue an existing bank. Do NOT repeat or closely paraphrase any question below.

Existing questions:
{existing_block or "(none listed)"}

{tier_rule}
- Each question must have exactly 4 distinct, non-empty choices and correct_index 0-3.
- Each question must include a specific lowercase area label.
- No duplicate or near-duplicate questions.

Return JSON matching this schema:
{schema}
"""
    extra = (custom_prompt or "").strip()
    if extra:
        if len(extra) > 2000:
            extra = extra[:2000]
        return base + f"\nAdditional instructions from the teacher:\n{extra}\n"
    return base


def _topup_test_questions(
    parsed: dict,
    *,
    missing: int,
    api_key: str,
    subject: str,
    grade: int,
    sitting_count: int,
    adaptive: bool,
    tier: int | None,
    custom_prompt: str = "",
) -> dict:
    if missing <= 0:
        return parsed
    batch = min(missing, TEST_TOPUP_MAX_BATCH)
    existing = parsed.get("questions")
    if not isinstance(existing, list):
        existing = []
    topup = _openai_json_completion(
        api_key=api_key,
        system_role="test",
        timeout=240.0,
        messages=[
            {
                "role": "user",
                "content": _build_test_topup_prompt(
                    missing=batch,
                    subject=subject,
                    grade=grade,
                    sitting_count=sitting_count,
                    adaptive=adaptive,
                    tier=tier,
                    existing_prompts=_existing_question_prompts(existing),
                    custom_prompt=custom_prompt,
                ),
            }
        ],
    )
    extra_questions = topup.get("questions")
    if not isinstance(extra_questions, list):
        return parsed
    return {**parsed, "questions": [*existing, *extra_questions]}


def _finalize_test_tier_questions(
    parsed: dict,
    *,
    tier: int,
    sitting_count: int,
    api_key: str,
    subject: str,
    grade: int,
    custom_prompt: str = "",
) -> list[dict]:
    draft = parsed
    parsed_questions: list[dict] = []
    for _ in range(TEST_TOPUP_MAX_ROUNDS):
        raw_questions = draft.get("questions")
        if not isinstance(raw_questions, list):
            raw_questions = []
        parsed_questions = [
            _parse_single_test_question(raw, i)
            for i, raw in enumerate(raw_questions)
            if isinstance(raw, dict) and int(raw.get("stars") or 0) == tier
        ]
        if len(parsed_questions) >= sitting_count:
            return parsed_questions
        missing = sitting_count - len(parsed_questions)
        draft = _topup_test_questions(
            draft,
            missing=missing,
            api_key=api_key,
            subject=subject,
            grade=grade,
            sitting_count=sitting_count,
            adaptive=True,
            tier=tier,
            custom_prompt=custom_prompt,
        )
    raise ValueError(
        f"AI returned {len(parsed_questions)} tier-{tier} questions; "
        f"expected at least {sitting_count}."
    )


def _generate_adaptive_test_draft(
    *,
    subject: str,
    grade: int,
    sitting_count: int,
    custom_prompt: str,
    api_key: str,
) -> dict:
    title = ""
    all_questions: list[dict] = []
    for tier in (1, 2, 3):
        tier_prompt = _build_test_tier_prompt(
            subject=subject,
            grade=grade,
            tier=tier,
            count=sitting_count,
            custom_prompt=custom_prompt,
        )
        parsed = _openai_json_completion(
            api_key=api_key,
            system_role="test",
            timeout=240.0,
            messages=[{"role": "user", "content": tier_prompt}],
        )
        if not title:
            candidate = parsed.get("title")
            if isinstance(candidate, str) and candidate.strip():
                title = candidate.strip()
        tier_questions = _finalize_test_tier_questions(
            parsed,
            tier=tier,
            sitting_count=sitting_count,
            api_key=api_key,
            subject=subject,
            grade=grade,
            custom_prompt=custom_prompt,
        )
        all_questions.extend(tier_questions)

    if not title:
        title = f"{_subject_label(subject)} Adaptive Test"

    return _normalize_test_draft(
        {"title": title, "questions": all_questions},
        sitting_count=sitting_count,
        adaptive=True,
    )


def _finalize_fixed_test_draft(
    parsed: dict,
    *,
    api_key: str,
    subject: str,
    grade: int,
    sitting_count: int,
    custom_prompt: str = "",
) -> dict:
    draft = parsed
    min_count = sitting_count
    for _ in range(TEST_TOPUP_MAX_ROUNDS):
        raw_questions = draft.get("questions")
        if not isinstance(raw_questions, list):
            raw_questions = []
        if len(raw_questions) >= min_count:
            break
        missing = min_count - len(raw_questions)
        draft = _topup_test_questions(
            draft,
            missing=missing,
            api_key=api_key,
            subject=subject,
            grade=grade,
            sitting_count=sitting_count,
            adaptive=False,
            tier=None,
            custom_prompt=custom_prompt,
        )
    return _normalize_test_draft(
        draft,
        sitting_count=sitting_count,
        adaptive=False,
    )


def _normalize_test_draft(
    data: dict,
    *,
    sitting_count: int,
    adaptive: bool,
) -> dict:
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("AI draft is missing a title.")

    raw_questions = data.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        raise ValueError("AI draft has no questions.")

    if adaptive:
        expected = sitting_count * 3
        min_count = expected
    else:
        expected = max(sitting_count + 4, int(sitting_count * 1.2))
        min_count = sitting_count

    if len(raw_questions) < min_count:
        raise ValueError(
            f"AI returned {len(raw_questions)} questions; expected at least {min_count}."
        )

    tier_counts = {1: 0, 2: 0, 3: 0}
    questions: list[dict] = []
    for i, raw in enumerate(raw_questions):
        question = _parse_single_test_question(raw, i)
        stars = question["stars"]
        tier_counts[stars] += 1
        questions.append(question)

    if adaptive:
        per_tier: dict[int, list[dict]] = {1: [], 2: [], 3: []}
        for question in questions:
            per_tier[int(question["stars"])].append(question)
        trimmed: list[dict] = []
        for tier in (1, 2, 3):
            trimmed.extend(per_tier[tier][:sitting_count])
        questions = trimmed
        tier_counts = {1: 0, 2: 0, 3: 0}
        for question in questions:
            tier_counts[int(question["stars"])] += 1
        for tier in (1, 2, 3):
            if tier_counts[tier] < sitting_count:
                raise ValueError(
                    f"AI returned {tier_counts[tier]} tier-{tier} questions; "
                    f"expected at least {sitting_count}."
                )
    else:
        if len(questions) < sitting_count:
            raise ValueError(
                f"AI returned {len(questions)} questions; expected at least {sitting_count}."
            )

    return {"title": title.strip(), "questions": questions}


def generate_test_draft(
    *,
    subject: str,
    grade: int,
    sitting_count: int,
    adaptive: bool = True,
    custom_prompt: str = "",
    api_key: str,
) -> dict:
    """Call OpenAI and return test-builder-ready draft."""
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("No OpenAI API key. Add yours under Admin → Settings.")

    subject = subject.strip().lower()
    if subject not in VALID_SUBJECTS:
        raise ValueError(f"subject must be one of: {', '.join(sorted(VALID_SUBJECTS))}.")
    if not isinstance(grade, int) or grade < 1 or grade > 12:
        raise ValueError("grade must be an integer from 1 to 12.")
    if not isinstance(sitting_count, int) or sitting_count < 1 or sitting_count > 100:
        raise ValueError("sitting_count must be between 1 and 100.")

    user_prompt = _build_test_prompt(
        subject=subject,
        grade=grade,
        sitting_count=sitting_count,
        adaptive=adaptive,
        custom_prompt=custom_prompt,
    )

    if adaptive:
        return _generate_adaptive_test_draft(
            subject=subject,
            grade=grade,
            sitting_count=sitting_count,
            custom_prompt=custom_prompt,
            api_key=api_key,
        )

    def _request_draft() -> dict:
        return _openai_json_completion(
            api_key=api_key,
            system_role="test",
            timeout=240.0,
            messages=[{"role": "user", "content": user_prompt}],
        )

    last_error: ValueError | None = None
    for attempt in range(2):
        parsed = _request_draft()
        try:
            return _finalize_fixed_test_draft(
                parsed,
                api_key=api_key,
                subject=subject,
                grade=grade,
                sitting_count=sitting_count,
                custom_prompt=custom_prompt,
            )
        except ValueError as exc:
            message = str(exc)
            if attempt == 0 and "questions; expected" in message:
                last_error = exc
                continue
            raise
    if last_error:
        raise last_error
    raise ValueError("Could not generate test draft.")
