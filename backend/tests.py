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
RC_PASSAGE_EASY = 1
RC_PASSAGE_COMPLEX = 2
RC_PASSAGE_TIERS = (RC_PASSAGE_EASY, RC_PASSAGE_COMPLEX)
RC_START_PASSAGE_TIER = RC_PASSAGE_EASY
RC_PROMOTE_WEIGHTED_PCT = 0.80
RC_DEMOTE_WEIGHTED_PCT = 0.70
RC_QUESTIONS_BANK_MULTIPLIER = 2


def fetch_test_attempt(
    conn,
    student_name: str,
    worksheet_id: str,
    *,
    composite_attempt_id: int | None = None,
):
    """Return the standalone or composite-section attempt row for this context."""
    if composite_attempt_id is not None:
        return conn.execute(
            """
            SELECT * FROM test_attempts
            WHERE student = ? AND worksheet_id = ? AND composite_attempt_id = ?
            """,
            (student_name, worksheet_id, composite_attempt_id),
        ).fetchone()
    return conn.execute(
        """
        SELECT * FROM test_attempts
        WHERE student = ? AND worksheet_id = ? AND composite_attempt_id IS NULL
        """,
        (student_name, worksheet_id),
    ).fetchone()


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


def test_rc_questions_bank_size_from_data(data: dict) -> int:
    per_passage = test_rc_questions_per_passage_from_data(data)
    if _is_rc_test(data) and test_adaptive_from_data(data):
        return per_passage * RC_QUESTIONS_BANK_MULTIPLIER
    return per_passage


def _uses_rc_adaptive_v2(data: dict) -> bool:
    return _is_rc_test(data) and test_adaptive_from_data(data)


def _normalize_rc_passage_tier(raw) -> int | None:
    tier = _normalize_passage_tier(raw)
    if tier in RC_PASSAGE_TIERS:
        return tier
    return None


def _question_stars(q: dict) -> int | None:
    for key in ("stars", "tier"):
        raw = q.get(key)
        if isinstance(raw, (int, float)) and int(raw) in VALID_TIERS:
            return int(raw)
    return None


def _rc_question_allowed_on_passage(passage_tier: int, question_tier: int) -> bool:
    if passage_tier == RC_PASSAGE_EASY:
        return question_tier in (1, 2)
    if passage_tier == RC_PASSAGE_COMPLEX:
        return question_tier in (2, 3)
    return False


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

    is_passage_window = _is_passage_window_test(data)
    is_data = _is_data_passage_test(data)

    if is_passage_window:
        per_passage = test_rc_questions_per_passage_from_data(data)
        unit_label = "data set" if is_data else "passage"
        passages = data.get("passages") or []
        is_rc = _is_rc_test(data)
        bank_size = test_rc_questions_bank_size_from_data(data) if is_rc else per_passage
        if not isinstance(passages, list) or not passages:
            errors.append(
                f"Data analysis tests require at least one data set."
                if is_data
                else "Reading comprehension tests require at least one passage."
            )
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
                if is_rc:
                    tier = _normalize_rc_passage_tier(passage.get("tier"))
                    if tier is None:
                        tier = _normalize_rc_passage_tier(passage.get("stars"))
                    if tier is None:
                        errors.append(
                            f"passages[{i}] must be easy (tier 1) or complex (tier 2)."
                        )
                    else:
                        passage_tier_counts[tier] += 1
                else:
                    tier = _normalize_passage_tier(passage.get("tier"))
                    if tier is None:
                        tier = _normalize_passage_tier(passage.get("stars"))
                    if tier is None:
                        errors.append(f"passages[{i}] must have tier 1, 2, or 3.")
                    else:
                        passage_tier_counts[tier] += 1
                if is_data and not _data_passage_has_visual(passage):
                    errors.append(
                        f"passages[{i}] must include a chart or table with numeric data."
                    )
                elif not is_data and not _passage_has_content(passage):
                    errors.append(f"passages[{i}] needs passage text.")
            for i, q in enumerate(questions):
                if not isinstance(q, dict):
                    continue
                passage_id = str(q.get("passage_id") or "").strip()
                if not passage_id or passage_id not in passage_ids:
                    errors.append(
                        f"questions[{i}] must reference a {unit_label} for "
                        f"{'data analysis' if is_data else 'reading comprehension'}."
                    )
                else:
                    q_counts[passage_id] = q_counts.get(passage_id, 0) + 1
                if is_rc:
                    q_tier = _question_stars(q)
                    if q_tier is None:
                        errors.append(f"questions[{i}] must have stars 1, 2, or 3.")
                    else:
                        passage = next(
                            (
                                p
                                for p in passages
                                if isinstance(p, dict)
                                and str(p.get("id") or "").strip() == passage_id
                            ),
                            None,
                        )
                        if passage:
                            p_tier = _normalize_rc_passage_tier(
                                passage.get("tier") or passage.get("stars")
                            )
                            if p_tier is not None and not _rc_question_allowed_on_passage(
                                p_tier, q_tier
                            ):
                                label = "easy" if p_tier == RC_PASSAGE_EASY else "complex"
                                errors.append(
                                    f"questions[{i}] tier {q_tier} is not allowed on "
                                    f"{label} passage (passages[{i}])."
                                )
            for i, passage in enumerate(passages):
                pid = str(passage.get("id") or "").strip()
                if not pid:
                    continue
                count = q_counts.get(pid, 0)
                if count != bank_size:
                    errors.append(
                        f"passages[{i}] needs exactly {bank_size} questions (has {count})."
                    )
            if adaptive:
                if is_rc:
                    for tier in RC_PASSAGE_TIERS:
                        if passage_tier_counts[tier] < sitting:
                            label = "easy" if tier == RC_PASSAGE_EASY else "complex"
                            errors.append(
                                f"Test bank needs at least {sitting} {label} {unit_label}s "
                                f"(has {passage_tier_counts[tier]})."
                            )
                else:
                    for tier in VALID_TIERS:
                        if passage_tier_counts[tier] < sitting:
                            errors.append(
                                f"Test bank needs at least {sitting} tier-{tier} {unit_label}s "
                                f"(has {passage_tier_counts[tier]})."
                            )
            elif len(passages) < sitting:
                errors.append(
                    f"Test bank needs at least {sitting} {unit_label}s "
                    f"(has {len(passages)})."
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


def _is_data_passage_test(data: dict) -> bool:
    if _normalize_subject(data.get("subject") or "") != "data":
        return False
    passages = data.get("passages") or []
    return isinstance(passages, list) and bool(passages)


def _is_passage_window_test(data: dict) -> bool:
    return _is_rc_test(data) or _is_data_passage_test(data)


def _passage_has_content(passage: dict) -> bool:
    body = passage.get("text") or passage.get("body") or ""
    has_body = isinstance(body, str) and bool(body.strip())
    chart = passage.get("chart")
    has_chart = isinstance(chart, dict) and bool(chart.get("type"))
    table = passage.get("table")
    has_table = isinstance(table, dict) and bool(table.get("headers"))
    return has_body or has_chart or has_table


def _data_passage_has_visual(passage: dict) -> bool:
    chart = passage.get("chart")
    has_chart = isinstance(chart, dict) and bool(chart.get("type"))
    table = passage.get("table")
    has_table = isinstance(table, dict) and bool(table.get("headers"))
    return has_chart or has_table


def _passage_tier_lookup(worksheet: dict) -> dict[str, int]:
    out: dict[str, int] = {}
    rc = _is_rc_test(worksheet)
    for passage in worksheet.get("passages") or []:
        if not isinstance(passage, dict):
            continue
        pid = str(passage.get("id") or "").strip()
        if not pid:
            continue
        tier = passage.get("tier")
        if tier is None:
            tier = passage.get("stars")
        if rc:
            normalized = _normalize_rc_passage_tier(tier)
            if normalized is not None:
                out[pid] = normalized
        elif isinstance(tier, (int, float)) and int(tier) in VALID_TIERS:
            out[pid] = int(tier)
    return out


def _question_tier(q: dict, worksheet: dict) -> int:
    if _is_data_passage_test(worksheet):
        passage_id = q.get("passage_id")
        if passage_id:
            tier = _passage_tier_lookup(worksheet).get(str(passage_id))
            if tier is not None:
                return tier
    q_tier = _question_stars(q)
    if q_tier is not None:
        return q_tier
    return START_TIER


def _weighted_test_score(
    worksheet: dict,
    sequence: list,
    answers: dict,
    *,
    sitting_count: int,
) -> tuple[float, float]:
    """Sum tier-weighted points per question (passage-window) or per slot."""
    weighted = 0.0
    max_weighted = 0.0
    is_passage_window = _is_passage_window_test(worksheet)
    lookup = _question_lookup(worksheet)

    for slot in range(1, sitting_count + 1):
        entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        ans = answers.get(str(slot), {})
        if not isinstance(ans, dict):
            continue

        if is_passage_window:
            details = ans.get("questions") or []
            if details:
                for detail in details:
                    if not isinstance(detail, dict):
                        continue
                    tier_raw = detail.get("tier")
                    if not isinstance(tier_raw, (int, float)):
                        q = lookup.get(str(detail.get("question_id") or ""))
                        tier_raw = _question_tier(q, worksheet) if q else None
                    if not isinstance(tier_raw, (int, float)) and isinstance(entry, dict):
                        passage_id = entry.get("passage_id")
                        tier_raw = _passage_tier_lookup(worksheet).get(str(passage_id or ""))
                    tier = int(tier_raw) if isinstance(tier_raw, (int, float)) else START_TIER
                    tier = max(1, min(3, tier))
                    w = tier_weight(tier)
                    max_weighted += w
                    if detail.get("correct"):
                        weighted += w
                continue

            if not isinstance(entry, dict):
                continue
            question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
            for qid in question_ids:
                q = lookup.get(qid)
                tier = _question_tier(q, worksheet) if q else START_TIER
                w = tier_weight(tier)
                max_weighted += w
            continue

        tier_raw = ans.get("tier")
        if not isinstance(tier_raw, (int, float)) and isinstance(entry, dict):
            tier_raw = entry.get("tier")
        tier = int(tier_raw) if isinstance(tier_raw, (int, float)) else START_TIER
        tier = max(1, min(3, tier))
        w = tier_weight(tier)
        max_weighted += w
        if ans.get("correct"):
            weighted += w

    return weighted, max_weighted


def _test_correct_count(answers: dict) -> int:
    total = 0
    for answer in (answers or {}).values():
        if not isinstance(answer, dict):
            continue
        questions = answer.get("questions")
        if isinstance(questions, list) and questions:
            total += sum(
                1
                for detail in questions
                if isinstance(detail, dict) and detail.get("correct")
            )
        elif answer.get("correct"):
            total += 1
    return total


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
    if _uses_rc_adaptive_v2(worksheet) or (
        _is_rc_test(worksheet) and not test_adaptive_from_data(worksheet)
    ):
        return _passages_by_tier_rc(worksheet)
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


def _passages_by_tier_rc(worksheet: dict) -> dict[int, list[dict]]:
    per_passage = test_rc_questions_per_passage_from_data(worksheet)
    bank_size = test_rc_questions_bank_size_from_data(worksheet)
    qmap = _questions_by_passage_id(worksheet)
    pools: dict[int, list[dict]] = {RC_PASSAGE_EASY: [], RC_PASSAGE_COMPLEX: []}
    for passage in worksheet.get("passages") or []:
        if not isinstance(passage, dict):
            continue
        pid = str(passage.get("id") or "").strip()
        if not pid:
            continue
        tier = _normalize_rc_passage_tier(passage.get("tier") or passage.get("stars"))
        if tier is None:
            continue
        qs = qmap.get(pid, [])
        if len(qs) < bank_size:
            continue
        entry: dict = {"passage_id": pid, "tier": tier}
        if not _uses_rc_adaptive_v2(worksheet):
            entry["question_ids"] = [str(q["id"]) for q in qs[:per_passage]]
        pools[tier].append(entry)
    return pools


def _pick_questions_for_passage(
    passage_id: str,
    count: int,
    qmap: dict[str, list[dict]],
    used_question_ids: set[str],
    rng: random.Random,
) -> list[str]:
    candidates = [
        str(q["id"])
        for q in qmap.get(str(passage_id), [])
        if str(q.get("id")) not in used_question_ids
    ]
    if len(candidates) <= count:
        return candidates
    return [str(qid) for qid in rng.sample(candidates, count)]


def _pick_passage_rc(
    pools: dict[int, list[dict]],
    tier: int,
    used_passage_ids: set[str],
    rng: random.Random,
) -> dict | None:
    candidates = [
        p for p in pools.get(tier, []) if str(p.get("passage_id")) not in used_passage_ids
    ]
    if not candidates:
        for fallback_tier in RC_PASSAGE_TIERS:
            if fallback_tier == tier:
                continue
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


def _answer_weighted_pct(answer: dict) -> float | None:
    details = answer.get("questions") or []
    if not isinstance(details, list) or not details:
        return None
    earned = 0.0
    maximum = 0.0
    for detail in details:
        if not isinstance(detail, dict):
            continue
        tier = int(detail.get("tier") or START_TIER)
        weight = tier_weight(tier)
        maximum += weight
        if detail.get("correct"):
            earned += weight
    if maximum <= 0:
        return None
    return earned / maximum


def _next_rc_passage_tier(current: int, weighted_pct: float) -> int:
    tier = RC_PASSAGE_EASY if int(current) <= RC_PASSAGE_EASY else RC_PASSAGE_COMPLEX
    if tier == RC_PASSAGE_EASY:
        if weighted_pct >= RC_PROMOTE_WEIGHTED_PCT:
            return RC_PASSAGE_COMPLEX
        return RC_PASSAGE_EASY
    if weighted_pct < RC_DEMOTE_WEIGHTED_PCT:
        return RC_PASSAGE_EASY
    return RC_PASSAGE_COMPLEX


def _adaptation_tier_after_answer(
    answer: dict, worksheet: dict, entry_tier: int
) -> int:
    if _uses_rc_adaptive_v2(worksheet):
        weighted_pct = answer.get("weighted_pct")
        if not isinstance(weighted_pct, (int, float)):
            weighted_pct = _answer_weighted_pct(answer)
        if weighted_pct is None:
            return int(entry_tier or RC_START_PASSAGE_TIER)
        from rc_adaptive_picking import resolve_rc_v2_slot_plan

        passage_tier, _rule = resolve_rc_v2_slot_plan(
            slot=2,
            prev_answer=answer,
        )
        return passage_tier
    if "correct" in answer:
        return _next_tier(int(entry_tier or START_TIER), correct=bool(answer.get("correct")))
    return int(entry_tier or START_TIER)


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
    worksheet: dict,
    sitting_count: int,
    target_slot: int,
    rng: random.Random,
    *,
    adaptive: bool = True,
    pick_log_context: dict | None = None,
) -> list[dict | None]:
    if _uses_rc_adaptive_v2(worksheet):
        return _assign_through_slot_rc_v2(
            sequence,
            answers,
            worksheet,
            sitting_count,
            target_slot,
            rng,
            adaptive=adaptive,
            pick_log_context=pick_log_context,
        )
    return _assign_through_slot_passage_data(
        sequence,
        answers,
        _passages_by_tier(worksheet),
        sitting_count,
        target_slot,
        rng,
        adaptive=adaptive,
    )


def _assign_through_slot_rc_v2(
    sequence: list[dict | None],
    answers: dict,
    worksheet: dict,
    sitting_count: int,
    target_slot: int,
    rng: random.Random,
    *,
    adaptive: bool = True,
    pick_log_context: dict | None = None,
) -> list[dict | None]:
    from rc_adaptive_picking import (
        log_rc_adaptive_pick,
        pick_rc_questions_composed,
        resolve_rc_v2_slot_plan,
    )

    target_slot = max(1, min(target_slot, sitting_count))
    pools = _passages_by_tier_rc(worksheet)
    qmap = _questions_by_passage_id(worksheet)
    per_passage = test_rc_questions_per_passage_from_data(worksheet)
    used_passage_ids = {
        str(entry["passage_id"])
        for entry in sequence
        if isinstance(entry, dict) and entry.get("passage_id")
    }

    passage_tier, composition_rule = resolve_rc_v2_slot_plan(slot=1, prev_answer=None)

    for slot in range(1, target_slot + 1):
        idx = slot - 1
        if idx < len(sequence) and isinstance(sequence[idx], dict):
            passage_tier = int(sequence[idx].get("tier") or RC_START_PASSAGE_TIER)
            if adaptive:
                prev = answers.get(str(slot))
                if isinstance(prev, dict) and (
                    "weighted_pct" in prev or "correct" in prev or prev.get("questions")
                ):
                    passage_tier, composition_rule = resolve_rc_v2_slot_plan(
                        slot=slot + 1,
                        prev_answer=prev,
                    )
            continue

        if not adaptive:
            passage_tier = RC_PASSAGE_TIERS[(slot - 1) % len(RC_PASSAGE_TIERS)]
            composition_rule = None

        tier_to_use = passage_tier
        picked = _pick_passage_rc(pools, tier_to_use, used_passage_ids, rng)
        if not picked:
            break

        prev_weighted_pct = None
        if slot > 1:
            prev = answers.get(str(slot - 1))
            if isinstance(prev, dict):
                from rc_adaptive_picking import _weighted_pct_from_answer

                prev_weighted_pct = _weighted_pct_from_answer(prev)

        if adaptive and composition_rule:
            question_ids, pick_meta = pick_rc_questions_composed(
                picked["passage_id"],
                per_passage,
                qmap,
                lambda q: _question_tier(q, worksheet),
                passage_tier=int(picked["tier"]),
                composition_rule=composition_rule,
                rng=rng,
            )
            log_rc_adaptive_pick(
                context=pick_log_context,
                slot=slot,
                passage_id=str(picked["passage_id"]),
                prev_weighted_pct=prev_weighted_pct,
                pick_meta=pick_meta,
            )
        else:
            question_ids = _pick_questions_for_passage(
                picked["passage_id"],
                per_passage,
                qmap,
                set(),
                rng,
            )

        while len(sequence) < slot:
            sequence.append(None)
        sequence[idx] = {
            "slot": slot,
            "passage_id": picked["passage_id"],
            "tier": picked["tier"],
            "question_ids": question_ids,
        }
        if composition_rule:
            sequence[idx]["composition_rule"] = composition_rule
        used_passage_ids.add(picked["passage_id"])

        if adaptive:
            prev = answers.get(str(slot))
            if isinstance(prev, dict) and (
                "weighted_pct" in prev or "correct" in prev or prev.get("questions")
            ):
                passage_tier, composition_rule = resolve_rc_v2_slot_plan(
                    slot=slot + 1,
                    prev_answer=prev,
                )

    return sequence


def _assign_through_slot_passage_data(
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
    if _is_passage_window_test(worksheet):
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

    if _is_passage_window_test(worksheet):
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
    if _is_passage_window_test(worksheet) and _rc_slot_fully_answered(
        answers, sequence, requested
    ):
        return requested
    return min(requested, max_nav)


def _build_rc_passage_answer(
    entry: dict,
    responses: dict,
    lookup: dict[str, dict],
    worksheet: dict,
    *,
    prev: dict | None = None,
) -> dict:
    question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
    passage_id = entry.get("passage_id")
    passage_tier = _passage_tier_lookup(worksheet).get(
        str(passage_id or ""),
        int(entry.get("tier") or START_TIER),
    )
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
        q_tier = _question_tier(q, worksheet)
        question_details.append(
            {
                "question_id": qid,
                "prompt": q.get("prompt") or "",
                "given": given,
                "expected": expected,
                "correct": given == expected,
                "choices": q.get("choices") or [],
                "area": q.get("area") or "",
                "tier": q_tier,
            }
        )

    correct_count = sum(1 for item in question_details if item.get("correct"))
    weighted_earned = sum(
        tier_weight(int(item.get("tier") or START_TIER))
        for item in question_details
        if item.get("correct")
    )
    weighted_max = sum(
        tier_weight(int(item.get("tier") or START_TIER)) for item in question_details
    )
    weighted_pct = (weighted_earned / weighted_max) if weighted_max else 0.0
    passage_correct = _passage_majority_correct(responses, question_ids, lookup)
    if _uses_rc_adaptive_v2(worksheet):
        passage_correct = weighted_pct >= RC_PROMOTE_WEIGHTED_PCT
    return {
        "passage_id": passage_id,
        "tier": passage_tier,
        "responses": responses,
        "correct": passage_correct,
        "correct_count": correct_count,
        "question_count": len(question_ids),
        "weighted_pct": round(weighted_pct, 4),
        "questions": question_details,
        "scratchpad": prev_scratchpad,
        "work_text": prev_work_text,
        "work_mode": prev_work_mode,
    }


def _recalc_passage_answer_stats(ans: dict, worksheet: dict) -> dict:
    """Recompute passage-level correctness after admin overrides question marks."""
    questions = [
        q for q in (ans.get("questions") or []) if isinstance(q, dict)
    ]
    if not questions:
        return ans
    correct_count = sum(1 for q in questions if q.get("correct"))
    weighted_earned = sum(
        tier_weight(int(q.get("tier") or START_TIER))
        for q in questions
        if q.get("correct")
    )
    weighted_max = sum(
        tier_weight(int(q.get("tier") or START_TIER)) for q in questions
    )
    weighted_pct = (weighted_earned / weighted_max) if weighted_max else 0.0
    passage_correct = correct_count * 2 > len(questions)
    if _uses_rc_adaptive_v2(worksheet):
        passage_correct = weighted_pct >= RC_PROMOTE_WEIGHTED_PCT
    ans["correct_count"] = correct_count
    ans["question_count"] = len(questions)
    ans["weighted_pct"] = round(weighted_pct, 4)
    ans["correct"] = passage_correct
    return ans


def _apply_test_marks(
    answers: dict,
    mark_by_qid: dict[str, bool],
    worksheet: dict,
    *,
    sitting_count: int,
) -> dict:
    is_passage_window = _is_passage_window_test(worksheet)
    for slot in range(1, sitting_count + 1):
        key = str(slot)
        ans = answers.get(key)
        if not isinstance(ans, dict):
            continue
        if is_passage_window:
            for detail in ans.get("questions") or []:
                if not isinstance(detail, dict):
                    continue
                qid = str(detail.get("question_id") or "")
                if qid in mark_by_qid:
                    detail["correct"] = mark_by_qid[qid]
            _recalc_passage_answer_stats(ans, worksheet)
        else:
            qid = str(ans.get("question_id") or "")
            if qid in mark_by_qid:
                ans["correct"] = mark_by_qid[qid]
        answers[key] = ans
    return answers


def _build_test_review_missed(
    ws: dict,
    answers: dict,
    *,
    sitting_count: int,
) -> list[dict]:
    is_passage_window = _is_passage_window_test(ws)
    passage_lookup = _passage_lookup(ws)
    question_lookup = _question_lookup(ws)
    missed = []
    for slot in range(1, sitting_count + 1):
        ans = answers.get(str(slot), {})
        if not isinstance(ans, dict):
            continue
        if is_passage_window:
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
                        "tier": detail.get("tier") or ans.get("tier"),
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
    return missed


def _sync_test_review_payload(
    conn,
    attempt_id: int,
    ws: dict,
    answers: dict,
    *,
    sitting_count: int,
) -> None:
    review = conn.execute(
        "SELECT id, payload FROM test_review_sessions WHERE attempt_id = ?",
        (attempt_id,),
    ).fetchone()
    if not review:
        return
    old_payload = _parse_json(review["payload"], {})
    old_notes = {
        str(q.get("question_id")): q.get("notes")
        for q in (old_payload.get("questions") or [])
        if isinstance(q, dict) and q.get("question_id")
    }
    missed = _build_test_review_missed(
        ws, answers, sitting_count=sitting_count
    )
    for item in missed:
        qid = str(item.get("question_id") or "")
        if qid in old_notes and isinstance(old_notes[qid], dict):
            item["notes"] = old_notes[qid]
    new_payload = {**old_payload, "questions": missed}
    conn.execute(
        "UPDATE test_review_sessions SET payload = ? WHERE id = ?",
        (json.dumps(new_payload), review["id"]),
    )


def evaluate_test_attempt(
    attempt_id: int, student_name: str, marks: list[dict]
) -> dict:
    """Admin overrides per-question correctness on a completed test result."""
    mark_by_qid = {
        str(m["question_id"]): bool(m["correct"])
        for m in marks
        if isinstance(m, dict) and m.get("question_id")
    }
    if not mark_by_qid:
        raise ValueError("No marks provided.")

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT ta.*, w.title, w.subject, w.test_adaptive, w.time_limit_minutes,
                   w.test_sitting_count,
                   tr.id AS review_id, tr.completed_at AS review_completed_at
            FROM test_attempts ta
            JOIN worksheets w ON w.id = ta.worksheet_id
            LEFT JOIN test_review_sessions tr ON tr.attempt_id = ta.id
            WHERE ta.id = ? AND ta.student = ? AND ta.completed_at IS NOT NULL
            """,
            (attempt_id, student_name),
        ).fetchone()
        if not row:
            raise ValueError("Test result not found.")

        ws = get_worksheet(row["worksheet_id"])
        if not ws:
            raise ValueError("Test worksheet not found.")

        answers = _parse_json(row["answers"], {})
        sequence = _parse_json(row["sequence"], [])
        sitting_count = int(row["sitting_count"] or test_sitting_count_from_data(ws))
        answers = _apply_test_marks(
            answers,
            mark_by_qid,
            ws,
            sitting_count=sitting_count,
        )
        weighted, max_weighted = _weighted_test_score(
            ws, sequence, answers, sitting_count=sitting_count
        )
        conn.execute(
            """
            UPDATE test_attempts
            SET answers = ?, weighted_score = ?, max_weighted_score = ?,
                analyzed_at = NULL
            WHERE id = ?
            """,
            (json.dumps(answers), weighted, max_weighted, attempt_id),
        )
        _sync_test_review_payload(
            conn, attempt_id, ws, answers, sitting_count=sitting_count
        )

        composite_attempt_id = row["composite_attempt_id"]
        if composite_attempt_id:
            from composite_tests import recompute_composite_aggregate

            recompute_composite_aggregate(
                conn, int(composite_attempt_id), student_name
            )

        conn.commit()
        updated = conn.execute(
            f"""
            {_TEST_RESULT_SELECT}
            WHERE ta.id = ? AND ta.student = ?
            """,
            (attempt_id, student_name),
        ).fetchone()
        return build_test_result_record(updated)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _question_lookup(worksheet: dict) -> dict[str, dict]:
    return {
        str(q.get("id")): q
        for q in (worksheet.get("questions") or [])
        if q.get("id")
    }


def _enrich_test_answers_with_passages(
    answers: dict | None,
    worksheet: dict | None,
) -> list[dict]:
    """Attach passage content to stored test answers for results display."""
    if not answers:
        return []
    if not worksheet:
        return [a for a in answers.values() if isinstance(a, dict)]

    passage_lookup = _passage_lookup(worksheet)
    question_lookup = _question_lookup(worksheet)
    enriched: list[dict] = []
    for key in sorted(answers.keys(), key=lambda k: int(k) if str(k).isdigit() else k):
        ans = answers.get(key)
        if not isinstance(ans, dict):
            continue
        out = dict(ans)
        if isinstance(ans.get("responses"), dict) or isinstance(
            ans.get("questions"), list
        ):
            passage = passage_lookup.get(str(ans.get("passage_id") or ""))
            if passage:
                out["passage"] = passage
        else:
            q_full = question_lookup.get(str(ans.get("question_id") or ""))
            passage_id = q_full.get("passage_id") if q_full else None
            if passage_id:
                passage = passage_lookup.get(str(passage_id))
                if passage:
                    out["passage"] = passage
        enriched.append(out)
    return enriched


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
    question_index = 0

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

        passage_tier_raw = answer.get("tier")
        passage_tier = None
        if isinstance(passage_tier_raw, (int, float)):
            passage_tier = int(passage_tier_raw)

        if isinstance(answer.get("responses"), dict):
            for detail in answer.get("questions") or []:
                if not isinstance(detail, dict):
                    continue
                question_index += 1
                detail_tier = detail.get("tier")
                if isinstance(detail_tier, (int, float)):
                    q_tier = int(detail_tier)
                else:
                    q_tier = tier
                q_tier = max(1, min(3, q_tier))
                slots.append(
                    {
                        "slot": slot,
                        "question_index": question_index,
                        "tier": q_tier,
                        "area": str(detail.get("area") or "").strip(),
                        "correct": detail.get("correct") is True,
                        "question_id": detail.get("question_id"),
                        "prompt": detail.get("prompt") or "",
                        "given": detail.get("given") or "",
                        "expected": detail.get("expected") or "",
                        "choices": detail.get("choices") or [],
                        "passage_id": answer.get("passage_id"),
                        "passage_tier": passage_tier,
                    }
                )
            continue

        question_index += 1
        slots.append(
            {
                "slot": slot,
                "question_index": question_index,
                "tier": tier,
                "area": str(answer.get("area") or "").strip(),
                "correct": answer.get("correct") is True,
                "question_id": answer.get("question_id"),
                "prompt": answer.get("prompt") or "",
                "given": answer.get("given") or "",
                "expected": answer.get("expected") or "",
                "choices": answer.get("choices") or [],
                "passage_tier": passage_tier,
            }
        )
    return slots


def _attach_passages_to_analysis_slots(
    slots: list[dict] | None,
    worksheet: dict | None,
) -> list[dict]:
    """Embed passage/chart/table bodies on per-question analysis rows."""
    if not slots or not worksheet:
        return slots or []
    passage_lookup = _passage_lookup(worksheet)
    for slot in slots:
        if slot.get("passage"):
            continue
        passage_id = slot.get("passage_id")
        if not passage_id:
            continue
        passage = passage_lookup.get(str(passage_id))
        if passage:
            slot["passage"] = passage
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
        worksheet,
        sitting_count,
        target_slot,
        rng,
        adaptive=adaptive,
        pick_log_context={
            "attempt_id": row["id"],
            "student": row["student"],
            "worksheet_id": row["worksheet_id"],
        }
        if int(row["id"] or 0) > 0
        else None,
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
        "is_passage_window": True,
        "is_rc": _is_rc_test(worksheet),
        "test_adaptive": adaptive,
        "questions_per_passage": test_rc_questions_per_passage_from_data(worksheet),
    }


def _attempt_row_to_session(
    row,
    worksheet: dict,
    *,
    sitting_count: int,
    target_slot: int | None = None,
) -> dict:
    if _is_passage_window_test(worksheet):
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
                 AND ta.composite_attempt_id IS NULL
            LEFT JOIN test_review_sessions tr
              ON tr.attempt_id = ta.id
            WHERE COALESCE(w.is_test, 0) = 1
              AND (w.admin_id = ? OR (w.admin_id IS NULL AND ? = ?))
            ORDER BY w.sort_ts DESC, w.id DESC
            """,
            (student_name, admin_id, admin_id, default_admin_id),
        ).fetchall()

        from test_scheduling import get_scheduled_unlock_map, materialize_due_scheduled_unlocks

        materialize_due_scheduled_unlocks(conn, student_name)
        conn.commit()
        unlocked = get_gifted_track_unlocked_through_week(conn, student_name)
        overrides = get_worksheet_lock_overrides(conn, student_name)
        scheduled_unlocks = get_scheduled_unlock_map(conn, student_name)
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
            scheduled_unlocks.get(r["id"]),
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
    composite_attempt_id: int | None = None,
) -> dict:
    from composite_tests import (
        assert_worksheet_not_blocked_by_active_composite,
        validate_composite_attempt_link,
    )

    assert_worksheet_accessible(student_name, worksheet_id)
    assert_worksheet_not_blocked_by_active_composite(
        student_name, worksheet_id, composite_attempt_id=composite_attempt_id
    )
    if composite_attempt_id is not None:
        validate_composite_attempt_link(
            student_name, worksheet_id, composite_attempt_id
        )
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
    closed_early = False
    try:
        row = fetch_test_attempt(
            conn,
            student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
        )

        if row and row["completed_at"]:
            raise ValueError("This test was already submitted and cannot be retaken.")

        if row and not row["completed_at"]:
            stale = int(row["locked"] or 0) == 1 or not resume
            if stale:
                conn.close()
                closed_early = True
                conn = None
                try:
                    submit_test(
                        student_name,
                        worksheet_id,
                        composite_attempt_id=composite_attempt_id,
                        force_partial=True,
                    )
                except ValueError as exc:
                    msg = str(exc)
                    if "No test attempt" not in msg and "already submitted" not in msg.lower():
                        raise
                raise ValueError(
                    "This test was already submitted and cannot be retaken."
                )

        if row:
            linked = row["composite_attempt_id"]
            if linked is not None and composite_attempt_id is None:
                raise ValueError(
                    "Continue this subject test from the composite assessment hub."
                )
            if (
                composite_attempt_id is not None
                and linked is not None
                and int(linked) != int(composite_attempt_id)
            ):
                raise ValueError("This test belongs to a different composite sitting.")
        else:
            started_at = datetime.now(timezone.utc).isoformat()
            cur = conn.execute(
                """
                INSERT INTO test_attempts (
                    student, worksheet_id, started_at, sitting_count,
                    sequence, answers, locked, composite_attempt_id
                )
                VALUES (?, ?, ?, ?, '[]', '{}', 0, ?)
                """,
                (
                    student_name,
                    worksheet_id,
                    started_at,
                    sitting_count,
                    composite_attempt_id,
                ),
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
        if conn is not None:
            conn.rollback()
        raise
    finally:
        if conn is not None and not closed_early:
            conn.close()


def _save_rc_test_answer(
    student_name: str,
    worksheet_id: str,
    ws: dict,
    *,
    slot: int,
    responses: dict,
    composite_attempt_id: int | None = None,
) -> dict:
    sitting_count = test_sitting_count_from_data(ws)
    conn = db.connect()
    try:
        row = fetch_test_attempt(
            conn,
            student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
        )
        if not row:
            raise ValueError("Start the test before answering questions.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")

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
        answer_payload = _build_rc_passage_answer(
            entry, cleaned, lookup, ws, prev=prev
        )
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
    composite_attempt_id: int | None = None,
) -> dict:
    assert_worksheet_accessible(student_name, worksheet_id)
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")

    sitting_count = test_sitting_count_from_data(ws)
    if slot < 1 or slot > sitting_count:
        raise ValueError("Invalid question slot.")

    if _is_passage_window_test(ws):
        return _save_rc_test_answer(
            student_name,
            worksheet_id,
            ws,
            slot=slot,
            responses=responses or {},
            composite_attempt_id=composite_attempt_id,
        )

    conn = db.connect()
    try:
        row = fetch_test_attempt(
            conn,
            student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
        )
        if not row:
            raise ValueError("Start the test before answering questions.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")

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
    composite_attempt_id: int | None = None,
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
        row = fetch_test_attempt(
            conn,
            student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
        )
        if not row:
            raise ValueError("Start the test before saving scratchpad work.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")

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


def create_test_review_for_attempt(
    conn,
    attempt_id: int,
    student_name: str,
    *,
    completed_at: str | None = None,
) -> int | None:
    existing = conn.execute(
        "SELECT id FROM test_review_sessions WHERE attempt_id = ?",
        (attempt_id,),
    ).fetchone()
    if existing:
        return int(existing["id"])

    row = conn.execute(
        "SELECT * FROM test_attempts WHERE id = ? AND student = ?",
        (attempt_id, student_name),
    ).fetchone()
    if not row or not row["completed_at"]:
        return None

    worksheet_id = row["worksheet_id"]
    ws = get_worksheet(worksheet_id)
    if not ws:
        return None

    sitting_count = int(row["sitting_count"] or test_sitting_count_from_data(ws))
    sequence = _parse_json(row["sequence"], [])
    answers = _parse_json(row["answers"], {})
    is_passage_window = _is_passage_window_test(ws)
    completed_at = completed_at or row["completed_at"]

    missed = []
    passage_lookup = _passage_lookup(ws)
    question_lookup = _question_lookup(ws)
    for slot in range(1, sitting_count + 1):
        ans = answers.get(str(slot), {})
        if not isinstance(ans, dict):
            continue
        if is_passage_window:
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
                        "tier": detail.get("tier") or ans.get("tier"),
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

    if not missed:
        return None

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
    return cur.lastrowid


def _finalize_answers_for_submit(
    ws: dict,
    sequence: list,
    answers: dict,
    *,
    sitting_count: int,
    force_partial: bool,
) -> dict:
    is_passage_window = _is_passage_window_test(ws)
    is_data = _is_data_passage_test(ws)
    unit_label = "data sets" if is_data else "passages"
    lookup = _question_lookup(ws)

    if not force_partial:
        assigned = sum(1 for s in sequence if isinstance(s, dict))
        if assigned < sitting_count:
            raise ValueError(
                f"Answer all {unit_label} before submitting."
                if is_passage_window
                else "Answer all questions before submitting."
            )

        if is_passage_window:
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
                raise ValueError(
                    f"Answer all questions in every {'data set' if is_data else 'passage'} before submitting."
                )

            for slot in range(1, sitting_count + 1):
                entry = sequence[slot - 1]
                if not isinstance(entry, dict):
                    continue
                question_ids = [str(qid) for qid in (entry.get("question_ids") or [])]
                ans = answers.get(str(slot), {})
                responses = ans.get("responses") if isinstance(ans, dict) else {}
                if _rc_responses_complete(responses, question_ids):
                    answers[str(slot)] = _build_rc_passage_answer(
                        entry,
                        responses,
                        lookup,
                        ws,
                        prev=ans if isinstance(ans, dict) else None,
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
        return answers

    if is_passage_window:
        for slot in range(1, sitting_count + 1):
            entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
            if not isinstance(entry, dict):
                continue
            ans = answers.get(str(slot), {})
            responses = ans.get("responses") if isinstance(ans, dict) else {}
            if not isinstance(responses, dict):
                responses = {}
            answers[str(slot)] = _build_rc_passage_answer(
                entry,
                responses,
                lookup,
                ws,
                prev=ans if isinstance(ans, dict) else None,
            )
        return answers

    for slot in range(1, sitting_count + 1):
        entry = sequence[slot - 1] if slot - 1 < len(sequence) else None
        if not isinstance(entry, dict):
            continue
        existing = answers.get(str(slot))
        if isinstance(existing, dict) and str(existing.get("given") or "").strip():
            continue
        q = lookup.get(str(entry.get("question_id")))
        if not q:
            continue
        expected = str(q.get("answer") or "").strip()
        tier = int(entry.get("tier") or _question_tier(q, ws) or START_TIER)
        prev = existing if isinstance(existing, dict) else {}
        prev_work_mode = prev.get("work_mode", "text")
        if prev_work_mode not in ("text", "scratchpad"):
            prev_work_mode = "text"
        answers[str(slot)] = {
            "given": "",
            "correct": False,
            "question_id": entry["question_id"],
            "tier": tier,
            "prompt": q.get("prompt") or "",
            "expected": expected,
            "choices": q.get("choices") or [],
            "area": q.get("area") or "",
            "scratchpad": prev.get("scratchpad", ""),
            "work_text": prev.get("work_text", ""),
            "work_mode": prev_work_mode,
        }
    return answers


def submit_test(
    student_name: str,
    worksheet_id: str,
    *,
    composite_attempt_id: int | None = None,
    force_partial: bool = False,
) -> dict:
    assert_worksheet_accessible(student_name, worksheet_id)
    ws = get_worksheet(worksheet_id)
    if not ws or not _test_from_sheet_data(ws):
        raise ValueError("Test not found.")

    sitting_count = test_sitting_count_from_data(ws)

    conn = db.connect()
    try:
        row = fetch_test_attempt(
            conn,
            student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
        )
        if not row:
            raise ValueError("No test attempt found.")
        if row["completed_at"]:
            raise ValueError("Test already submitted.")

        session = _attempt_row_to_session(
            row, ws, sitting_count=sitting_count, target_slot=sitting_count
        )
        sequence = session["sequence"]
        answers = session["answers"]
        answers = _finalize_answers_for_submit(
            ws,
            sequence,
            answers,
            sitting_count=sitting_count,
            force_partial=force_partial,
        )

        weighted, max_weighted = _weighted_test_score(
            ws, sequence, answers, sitting_count=sitting_count
        )

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

        review_id = None
        missed_count = 0
        composite_attempt_id = row["composite_attempt_id"]
        if composite_attempt_id is None:
            review_id = create_test_review_for_attempt(
                conn, row["id"], student_name, completed_at=completed_at
            )
            if review_id:
                missed_count = len(
                    _parse_json(
                        conn.execute(
                            "SELECT payload FROM test_review_sessions WHERE id = ?",
                            (review_id,),
                        ).fetchone()["payload"],
                        {},
                    ).get("questions", [])
                )

        conn.commit()
        return {
            "attempt_id": row["id"],
            "worksheet_id": worksheet_id,
            "completed_at": completed_at,
            "weighted_score": weighted,
            "max_weighted_score": max_weighted,
            "duration_seconds": duration,
            "review_id": review_id,
            "missed_count": missed_count,
            "composite_section": composite_attempt_id is not None,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def lock_test_attempt(
    student_name: str,
    worksheet_id: str,
    *,
    composite_attempt_id: int | None = None,
) -> None:
    """Legacy abandon endpoint — auto-submit with whatever answers were saved."""
    try:
        submit_test(
            student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
            force_partial=True,
        )
    except ValueError as exc:
        msg = str(exc)
        if "No test attempt" in msg or "already submitted" in msg.lower():
            return
        raise


def unlock_test_attempt(student_name: str, worksheet_id: str) -> None:
    raise ValueError(
        "Tests cannot be reset. Leaving a test auto-submits the current sitting."
    )


def build_test_result_record(row) -> dict:
    """Build a test result payload from a joined test_attempts + worksheets row."""
    answers = _parse_json(row["answers"], {})
    sequence = _parse_json(row["sequence"], [])
    sitting_count = int(row["sitting_count"] or row["test_sitting_count"] or 20)
    worksheet = get_worksheet(row["worksheet_id"])
    enriched_answers = _enrich_test_answers_with_passages(answers, worksheet)
    correct_count = _test_correct_count(answers)
    total_count = sum(
        len(a.get("questions") or [])
        if isinstance(a, dict) and isinstance(a.get("questions"), list) and a.get("questions")
        else 1
        for a in answers.values()
        if isinstance(a, dict)
    ) or len(answers)
    adaptive = int(row["test_adaptive"] or 0) != 0
    slots = (
        build_ordered_test_slots(sequence, answers, sitting_count=sitting_count)
        if adaptive
        else []
    )
    slots = _attach_passages_to_analysis_slots(slots, worksheet)
    return {
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
        "total_count": total_count,
        "sitting_count": sitting_count,
        "time_limit_minutes": row["time_limit_minutes"],
        "test_adaptive": adaptive,
        "content_badge": "Test",
        "review_id": row["review_id"],
        "review_completed": bool(row["review_completed_at"]),
        "slots": slots,
        "answers": enriched_answers,
    }


_TEST_RESULT_SELECT = """
SELECT ta.id, ta.worksheet_id, ta.completed_at, ta.analyzed_at,
       ta.weighted_score, ta.max_weighted_score, ta.duration_seconds,
       ta.answers, ta.sequence, ta.sitting_count,
       w.title, w.subject, w.test_adaptive, w.time_limit_minutes,
       w.test_sitting_count,
       tr.id AS review_id, tr.completed_at AS review_completed_at
FROM test_attempts ta
JOIN worksheets w ON w.id = ta.worksheet_id
LEFT JOIN test_review_sessions tr ON tr.attempt_id = ta.id
"""


def list_test_results(student_name: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            f"""
            {_TEST_RESULT_SELECT}
            WHERE ta.student = ? AND ta.completed_at IS NOT NULL
              AND ta.composite_attempt_id IS NULL
            ORDER BY ta.completed_at DESC
            """,
            (student_name,),
        ).fetchall()
        return [build_test_result_record(row) for row in rows]
    finally:
        conn.close()


def get_test_result(student_name: str, attempt_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            f"""
            {_TEST_RESULT_SELECT}
            WHERE ta.id = ? AND ta.student = ? AND ta.completed_at IS NOT NULL
            """,
            (attempt_id, student_name),
        ).fetchone()
        if not row:
            return None
        return build_test_result_record(row)
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


def delete_test_attempt(attempt_id: int, student_name: str) -> bool:
    """Delete a completed standalone test result (not a composite section)."""
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM test_attempts
            WHERE id = ? AND student = ? AND completed_at IS NOT NULL
              AND composite_attempt_id IS NULL
            """,
            (attempt_id, student_name),
        ).fetchone()
        if not row:
            return False
        conn.execute("DELETE FROM test_attempts WHERE id = ?", (attempt_id,))
        conn.commit()
        return True
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
