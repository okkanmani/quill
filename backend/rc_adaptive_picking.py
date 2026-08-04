"""RC adaptive v2: stratified question composition and local pick logging."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

RC_PASSAGE_EASY = 1
RC_PASSAGE_COMPLEX = 2
RC_START_PASSAGE_TIER = RC_PASSAGE_EASY

TIER_WEIGHTS = {1: 1.0, 2: 1.5, 3: 2.0}
VALID_TIERS = (1, 2, 3)

RULE_START_EASY_HEAVY_T2 = "start_easy_heavy_t2"
RULE_EASY_T1_ONLY = "easy_t1_only"
RULE_EASY_T2_ONLY = "easy_t2_only"
RULE_COMPLEX_T2_T3_MIX = "complex_t2_t3_mix"
RULE_COMPLEX_T3_ONLY = "complex_t3_only"

RC_START_T2_FRACTION = 0.75

_LOG_DIR = Path(__file__).resolve().parent / "logs"
_LOG_FILE = _LOG_DIR / "rc_adaptive_picks.jsonl"


def _question_stars(q: dict) -> int | None:
    for key in ("stars", "tier"):
        raw = q.get(key)
        if isinstance(raw, (int, float)) and int(raw) in VALID_TIERS:
            return int(raw)
    return None


def _weighted_pct_from_answer(prev_answer: dict) -> float:
    weighted_pct = prev_answer.get("weighted_pct")
    if isinstance(weighted_pct, (int, float)):
        return float(weighted_pct)
    earned = 0.0
    maximum = 0.0
    for detail in prev_answer.get("questions") or []:
        if not isinstance(detail, dict):
            continue
        tier = int(detail.get("tier") or 2)
        w = TIER_WEIGHTS.get(tier, 1.0)
        maximum += w
        if detail.get("correct"):
            earned += w
    return (earned / maximum) if maximum else 0.0


def resolve_rc_v2_slot_plan(
    *,
    slot: int,
    prev_answer: dict | None,
) -> tuple[int, str]:
    """Return (passage_tier, composition_rule) for the given slot."""
    if slot <= 1 or not prev_answer:
        return RC_START_PASSAGE_TIER, RULE_START_EASY_HEAVY_T2

    pct = _weighted_pct_from_answer(prev_answer)
    if pct < 0.50:
        return RC_PASSAGE_EASY, RULE_EASY_T1_ONLY
    if pct <= 0.70:
        return RC_PASSAGE_EASY, RULE_EASY_T2_ONLY
    if pct <= 0.85:
        return RC_PASSAGE_COMPLEX, RULE_COMPLEX_T2_T3_MIX
    return RC_PASSAGE_COMPLEX, RULE_COMPLEX_T3_ONLY


def _target_tier_counts(count: int, rule: str) -> dict[int, int]:
    count = max(1, int(count))
    if rule == RULE_START_EASY_HEAVY_T2:
        tier2 = int(count * RC_START_T2_FRACTION + 0.9999)
        tier2 = min(count, max(0, tier2))
        return {1: count - tier2, 2: tier2}
    if rule == RULE_EASY_T1_ONLY:
        return {1: count}
    if rule == RULE_EASY_T2_ONLY:
        return {2: count}
    if rule == RULE_COMPLEX_T2_T3_MIX:
        tier3 = count // 2
        return {2: count - tier3, 3: tier3}
    if rule == RULE_COMPLEX_T3_ONLY:
        return {3: count}
    return {2: count}


def _allowed_fallback_tiers(passage_tier: int, rule: str) -> list[int]:
    if passage_tier == RC_PASSAGE_EASY:
        if rule == RULE_EASY_T1_ONLY:
            return [1, 2]
        if rule == RULE_EASY_T2_ONLY:
            return [2, 1]
        return [2, 1]
    if rule == RULE_COMPLEX_T3_ONLY:
        return [3, 2]
    return [2, 3]


def _questions_by_tier_for_passage(
    passage_id: str,
    qmap: dict[str, list[dict]],
    question_tier: Callable[[dict], int],
) -> dict[int, list[dict]]:
    grouped: dict[int, list[dict]] = {1: [], 2: [], 3: []}
    for q in qmap.get(str(passage_id), []):
        if not isinstance(q, dict):
            continue
        tier = _question_stars(q)
        if tier is None:
            tier = question_tier(q)
        if tier in grouped:
            grouped[int(tier)].append(q)
    return grouped


def _sample_from_pool(
    pool: list[dict],
    take: int,
    rng,
    used_question_ids: set[str],
) -> list[str]:
    available = [
        q
        for q in pool
        if str(q.get("id") or "") and str(q.get("id")) not in used_question_ids
    ]
    if take <= 0 or not available:
        return []
    if len(available) <= take:
        return [str(q["id"]) for q in available]
    ids = [str(q["id"]) for q in available]
    return [str(qid) for qid in rng.sample(ids, take)]


def pick_rc_questions_composed(
    passage_id: str,
    count: int,
    qmap: dict[str, list[dict]],
    question_tier: Callable[[dict], int],
    *,
    passage_tier: int,
    composition_rule: str,
    rng,
    used_question_ids: set[str] | None = None,
) -> tuple[list[str], dict[str, Any]]:
    """Pick questions using tier composition; fallback to other allowed tiers if uneven bank."""
    used = used_question_ids or set()
    by_tier = _questions_by_tier_for_passage(passage_id, qmap, question_tier)
    targets = _target_tier_counts(count, composition_rule)
    picked_ids: list[str] = []
    picked_set: set[str] = set()
    tier_shortfalls: dict[str, int] = {}

    for tier, need in sorted(targets.items()):
        tier_ids = _sample_from_pool(by_tier.get(tier, []), need, rng, used | picked_set)
        picked_ids.extend(tier_ids)
        picked_set.update(tier_ids)
        shortfall = need - len(tier_ids)
        if shortfall > 0:
            tier_shortfalls[str(tier)] = shortfall

    fallback_used = bool(tier_shortfalls)
    if len(picked_ids) < count:
        for tier in _allowed_fallback_tiers(passage_tier, composition_rule):
            if len(picked_ids) >= count:
                break
            need = count - len(picked_ids)
            extra = _sample_from_pool(by_tier.get(tier, []), need, rng, used | picked_set)
            for qid in extra:
                if qid not in picked_set:
                    picked_ids.append(qid)
                    picked_set.add(qid)
                    fallback_used = True

    if len(picked_ids) > 1:
        rng.shuffle(picked_ids)

    id_to_q: dict[str, dict] = {}
    for q in qmap.get(str(passage_id), []):
        if isinstance(q, dict) and q.get("id"):
            id_to_q[str(q["id"])] = q
    actual_tier_counts: dict[str, int] = {"1": 0, "2": 0, "3": 0}
    for qid in picked_ids:
        q = id_to_q.get(str(qid))
        if not q:
            continue
        tier = _question_stars(q) or question_tier(q)
        if tier in (1, 2, 3):
            actual_tier_counts[str(int(tier))] += 1

    meta = {
        "composition_rule": composition_rule,
        "passage_tier": passage_tier,
        "requested_tier_counts": {str(k): v for k, v in targets.items()},
        "actual_tier_counts": actual_tier_counts,
        "tier_shortfalls": tier_shortfalls,
        "fallback_used": fallback_used,
        "question_count": len(picked_ids),
        "target_count": count,
    }
    return picked_ids[:count], meta


def log_rc_adaptive_pick(
    *,
    context: dict[str, Any] | None,
    slot: int,
    passage_id: str,
    prev_weighted_pct: float | None,
    pick_meta: dict[str, Any],
) -> None:
    """Append one pick event to backend/logs/rc_adaptive_picks.jsonl (gitignored)."""
    if not context or not context.get("attempt_id"):
        return
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "attempt_id": context.get("attempt_id"),
            "student": context.get("student"),
            "worksheet_id": context.get("worksheet_id"),
            "slot": slot,
            "passage_id": passage_id,
            "prev_weighted_pct": prev_weighted_pct,
            **pick_meta,
        }
        with _LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError:
        pass
