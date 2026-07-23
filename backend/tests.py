"""Adaptive Tests — timed, one-sitting assessments separate from regular worksheets."""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone

import db
from worksheets import (
    assert_worksheet_accessible,
    compute_worksheet_access_lock,
    get_gifted_track_locked_weeks,
    get_gifted_track_unlocked_through_week,
    get_worksheet,
    get_worksheet_lock_overrides,
)

TIER_WEIGHTS = {1: 1.0, 2: 1.5, 3: 2.0}
START_TIER = 2
VALID_TIERS = (1, 2, 3)


def _normalize_subject(subject: str) -> str:
    return (subject or "").strip().lower()


def tier_weight(tier: int) -> float:
    return TIER_WEIGHTS.get(int(tier), 1.0)


def _test_from_sheet_data(data: dict) -> bool:
    return data.get("is_test") is True


def test_sitting_count_from_data(data: dict) -> int:
    raw = data.get("test_sitting_count", 20)
    if isinstance(raw, bool):
        raw = 20
    try:
        n = int(raw)
    except (TypeError, ValueError):
        n = 20
    return max(1, min(n, 100))


def test_adaptive_from_data(data: dict) -> bool:
    return data.get("test_adaptive") is not False


def test_rc_questions_per_passage_from_data(data: dict) -> int:
    raw = data.get("test_rc_questions_per_passage")
    if isinstance(raw, bool):
        raw = None
    try:
        n = int(raw)
    except (TypeError, ValueError):
        n = 0
    if n >= 1:
        return min(n, 12)
    q_by_passage: dict[str, int] = {}
    for q in data.get("questions") or []:
        if not isinstance(q, dict):
            continue
        pid = str(q.get("passage_id") or "").strip()
        if pid:
            q_by_passage[pid] = q_by_passage.get(pid, 0) + 1
    if q_by_passage:
        return max(q_by_passage.values())
    return 4


def _normalize_passage_tier(raw) -> int | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        tier = int(raw)
        return tier if tier in VALID_TIERS else None
    if isinstance(raw, str) and raw.strip().isdigit():
        tier = int(raw.strip())
        return tier if tier in VALID_TIERS else None
    return None


def validate_test_worksheet_data(data: dict) -> list[str]:
    """Extra validation for test worksheets."""
    errors: list[str] = []
    if not _test_from_sheet_data(data):
        return errors

    sitting = test_sitting_count_from_data(data)
    adaptive = test_adaptive_from_data(data)
    if not data.get("timed"):
        errors.append("Tests must be timed (timed: true).")
    limit = data.get("time_limit_minutes")
    if not isinstance(limit, (int, float)) or int(limit) <= 0:
        errors.append("Tests require a positive time_limit_minutes.")

    questions = data.get("questions") or []
    if not questions:
        errors.append("Tests require a non-empty question bank.")
        return errors

    is_rc = _is_rc_test(data)

    if is_rc:
        per_passage = test_rc_questions_per_passage_from_data(data)
        passages = data.get("passages") or []
        if not isinstance(passages, list) or not passages:
            errors.append("Reading comprehension tests require at least one passage.")
        else:
            passage_ids: set[str] = set()
            passage_tier_counts = {1: 0, 2: 0, 3: 0}
            q_counts: dict[str, int] = {}
            for i, passage in enumerate(passages):
                if not isinstance(passage, dict):
                    errors.append(f"passages[{i}] must be an object.")
                    continue
                pid = str(passage.get("id") or "").strip()
                if not pid:
                    errors.append(f"passages[{i}].id is required.")
                    continue
                passage_ids.add(pid)
                tier = _normalize_passage_tier(passage.get("tier"))
                if tier is None:
                    tier = _normalize_passage_tier(passage.get("stars"))
                if tier is None:
                    errors.append(f"passages[{i}] must have tier 1, 2, or 3.")
                else:
                    passage_tier_counts[tier] += 1
            for i, q in enumerate(questions):
                if not isinstance(q, dict):
                    continue
                passage_id = str(q.get("passage_id") or "").strip()
                if not passage_id or passage_id not in passage_ids:
                    errors.append(
                        f"questions[{i}] must reference a passage for reading comprehension."
                    )
                else:
                    q_counts[passage_id] = q_counts.get(passage_id, 0) + 1
            for i, passage in enumerate(passages):
                pid = str(passage.get("id") or "").strip()
                if not pid:
                    continue
                count = q_counts.get(pid, 0)
                if count != per_passage:
                    errors.append(
                        f"passages[{i}] needs exactly {per_passage} questions (has {count})."
                    )
            if adaptive:
                for tier in VALID_TIERS:
                    if passage_tier_counts[tier] < sitting:
                        errors.append(
                            f"Test bank needs at least {sitting} tier-{tier} passages "
                            f"(has {passage_tier_counts[tier]})."
                        )
            elif len(passages) < sitting:
                errors.append(
                    f"Test bank needs at least {sitting} passages (has {len(passages)})."
                )
        if data.get("evaluation") == "manual":
            errors.append("Tests must use auto-evaluated multiple choice questions.")
        return errors

    tier_counts = {1: 0, 2: 0, 3: 0}
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        tier = _question_tier(q, data)
        tier_counts[tier] += 1
        stars = q.get("stars")
        if not isinstance(stars, (int, float)) or int(stars) not in VALID_TIERS:
            errors.append(f"questions[{i}].stars must be 1, 2, or 3 for tests.")

    if adaptive:
        for tier in VALID_TIERS:
            if tier_counts[tier] < sitting:
                errors.append(
                    f"Test bank needs at least {sitting} tier-{tier} questions "
                    f"(has {tier_counts[tier]})."
                )
    elif len(questions) < sitting:
        errors.append(
            f"Test bank needs at least {sitting} questions (has {len(questions)})."
        )

    if data.get("evaluation") == "manual":
        errors.append("Tests must use auto-evaluated multiple choice questions.")

    return errors


def _is_rc_test(data: dict) -> bool:
    return str(data.get("english_type") or "").strip().lower() == "reading_comprehension"


def _passage_tier_lookup(worksheet: dict) -> dict[str, int]:
    out: dict[str, int] = {}
    for passage in worksheet.get("passages") or []:
        if not isinstance(passage, dict):
            continue
        pid = str(passage.get("id") or "").strip()
        if not pid:
            continue
        tier = passage.get("tier")
        if tier is None:
            tier = passage.get("stars")
        if isinstance(tier, (int, float)) and int(tier) in VALID_TIERS:
            out[pid] = int(tier)
    return out


def _question_tier(q: dict, worksheet: dict) -> int:
    if _is_rc_test(worksheet):
        passage_id = q.get("passage_id")
        if passage_id:
            tier = _passage_tier_lookup(worksheet).get(str(passage_id))
            if tier is not None:
                return tier
    stars = q.get("stars")
    if isinstance(stars, (int, float)) and int(stars) in VALID_TIERS:
        return int(stars)
    return START_TIER


def _questions_by_tier(worksheet: dict) -> dict[int, list[dict]]:
    pools: dict[int, list[dict]] = {1: [], 2: [], 3: []}
    for q in worksheet.get("questions") or []:
        tier = _question_tier(q, worksheet)
        pools[tier].append(q)
    return pools


def _questions_by_passage_id(worksheet: dict) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for q in worksheet.get("questions") or []:
        if not isinstance(q, dict):
            continue
        pid = str(q.get("passage_id") or "").strip()
        if pid:
            out.setdefault(pid, []).append(q)
    return out


def _passages_by_tier(worksheet: dict) -> dict[int, list[dict]]:
    per_passage = test_rc_questions_per_passage_from_data(worksheet)
    qmap = _questions_by_passage_id(worksheet)
    pools: dict[int, list[dict]] = {1: [], 2: [], 3: []}
    for passage in worksheet.get("passages") or []:
        if not isinstance(passage, dict):
            continue
        pid = str(passage.get("id") or "").strip()
        if not pid:
            continue
        tier_raw = passage.get("tier")
        if tier_raw is None:
            tier_raw = passage.get("stars")
        tier = int(tier_raw) if isinstance(tier_raw, (int, float)) else START_TIER
        if tier not in VALID_TIERS:
            tier = START_TIER
        qs = qmap.get(pid, [])
        if len(qs) < per_passage:
            continue
        pools[tier].append(
            {
                "passage_id": pid,
                "tier": tier,
                "question_ids": [str(q["id"]) for q in qs[:per_passage]],
            }
        )
    return pools


def _passage_majority_correct(
    responses: dict | None, question_ids: list[str], lookup: dict[str, dict]
) -> bool:
    if not question_ids:
        return False
    correct = 0
    for qid in question_ids:
        q = lookup.get(str(qid))
        if not q:
            continue
        expected = str(q.get("answer") or "").strip()
        given = str((responses or {}).get(str(qid)) or "").strip()
        if given == expected:
            correct += 1
    return correct * 2 > len(question_ids)


def _pick_passage(
    pools: dict[int, list[dict]],
    tier: int,
    used_passage_ids: set[str],
    rng: random.Random,
) -> dict | None:
    candidates = [
        p for p in pools.get(tier, []) if str(p.get("passage_id")) not in used_passage_ids
    ]
    if not candidates:
        for fallback_tier in (2, 3, 1):
            candidates = [
                p
                for p in pools.get(fallback_tier, [])
                if str(p.get("passage_id")) not in used_passage_ids
            ]
            if candidates:
                tier = fallback_tier
                break
    if not candidates:
        return None
    picked = rng.choice(candidates)
    return {
        "passage_id": str(picked["passage_id"]),
        "tier": tier,
        "question_ids": list(picked.get("question_ids") or []),
    }


def _assign_through_slot_rc(
    sequence: list[dict | None],
    answers: dict,
    pools: dict[int, list[dict]],
    sitting_count: int,
    target_slot: int,
    rng: random.Random,
    *,
    adaptive: bool = True,
) -> list[dict | None]:
    target_slot = max(1, min(target_slot, sitting_count))
    used_passage_ids = {
        str(entry["passage_id"])
        for entry in sequence
        if isinstance(entry, dict) and entry.get("passage_id")
    }

    current_tier = START_TIER
    for slot in range(1, target_slot + 1):
        idx = slot - 1
        if idx < len(sequence) and isinstance(sequence[idx], dict):
            current_tier = int(sequence[idx].get("tier") or START_TIER)
            if adaptive:
                prev_key = str(slot)
                if prev_key in answers:
                    prev = answers[prev_key]
                    if isinstance(prev, dict) and "correct" in prev:
                        current_tier = _next_tier(
                            current_tier, correct=bool(prev.get("correct"))
                        )
            continue

        tier_to_use = current_tier if adaptive else ((slot - 1) % 3) + 1
        picked = _pick_passage(pools, tier_to_use, used_passage_ids, rng)
        if not picked:
            break
        while len(sequence) < slot:
            sequence.append(None)
        sequence[idx] = {"slot": slot, **picked}
        used_passage_ids.add(picked["passage_id"])

        if adaptive:
            prev_key = str(slot)
            if prev_key in answers:
                prev = answers[prev_key]
                if isinstance(prev, dict) and "correct" in prev:
                    current_tier = _next_tier(
                        int(picked["tier"]),
                        correct=bool(prev.get("correct")),
                    )

    return sequence


def _rc_responses_complete(responses: dict | None, question_ids: list[str]) -> bool:
    if not question_ids:
        return False
    for qid in question_ids:
        if not str((responses or {}).get(str(qid)) or "").strip():
            return False
    return True


def _slot_answered_non_rc(answers: dict, slot: int) -> bool:
    ans = answers.get(str(slot))
    return isinstance(ans, dict) and bool(str(ans.get("given") or "").strip())


def _rc_slot_fully_answered(answers: dict, sequence: list, slot: int) -> bool:
    ans = answers.get(str(slot))
    if isinstance(ans, dict) and "correct" in ans:
        return True
    entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
    if not isinstance(entry, dict):
        return False
    question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
    responses = ans.get("responses") if isinstance(ans, dict) and isinstance(ans.get("responses"), dict) else {}
    return _rc_responses_complete(responses, question_ids)


def _question_has_passage_context(q: dict | None, worksheet: dict) -> bool:
    if not q:
        return False
    pid = str(q.get("passage_id") or "").strip()
    return bool(pid and _passage_lookup(worksheet).get(pid))


def _worksheet_has_contextual_units(worksheet: dict) -> bool:
    if _is_rc_test(worksheet):
        return True
    lookup = _passage_lookup(worksheet)
    for q in worksheet.get("questions") or []:
        if not isinstance(q, dict):
            continue
        pid = str(q.get("passage_id") or "").strip()
        if pid and pid in lookup:
            return True
    return False


def _context_passage_key_for_slot(
    sequence: list,
    lookup: dict[str, dict],
    worksheet: dict,
    slot: int,
) -> str | None:
    entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
    if not isinstance(entry, dict):
        return None
    q = lookup.get(str(entry.get("question_id")))
    if not _question_has_passage_context(q, worksheet):
        return None
    return str(q.get("passage_id"))


def _build_context_groups(
    sequence: list,
    lookup: dict[str, dict],
    worksheet: dict,
    sitting_count: int,
) -> list[dict]:
    groups: list[dict] = []
    current: dict | None = None
    for slot in range(1, sitting_count + 1):
        entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        if not isinstance(entry, dict):
            break
        key = _context_passage_key_for_slot(sequence, lookup, worksheet, slot)
        if not key:
            if current:
                groups.append(current)
                current = None
            continue
        if current and current["key"] == key:
            current["slots"].append(slot)
        else:
            if current:
                groups.append(current)
            current = {"key": key, "slots": [slot]}
    if current:
        groups.append(current)
    return groups


def _max_navigable_target_slot(
    answers: dict,
    sequence: list,
    worksheet: dict,
    sitting_count: int,
) -> int:
    if not _worksheet_has_contextual_units(worksheet):
        return sitting_count

    if _is_rc_test(worksheet):
        for slot in range(1, sitting_count + 1):
            if not _rc_slot_fully_answered(answers, sequence, slot):
                return slot
        return sitting_count

    lookup = _question_lookup(worksheet)
    groups = _build_context_groups(sequence, lookup, worksheet, sitting_count)
    for group in groups:
        complete = all(_slot_answered_non_rc(answers, slot) for slot in group["slots"])
        if not complete:
            return max(group["slots"])
    return sitting_count


def _clamp_target_slot(
    target_slot: int | None,
    answers: dict,
    sequence: list,
    worksheet: dict,
    sitting_count: int,
) -> int:
    max_nav = _max_navigable_target_slot(answers, sequence, worksheet, sitting_count)
    if target_slot is None:
        return max_nav
    requested = max(1, min(int(target_slot), sitting_count))
    if _is_rc_test(worksheet) and _rc_slot_fully_answered(
        answers, sequence, requested
    ):
        return requested
    return min(requested, max_nav)


def _build_rc_passage_answer(
    entry: dict,
    responses: dict,
    lookup: dict[str, dict],
    *,
    prev: dict | None = None,
) -> dict:
    question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
    tier = int(entry.get("tier") or START_TIER)
    prev_scratchpad = prev.get("scratchpad", "") if isinstance(prev, dict) else ""
    prev_work_text = prev.get("work_text", "") if isinstance(prev, dict) else ""
    prev_work_mode = prev.get("work_mode", "text") if isinstance(prev, dict) else "text"
    if prev_work_mode not in ("text", "scratchpad"):
        prev_work_mode = "text"

    question_details = []
    for qid in question_ids:
        q = lookup.get(qid)
        if not q:
            continue
        expected = str(q.get("answer") or "").strip()
        given = str(responses.get(qid) or "").strip()
        question_details.append(
            {
                "question_id": qid,
                "prompt": q.get("prompt") or "",
                "given": given,
                "expected": expected,
                "correct": given == expected,
                "choices": q.get("choices") or [],
                "area": q.get("area") or "",
            }
        )

    correct_count = sum(1 for item in question_details if item.get("correct"))
    passage_correct = _passage_majority_correct(responses, question_ids, lookup)
    return {
        "passage_id": entry.get("passage_id"),
        "tier": tier,
        "responses": responses,
        "correct": passage_correct,
        "correct_count": correct_count,
        "question_count": len(question_ids),
        "questions": question_details,
        "scratchpad": prev_scratchpad,
        "work_text": prev_work_text,
        "work_mode": prev_work_mode,
    }


def _question_lookup(worksheet: dict) -> dict[str, dict]:
    return {
        str(q.get("id")): q
        for q in (worksheet.get("questions") or [])
        if q.get("id")
    }


def _passage_lookup(worksheet: dict) -> dict[str, dict]:
    return {
        str(p.get("id")): p
        for p in (worksheet.get("passages") or [])
        if p.get("id")
    }


def _strip_answer(q: dict) -> dict:
    out = dict(q)
    out.pop("answer", None)
    return out


def _question_for_session(q: dict, worksheet: dict) -> dict:
    out = _strip_answer(q)
    passage_id = q.get("passage_id")
    if passage_id:
        passage = _passage_lookup(worksheet).get(str(passage_id))
        if passage:
            out["passage"] = passage
    return out


def _parse_json(raw, default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def build_ordered_test_slots(
    sequence: list | None,
    answers: dict | None,
    *,
    sitting_count: int,
) -> list[dict]:
    """Merge sequence + answers into slot-ordered rows for test analysis."""
    sequence = sequence if isinstance(sequence, list) else []
    answers = answers if isinstance(answers, dict) else {}
    sitting_count = max(1, int(sitting_count or 1))
    slots: list[dict] = []

    for slot in range(1, sitting_count + 1):
        key = str(slot)
        answer = answers.get(key)
        if not isinstance(answer, dict):
            continue
        seq_entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        tier = answer.get("tier")
        if not isinstance(tier, (int, float)):
            if isinstance(seq_entry, dict):
                tier = seq_entry.get("tier")
        tier = int(tier) if isinstance(tier, (int, float)) else START_TIER
        tier = max(1, min(3, tier))

        if isinstance(answer.get("responses"), dict):
            for detail in answer.get("questions") or []:
                if not isinstance(detail, dict):
                    continue
                slots.append(
                    {
                        "slot": slot,
                        "tier": tier,
                        "area": str(detail.get("area") or "").strip(),
                        "correct": detail.get("correct") is True,
                        "question_id": detail.get("question_id"),
                        "prompt": detail.get("prompt") or "",
                        "given": detail.get("given") or "",
                        "expected": detail.get("expected") or "",
                        "choices": detail.get("choices") or [],
                        "passage_id": answer.get("passage_id"),
                    }
                )
            continue

        slots.append(
            {
                "slot": slot,
                "tier": tier,
                "area": str(answer.get("area") or "").strip(),
                "correct": answer.get("correct") is True,
                "question_id": answer.get("question_id"),
                "prompt": answer.get("prompt") or "",
                "given": answer.get("given") or "",
                "expected": answer.get("expected") or "",
                "choices": answer.get("choices") or [],
            }
        )
    return slots


def _next_tier(current: int, *, correct: bool) -> int:
    if correct:
        return min(current + 1, 3)
    return max(current - 1, 1)


def _pick_question(
    pools: dict[int, list[dict]], tier: int, used_ids: set[str], rng: random.Random
) -> dict | None:
    candidates = [q for q in pools.get(tier, []) if str(q.get("id")) not in used_ids]
    if not candidates:
        for fallback_tier in (2, 3, 1):
            candidates = [
                q
                for q in pools.get(fallback_tier, [])
                if str(q.get("id")) not in used_ids
            ]
            if candidates:
                tier = fallback_tier
                break
    if not candidates:
        return None
    q = rng.choice(candidates)
    return {"question_id": str(q["id"]), "tier": tier}


def _assign_through_slot(
    sequence: list[dict | None],
    answers: dict,
    pools: dict[int, list[dict]],
    sitting_count: int,
    target_slot: int,
    rng: random.Random,
    *,
    adaptive: bool = True,
) -> list[dict | None]:
    """Ensure slots 1..target_slot are assigned using adaptive or fixed rules."""
    target_slot = max(1, min(target_slot, sitting_count))
    used_ids = {
        str(entry["question_id"])
        for entry in sequence
        if isinstance(entry, dict) and entry.get("question_id")
    }

    current_tier = START_TIER
    for slot in range(1, target_slot + 1):
        idx = slot - 1
        if idx < len(sequence) and isinstance(sequence[idx], dict):
            current_tier = int(sequence[idx].get("tier") or START_TIER)
            if adaptive:
                prev_key = str(slot)
                if prev_key in answers:
                    prev = answers[prev_key]
                    if isinstance(prev, dict) and "correct" in prev:
                        current_tier = _next_tier(
                            current_tier, correct=bool(prev.get("correct"))
                        )
            continue

        tier_to_use = current_tier if adaptive else ((slot - 1) % 3) + 1
        picked = _pick_question(pools, tier_to_use, used_ids, rng)
        if not picked:
            break
        while len(sequence) < slot:
            sequence.append(None)
        sequence[idx] = {"slot": slot, **picked}
        used_ids.add(picked["question_id"])

        if adaptive:
            prev_key = str(slot)
            if prev_key in answers:
                prev = answers[prev_key]
                if isinstance(prev, dict) and "correct" in prev:
                    current_tier = _next_tier(
                        int(picked["tier"]),
                        correct=bool(prev.get("correct")),
                    )

    return sequence


def _timed_remaining_seconds(started_at: str, limit_minutes: int) -> tuple[int, bool]:
    started = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    total = int(limit_minutes) * 60
    remaining = max(0, int(total - elapsed))
    return remaining, remaining <= 0


def _attempt_row_to_rc_session(
    row,
    worksheet: dict,
    *,
    sitting_count: int,
    target_slot: int | None = None,
) -> dict:
    sequence = _parse_json(row["sequence"], [])
    answers = _parse_json(row["answers"], {})
    pools = _passages_by_tier(worksheet)
    rng = random.Random(f"{row['student']}:{row['worksheet_id']}:{row['id']}")
    adaptive = test_adaptive_from_data(worksheet)
    passage_lookup = _passage_lookup(worksheet)
    lookup = _question_lookup(worksheet)

    if not sequence:
        sequence = [None] * sitting_count
    elif len(sequence) < sitting_count:
        sequence = sequence + [None] * (sitting_count - len(sequence))

    if target_slot is None:
        assigned = sum(1 for s in sequence if isinstance(s, dict))
        if adaptive:
            target_slot = max(1, assigned)
        else:
            target_slot = sitting_count

    target_slot = _clamp_target_slot(
        target_slot, answers, sequence, worksheet, sitting_count
    )

    sequence = _assign_through_slot_rc(
        sequence,
        answers,
        pools,
        sitting_count,
        target_slot,
        rng,
        adaptive=adaptive,
    )

    slots_out = []
    for slot in range(1, sitting_count + 1):
        idx = slot - 1
        entry = sequence[idx] if idx < len(sequence) else None
        ans = answers.get(str(slot))
        item = {
            "slot": slot,
            "assigned": isinstance(entry, dict),
            "answered": False,
        }
        if isinstance(entry, dict):
            passage = passage_lookup.get(str(entry.get("passage_id")))
            question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
            questions = []
            for qid in question_ids:
                q = lookup.get(qid)
                if q:
                    questions.append(_question_for_session(q, worksheet))
            item["tier"] = int(entry.get("tier") or START_TIER)
            item["passage_id"] = entry.get("passage_id")
            if passage:
                item["passage"] = passage
            if questions:
                item["questions"] = questions
        if isinstance(ans, dict):
            responses = ans.get("responses") if isinstance(ans.get("responses"), dict) else {}
            item["responses"] = responses
            question_ids = [
                str(qid) for qid in (entry.get("question_ids") or []) if isinstance(entry, dict)
            ]
            item["answered"] = _rc_responses_complete(responses, question_ids)
            if row["completed_at"] and "correct" in ans:
                item["correct"] = ans.get("correct")
            mode = ans.get("work_mode")
            item["work_mode"] = mode if mode in ("text", "scratchpad") else "text"
            item["work_text"] = str(ans.get("work_text") or "")
            if ans.get("scratchpad"):
                item["scratchpad"] = ans.get("scratchpad")
        slots_out.append(item)

    limit = int(worksheet.get("time_limit_minutes") or 0)
    remaining, expired = _timed_remaining_seconds(row["started_at"], limit)
    expires_at = datetime.fromisoformat(str(row["started_at"]).replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    expires_at = expires_at + timedelta(minutes=limit)

    highest_assigned = max(
        (s["slot"] for s in slots_out if s.get("assigned")),
        default=0,
    )

    return {
        "attempt_id": row["id"],
        "worksheet_id": row["worksheet_id"],
        "title": worksheet.get("title") or row["worksheet_id"],
        "subject": worksheet.get("subject") or "general",
        "scratchpad": True,
        "sitting_count": sitting_count,
        "slots": slots_out,
        "current_slot": target_slot or 1,
        "highest_assigned": highest_assigned,
        "started_at": row["started_at"],
        "expires_at": expires_at.isoformat(),
        "remaining_seconds": remaining,
        "expired": expired,
        "time_limit_minutes": limit,
        "completed": bool(row["completed_at"]),
        "locked": bool(int(row["locked"] or 0)),
        "sequence": sequence,
        "answers": answers,
        "is_rc": True,
        "english_type": "reading_comprehension",
        "questions_per_passage": test_rc_questions_per_passage_from_data(worksheet),
    }


def _attempt_row_to_session(
    row,
    worksheet: dict,
    *,
    sitting_count: int,
    target_slot: int | None = None,
) -> dict:
    if _is_rc_test(worksheet):
        return _attempt_row_to_rc_session(
            row,
            worksheet,
            sitting_count=sitting_count,
            target_slot=target_slot,
        )

    sequence = _parse_json(row["sequence"], [])
    answers = _parse_json(row["answers"], {})
    pools = _questions_by_tier(worksheet)
    rng = random.Random(f"{row['student']}:{row['worksheet_id']}:{row['id']}")
    adaptive = test_adaptive_from_data(worksheet)

    if not sequence:
        sequence = [None] * sitting_count
    elif len(sequence) < sitting_count:
        sequence = sequence + [None] * (sitting_count - len(sequence))

    if target_slot is None:
        assigned = sum(1 for s in sequence if isinstance(s, dict))
        if adaptive:
            target_slot = max(1, assigned)
        else:
            target_slot = sitting_count

    target_slot = _clamp_target_slot(
        target_slot, answers, sequence, worksheet, sitting_count
    )

    sequence = _assign_through_slot(
        sequence,
        answers,
        pools,
        sitting_count,
        target_slot,
        rng,
        adaptive=adaptive,
    )

    lookup = _question_lookup(worksheet)
    slots_out = []
    for slot in range(1, sitting_count + 1):
        idx = slot - 1
        entry = sequence[idx] if idx < len(sequence) else None
        ans = answers.get(str(slot))
        item = {
            "slot": slot,
            "assigned": isinstance(entry, dict),
            "answered": isinstance(ans, dict) and ans.get("given") not in (None, ""),
        }
        if isinstance(entry, dict):
            q = lookup.get(str(entry["question_id"]))
            if q:
                item["tier"] = int(
                    entry.get("tier") or _question_tier(q, worksheet) or START_TIER
                )
                item["question"] = _question_for_session(q, worksheet)
        if isinstance(ans, dict):
            if ans.get("given") not in (None, ""):
                item["given"] = ans.get("given", "")
                if row["completed_at"]:
                    item["correct"] = ans.get("correct")
            mode = ans.get("work_mode")
            item["work_mode"] = mode if mode in ("text", "scratchpad") else "text"
            item["work_text"] = str(ans.get("work_text") or "")
            if ans.get("scratchpad"):
                item["scratchpad"] = ans.get("scratchpad")
        slots_out.append(item)

    limit = int(worksheet.get("time_limit_minutes") or 0)
    remaining, expired = _timed_remaining_seconds(row["started_at"], limit)
    expires_at = datetime.fromisoformat(str(row["started_at"]).replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    expires_at = expires_at + timedelta(minutes=limit)

    highest_assigned = max(
        (s["slot"] for s in slots_out if s.get("assigned")),
        default=0,
    )

    return {
        "attempt_id": row["id"],
        "worksheet_id": row["worksheet_id"],
        "title": worksheet.get("title") or row["worksheet_id"],
        "subject": worksheet.get("subject") or "general",
        "scratchpad": True,
        "sitting_count": sitting_count,
        "slots": slots_out,
        "current_slot": target_slot or 1,
        "highest_assigned": highest_assigned,
        "started_at": row["started_at"],
        "expires_at": expires_at.isoformat(),
        "remaining_seconds": remaining,
        "expired": expired,
        "time_limit_minutes": limit,
        "completed": bool(row["completed_at"]),
        "locked": bool(int(row["locked"] or 0)),
        "sequence": sequence,
        "answers": answers,
    }


def _save_attempt_state(conn, attempt_id: int, sequence: list, answers: dict) -> None:
    conn.execute(
        """
        UPDATE test_attempts
        SET sequence = ?, answers = ?
        WHERE id = ?
        """,
        (json.dumps(sequence), json.dumps(answers), attempt_id),
    )


def list_tests(student_name: str, *, admin_id: int) -> list[dict]:
    conn = db.connect()
    try:
        default_admin = conn.execute("SELECT MIN(id) AS id FROM admins").fetchone()
        default_admin_id = (
            int(default_admin["id"])
            if default_admin and default_admin["id"] is not None
            else admin_id
        )
        rows = conn.execute(
            """
            SELECT w.id, w.title, w.subject, w.sort_ts, w.is_timed, w.time_limit_minutes,
                   w.test_sitting_count,
                   (SELECT COUNT(*) FROM worksheet_questions q WHERE q.worksheet_id = w.id) AS bank_size,
                   ta.id AS attempt_id, ta.completed_at, ta.weighted_score, ta.max_weighted_score,
                   ta.locked AS attempt_locked, ta.started_at,
                   tr.id AS review_id, tr.completed_at AS review_completed_at
            FROM worksheets w
            LEFT JOIN test_attempts ta
              ON ta.worksheet_id = w.id AND ta.student = ?
            LEFT JOIN test_review_sessions tr
              ON tr.attempt_id = ta.id
            WHERE COALESCE(w.is_test, 0) = 1
              AND (w.admin_id = ? OR (w.admin_id IS NULL AND ? = ?))
            ORDER BY w.sort_ts DESC, w.id DESC
            """,
            (student_name, admin_id, admin_id, default_admin_id),
        ).fetchall()

        unlocked = get_gifted_track_unlocked_through_week(conn, student_name)
        overrides = get_worksheet_lock_overrides(conn, student_name)
        locked_weeks = get_gifted_track_locked_weeks(conn, student_name)
    finally:
        conn.close()

    out = []
    for r in rows:
        ws = get_worksheet(r["id"], admin_id=admin_id)
        if not ws:
            continue
        sitting = int(r["test_sitting_count"] or test_sitting_count_from_data(ws))
        item = {
            "id": r["id"],
            "title": ws.get("title") or r["title"],
            "subject": ws.get("subject") or r["subject"],
            "sort_ts": r["sort_ts"],
            "timed": True,
            "time_limit_minutes": ws.get("time_limit_minutes") or r["time_limit_minutes"],
            "test_sitting_count": sitting,
            "test_adaptive": test_adaptive_from_data(ws),
            "bank_size": r["bank_size"],
            "content_badge": ws.get("content_badge") or "Test",
            "done": bool(r["completed_at"]),
            "attempt_id": r["attempt_id"],
            "attempt_started": bool(r["started_at"]),
            "attempt_locked": bool(int(r["attempt_locked"] or 0)) if r["attempt_id"] else False,
        }
        access_locked, lock_reason = compute_worksheet_access_lock(
            r["id"],
            bool(ws.get("gifted_track")),
            ws.get("gifted_track_week"),
            unlocked,
            overrides,
            locked_weeks,
        )
        if access_locked:
            item["access_locked"] = True
            item["lock_reason"] = lock_reason
        if r["completed_at"]:
            item["completed_at"] = r["completed_at"]
            if r["weighted_score"] is not None and r["max_weighted_score"] is not None:
                item["weighted_score"] = float(r["weighted_score"])
                item["max_weighted_score"] = float(r["max_weighted_score"])
        if r["review_id"]:
            item["review_id"] = r["review_id"]
            item["review_completed"] = bool(r["review_completed_at"])
        out.append(item)
    return out


def _preview_test_session(
    worksheet: dict,
    worksheet_id: str,
    *,
    sitting_count: int,
    target_slot: int | None = None,
) -> dict:
    """Read-only test session for admin preview — does not touch test_attempts."""
    started_at = datetime.now(timezone.utc).isoformat()
    limit = int(worksheet.get("time_limit_minutes") or 0)
    assign_through = sitting_count
    if target_slot is not None:
        assign_through = _clamp_target_slot(
            target_slot,
            {},
            [],
            worksheet,
            sitting_count,
        )

    fake_row = {
        "id": 0,
        "student": "",
        "worksheet_id": worksheet_id,
        "started_at": started_at,
        "completed_at": None,
        "locked": 0,
        "sequence": "[]",
        "answers": "{}",
    }
    session = _attempt_row_to_session(
        fake_row,
        worksheet,
        sitting_count=sitting_count,
        target_slot=assign_through,
    )
    session["remaining_seconds"] = limit * 60
    session["expired"] = False
    session["preview"] = True
    session["locked"] = False
    session["completed"] = False
    started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    session["expires_at"] = (started + timedelta(minutes=limit)).isoformat()
    session.pop("sequence", None)
    session.pop("answers", None)
    return session


def get_or_start_test_session(
    student_name: str,
    worksheet_id: str,
    *,
    target_slot: int | None = None,
    resume: bool = False,
    preview: bool = False,
) -> dict:
    assert_worksheet_accessible(student_name, worksheet_id)
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")
    if not ws.get("timed"):
        raise ValueError("This test is not configured as timed.")

    sitting_count = test_sitting_count_from_data(ws)
    limit = int(ws.get("time_limit_minutes") or 0)
    if limit <= 0:
        raise ValueError("Test is missing a time limit.")

    if preview:
        return _preview_test_session(
            ws,
            worksheet_id,
            sitting_count=sitting_count,
            target_slot=target_slot,
        )

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, student, worksheet_id, started_at, completed_at, locked,
                   sequence, answers, sitting_count
            FROM test_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()

        if row and row["completed_at"]:
            raise ValueError("This test was already submitted and cannot be retaken.")

        if row:
            if int(row["locked"] or 0) == 1:
                raise ValueError(
                    "This test sitting is locked. Ask your teacher to unlock it."
                )
            if not resume:
                started_at = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    """
                    UPDATE test_attempts
                    SET started_at = ?, locked = 0, sequence = '[]', answers = '{}'
                    WHERE id = ?
                    """,
                    (started_at, row["id"]),
                )
                conn.commit()
                row = conn.execute(
                    "SELECT * FROM test_attempts WHERE id = ?",
                    (row["id"],),
                ).fetchone()
        else:
            started_at = datetime.now(timezone.utc).isoformat()
            cur = conn.execute(
                """
                INSERT INTO test_attempts (
                    student, worksheet_id, started_at, sitting_count,
                    sequence, answers, locked
                )
                VALUES (?, ?, ?, ?, '[]', '{}', 0)
                """,
                (student_name, worksheet_id, started_at, sitting_count),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM test_attempts WHERE id = ?",
                (cur.lastrowid,),
            ).fetchone()

        session = _attempt_row_to_session(
            row, ws, sitting_count=sitting_count, target_slot=target_slot
        )
        _save_attempt_state(conn, row["id"], session["sequence"], session["answers"])
        conn.commit()
        session.pop("sequence", None)
        session.pop("answers", None)
        return session
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _save_rc_test_answer(
    student_name: str,
    worksheet_id: str,
    ws: dict,
    *,
    slot: int,
    responses: dict,
) -> dict:
    sitting_count = test_sitting_count_from_data(ws)
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM test_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            raise ValueError("Start the test before answering questions.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")
        if int(row["locked"] or 0) == 1:
            raise ValueError("This test sitting is locked.")

        session = _attempt_row_to_rc_session(
            row, ws, sitting_count=sitting_count, target_slot=slot
        )
        sequence = session["sequence"]
        answers = session["answers"]

        entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        if not isinstance(entry, dict):
            raise ValueError("Passage not available yet.")

        lookup = _question_lookup(ws)
        question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
        cleaned: dict[str, str] = {}
        for qid in question_ids:
            if qid in responses:
                cleaned[qid] = str(responses.get(qid) or "").strip()
            else:
                prev = answers.get(str(slot))
                if isinstance(prev, dict) and isinstance(prev.get("responses"), dict):
                    cleaned[qid] = str(prev["responses"].get(qid) or "").strip()
                else:
                    cleaned[qid] = ""

        prev = answers.get(str(slot))
        answer_payload = _build_rc_passage_answer(entry, cleaned, lookup, prev=prev)
        if _rc_responses_complete(cleaned, question_ids):
            answers[str(slot)] = answer_payload
            next_slot = min(slot + 1, sitting_count)
        else:
            answer_payload.pop("correct", None)
            answer_payload.pop("correct_count", None)
            answer_payload.pop("questions", None)
            answer_payload.pop("question_count", None)
            answers[str(slot)] = answer_payload
            next_slot = slot

        _save_attempt_state(conn, row["id"], sequence, answers)
        conn.commit()

        row = conn.execute(
            "SELECT * FROM test_attempts WHERE id = ?",
            (row["id"],),
        ).fetchone()

        session = _attempt_row_to_rc_session(
            row,
            ws,
            sitting_count=sitting_count,
            target_slot=next_slot,
        )
        session.pop("sequence", None)
        session.pop("answers", None)
        return session
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_test_answer(
    student_name: str,
    worksheet_id: str,
    *,
    slot: int,
    given: str = "",
    responses: dict | None = None,
) -> dict:
    assert_worksheet_accessible(student_name, worksheet_id)
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")

    sitting_count = test_sitting_count_from_data(ws)
    if slot < 1 or slot > sitting_count:
        raise ValueError("Invalid question slot.")

    if _is_rc_test(ws):
        return _save_rc_test_answer(
            student_name,
            worksheet_id,
            ws,
            slot=slot,
            responses=responses or {},
        )

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM test_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            raise ValueError("Start the test before answering questions.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")
        if int(row["locked"] or 0) == 1:
            raise ValueError("This test sitting is locked.")

        session = _attempt_row_to_session(
            row, ws, sitting_count=sitting_count, target_slot=slot
        )
        sequence = session["sequence"]
        answers = session["answers"]

        entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        if not isinstance(entry, dict):
            raise ValueError("Question not available yet.")

        lookup = _question_lookup(ws)
        q = lookup.get(str(entry["question_id"]))
        if not q:
            raise ValueError("Question not found.")

        expected = str(q.get("answer") or "").strip()
        given_clean = str(given or "").strip()
        correct = given_clean == expected
        tier = int(entry.get("tier") or _question_tier(q, ws) or START_TIER)
        prev = answers.get(str(slot))
        prev_scratchpad = prev.get("scratchpad", "") if isinstance(prev, dict) else ""
        prev_work_text = prev.get("work_text", "") if isinstance(prev, dict) else ""
        prev_work_mode = prev.get("work_mode", "text") if isinstance(prev, dict) else "text"
        if prev_work_mode not in ("text", "scratchpad"):
            prev_work_mode = "text"

        answers[str(slot)] = {
            "given": given_clean,
            "correct": correct,
            "question_id": entry["question_id"],
            "tier": tier,
            "prompt": q.get("prompt") or "",
            "expected": expected,
            "choices": q.get("choices") or [],
            "area": q.get("area") or "",
            "scratchpad": prev_scratchpad,
            "work_text": prev_work_text,
            "work_mode": prev_work_mode,
        }

        _save_attempt_state(conn, row["id"], sequence, answers)
        conn.commit()

        row = conn.execute(
            "SELECT * FROM test_attempts WHERE id = ?",
            (row["id"],),
        ).fetchone()

        session = _attempt_row_to_session(
            row,
            ws,
            sitting_count=sitting_count,
            target_slot=min(slot + 1, sitting_count),
        )
        session.pop("sequence", None)
        session.pop("answers", None)
        return session
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_test_scratchpad(
    student_name: str,
    worksheet_id: str,
    *,
    slot: int,
    scratchpad: str,
    work_text: str | None = None,
    work_mode: str | None = None,
) -> dict:
    assert_worksheet_accessible(student_name, worksheet_id)
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")

    sitting_count = test_sitting_count_from_data(ws)
    if slot < 1 or slot > sitting_count:
        raise ValueError("Invalid question slot.")

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM test_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            raise ValueError("Start the test before saving scratchpad work.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")
        if int(row["locked"] or 0) == 1:
            raise ValueError("This test sitting is locked.")

        session = _attempt_row_to_session(
            row, ws, sitting_count=sitting_count, target_slot=slot
        )
        sequence = session["sequence"]
        answers = session["answers"]

        entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        if not isinstance(entry, dict):
            raise ValueError("Question not available yet.")

        prev = answers.get(str(slot))
        if not isinstance(prev, dict):
            prev = {}
        prev["scratchpad"] = str(scratchpad or "")
        if work_text is not None:
            prev["work_text"] = str(work_text or "")
        if work_mode in ("text", "scratchpad"):
            prev["work_mode"] = work_mode
        elif "work_mode" not in prev:
            prev["work_mode"] = "text"
        answers[str(slot)] = prev

        _save_attempt_state(conn, row["id"], sequence, answers)
        conn.commit()

        row = conn.execute(
            "SELECT * FROM test_attempts WHERE id = ?",
            (row["id"],),
        ).fetchone()

        session = _attempt_row_to_session(
            row,
            ws,
            sitting_count=sitting_count,
            target_slot=slot,
        )
        session.pop("sequence", None)
        session.pop("answers", None)
        return session
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def submit_test(student_name: str, worksheet_id: str) -> dict:
    assert_worksheet_accessible(student_name, worksheet_id)
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")

    sitting_count = test_sitting_count_from_data(ws)

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM test_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            raise ValueError("No test attempt found.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")
        if int(row["locked"] or 0) == 1:
            raise ValueError("This test sitting is locked.")

        session = _attempt_row_to_session(
            row, ws, sitting_count=sitting_count, target_slot=sitting_count
        )
        sequence = session["sequence"]
        answers = session["answers"]
        is_rc = _is_rc_test(ws)

        assigned = sum(1 for s in sequence if isinstance(s, dict))
        if assigned < sitting_count:
            raise ValueError(
                "Answer all passages before submitting."
                if is_rc
                else "Answer all questions before submitting."
            )

        if is_rc:
            unanswered = []
            for slot in range(1, sitting_count + 1):
                entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
                ans = answers.get(str(slot), {})
                question_ids = (
                    [str(qid) for qid in (entry.get("question_ids") or [])]
                    if isinstance(entry, dict)
                    else []
                )
                responses = ans.get("responses") if isinstance(ans, dict) else {}
                if not _rc_responses_complete(responses, question_ids):
                    unanswered.append(slot)
            if unanswered:
                raise ValueError("Answer all questions in every passage before submitting.")

            lookup = _question_lookup(ws)
            for slot in range(1, sitting_count + 1):
                entry = sequence[slot - 1]
                if not isinstance(entry, dict):
                    continue
                question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
                ans = answers.get(str(slot), {})
                responses = ans.get("responses") if isinstance(ans, dict) else {}
                if _rc_responses_complete(responses, question_ids):
                    answers[str(slot)] = _build_rc_passage_answer(
                        entry, responses, lookup, prev=ans if isinstance(ans, dict) else None
                    )
        else:
            unanswered = [
                slot
                for slot in range(1, sitting_count + 1)
                if str(slot) not in answers
                or not str(answers[str(slot)].get("given", "")).strip()
            ]
            if unanswered:
                raise ValueError("Answer all questions before submitting.")

        weighted = 0.0
        max_weighted = 0.0
        for slot in range(1, sitting_count + 1):
            entry = sequence[slot - 1]
            tier = int(entry.get("tier") or START_TIER)
            w = tier_weight(tier)
            max_weighted += w
            ans = answers.get(str(slot), {})
            if isinstance(ans, dict) and ans.get("correct"):
                weighted += w

        started = datetime.fromisoformat(str(row["started_at"]).replace("Z", "+00:00"))
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        duration = max(0, int((datetime.now(timezone.utc) - started).total_seconds()))

        completed_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            UPDATE test_attempts
            SET completed_at = ?, sequence = ?, answers = ?,
                weighted_score = ?, max_weighted_score = ?, duration_seconds = ?
            WHERE id = ?
            """,
            (
                completed_at,
                json.dumps(sequence),
                json.dumps(answers),
                weighted,
                max_weighted,
                duration,
                row["id"],
            ),
        )

        missed = []
        passage_lookup = _passage_lookup(ws)
        question_lookup = _question_lookup(ws)
        for slot in range(1, sitting_count + 1):
            ans = answers.get(str(slot), {})
            if not isinstance(ans, dict):
                continue
            if is_rc:
                passage = passage_lookup.get(str(ans.get("passage_id") or ""))
                for detail in ans.get("questions") or []:
                    if not isinstance(detail, dict) or detail.get("correct"):
                        continue
                    missed.append(
                        {
                            "slot": slot,
                            "question_id": detail.get("question_id"),
                            "prompt": detail.get("prompt") or "",
                            "given": detail.get("given") or "",
                            "expected": detail.get("expected") or "",
                            "choices": detail.get("choices") or [],
                            "area": detail.get("area") or "",
                            "tier": ans.get("tier"),
                            "passage": passage,
                            "notes": {"mode": "text", "text": "", "scratchpad": ""},
                        }
                    )
                continue
            if not ans.get("correct"):
                q_full = question_lookup.get(str(ans.get("question_id") or ""))
                passage = None
                if q_full:
                    passage_id = q_full.get("passage_id")
                    if passage_id:
                        passage = passage_lookup.get(str(passage_id))
                missed.append(
                    {
                        "slot": slot,
                        "question_id": ans.get("question_id"),
                        "prompt": ans.get("prompt") or "",
                        "given": ans.get("given") or "",
                        "expected": ans.get("expected") or "",
                        "choices": ans.get("choices") or [],
                        "area": ans.get("area") or "",
                        "tier": ans.get("tier"),
                        "passage": passage,
                        "notes": {"mode": "text", "text": "", "scratchpad": ""},
                    }
                )

        review_id = None
        if missed:
            payload = {
                "title": f"Review — {ws.get('title') or worksheet_id}",
                "subject": ws.get("subject") or "general",
                "worksheet_id": worksheet_id,
                "attempt_id": row["id"],
                "questions": missed,
            }
            cur = conn.execute(
                """
                INSERT INTO test_review_sessions (
                    attempt_id, student, worksheet_id, subject, title, payload, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    student_name,
                    worksheet_id,
                    ws.get("subject") or "general",
                    payload["title"],
                    json.dumps(payload),
                    completed_at,
                ),
            )
            review_id = cur.lastrowid

        conn.commit()
        return {
            "attempt_id": row["id"],
            "worksheet_id": worksheet_id,
            "completed_at": completed_at,
            "weighted_score": weighted,
            "max_weighted_score": max_weighted,
            "duration_seconds": duration,
            "review_id": review_id,
            "missed_count": len(missed),
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def lock_test_attempt(student_name: str, worksheet_id: str) -> None:
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        return
    conn = db.connect()
    try:
        conn.execute(
            """
            UPDATE test_attempts SET locked = 1
            WHERE student = ? AND worksheet_id = ? AND completed_at IS NULL AND locked = 0
            """,
            (student_name, worksheet_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def unlock_test_attempt(student_name: str, worksheet_id: str) -> None:
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, completed_at FROM test_attempts
            WHERE student = ? AND worksheet_id = ?
            """,
            (student_name, worksheet_id),
        ).fetchone()
        if not row:
            raise ValueError("No test attempt to unlock.")
        if row["completed_at"]:
            raise ValueError("Test already submitted — cannot unlock.")
        conn.execute(
            "DELETE FROM test_attempts WHERE id = ?",
            (row["id"],),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_test_results(student_name: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT ta.id, ta.worksheet_id, ta.completed_at, ta.analyzed_at,
                   ta.weighted_score, ta.max_weighted_score, ta.duration_seconds,
                   ta.answers, ta.sequence, ta.sitting_count,
                   w.title, w.subject, w.test_adaptive, w.time_limit_minutes,
                   w.test_sitting_count,
                   tr.id AS review_id, tr.completed_at AS review_completed_at
            FROM test_attempts ta
            JOIN worksheets w ON w.id = ta.worksheet_id
            LEFT JOIN test_review_sessions tr ON tr.attempt_id = ta.id
            WHERE ta.student = ? AND ta.completed_at IS NOT NULL
            ORDER BY ta.completed_at DESC
            """,
            (student_name,),
        ).fetchall()
        records = []
        for row in rows:
            answers = _parse_json(row["answers"], {})
            sequence = _parse_json(row["sequence"], [])
            sitting_count = int(row["sitting_count"] or row["test_sitting_count"] or 20)
            correct_count = sum(
                1
                for a in answers.values()
                if isinstance(a, dict) and a.get("correct")
            )
            adaptive = int(row["test_adaptive"] or 0) != 0
            slots = (
                build_ordered_test_slots(
                    sequence, answers, sitting_count=sitting_count
                )
                if adaptive
                else []
            )
            records.append(
                {
                    "id": row["id"],
                    "worksheet_id": row["worksheet_id"],
                    "title": row["title"] or row["worksheet_id"],
                    "subject": row["subject"] or "general",
                    "completed_at": row["completed_at"],
                    "analyzed_at": row["analyzed_at"],
                    "weighted_score": float(row["weighted_score"] or 0),
                    "max_weighted_score": float(row["max_weighted_score"] or 0),
                    "duration_seconds": row["duration_seconds"],
                    "correct_count": correct_count,
                    "total_count": len(answers),
                    "sitting_count": sitting_count,
                    "time_limit_minutes": row["time_limit_minutes"],
                    "test_adaptive": adaptive,
                    "content_badge": "Test",
                    "review_id": row["review_id"],
                    "review_completed": bool(row["review_completed_at"]),
                    "slots": slots,
                    "answers": list(answers.values()) if answers else [],
                }
            )
        return records
    finally:
        conn.close()


def mark_test_attempt_analyzed(attempt_id: int, student_name: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, analyzed_at FROM test_attempts
            WHERE id = ? AND student = ? AND completed_at IS NOT NULL
            """,
            (attempt_id, student_name),
        ).fetchone()
        if not row:
            return None
        if row["analyzed_at"]:
            return {"id": attempt_id, "analyzed_at": row["analyzed_at"]}
        analyzed_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE test_attempts SET analyzed_at = ? WHERE id = ?",
            (analyzed_at, attempt_id),
        )
        conn.commit()
        return {"id": attempt_id, "analyzed_at": analyzed_at}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_test_review(review_id: int, student_name: str) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, attempt_id, student, worksheet_id, subject, title,
                   payload, created_at, completed_at
            FROM test_review_sessions
            WHERE id = ? AND student = ?
            """,
            (review_id, student_name),
        ).fetchone()
        if not row:
            return None
        payload = _parse_json(row["payload"], {})
        return {
            "id": row["id"],
            "attempt_id": row["attempt_id"],
            "worksheet_id": row["worksheet_id"],
            "subject": row["subject"],
            "title": row["title"] or payload.get("title") or "",
            "created_at": row["created_at"],
            "completed_at": row["completed_at"],
            "questions": payload.get("questions") or [],
            "done": bool(row["completed_at"]),
        }
    finally:
        conn.close()


def save_test_review_notes(
    review_id: int,
    student_name: str,
    *,
    questions: list[dict],
) -> dict:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, payload, completed_at FROM test_review_sessions
            WHERE id = ? AND student = ?
            """,
            (review_id, student_name),
        ).fetchone()
        if not row:
            raise ValueError("Review session not found.")
        if row["completed_at"]:
            raise ValueError("Review session already completed.")

        payload = _parse_json(row["payload"], {})
        existing = {
            str(q.get("question_id")): q
            for q in (payload.get("questions") or [])
            if q.get("question_id")
        }
        for item in questions or []:
            if not isinstance(item, dict):
                continue
            qid = str(item.get("question_id") or "")
            if qid not in existing:
                continue
            notes = item.get("notes")
            if isinstance(notes, dict):
                existing[qid]["notes"] = {
                    "mode": notes.get("mode") if notes.get("mode") in ("text", "scratchpad") else "text",
                    "text": str(notes.get("text") or ""),
                    "scratchpad": str(notes.get("scratchpad") or ""),
                }
        payload["questions"] = list(existing.values())
        conn.execute(
            "UPDATE test_review_sessions SET payload = ? WHERE id = ?",
            (json.dumps(payload), review_id),
        )
        conn.commit()
        return get_test_review(review_id, student_name) or {}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def complete_test_review(review_id: int, student_name: str) -> dict:
    completed_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM test_review_sessions
            WHERE id = ? AND student = ?
            """,
            (review_id, student_name),
        ).fetchone()
        if not row:
            raise ValueError("Review session not found.")
        conn.execute(
            """
            UPDATE test_review_sessions SET completed_at = ? WHERE id = ?
            """,
            (completed_at, review_id),
        )
        conn.commit()
        return get_test_review(review_id, student_name) or {"done": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_test_reviews(student_name: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, title, subject, worksheet_id, created_at, completed_at, payload
            FROM test_review_sessions
            WHERE student = ?
            ORDER BY created_at DESC
            """,
            (student_name,),
        ).fetchall()
        out = []
        for row in rows:
            payload = _parse_json(row["payload"], {})
            missed = payload.get("questions") or []
            out.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "subject": row["subject"],
                    "worksheet_id": row["worksheet_id"],
                    "created_at": row["created_at"],
                    "completed_at": row["completed_at"],
                    "done": bool(row["completed_at"]),
                    "missed_count": len(missed),
                    "content_badge": "Test Review",
                }
            )
        return out
    finally:
        conn.close()
