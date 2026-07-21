"""Tier-weighted rules for when a discussed focus area re-enters needs reinforcing."""

from __future__ import annotations

REINFORCEMENT_CUTOFF = 0.75

TIER_WEIGHTS = {1: 1.0, 2: 1.5, 3: 2.0}


def question_tier(question: dict) -> int:
    for key in ("stars", "tier", "difficulty_level"):
        value = question.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)) and int(value) in TIER_WEIGHTS:
            return int(value)
    return 2


def tier_weight(tier: int) -> float:
    return TIER_WEIGHTS.get(int(tier), 1.0)


def weighted_score_totals(questions: list[dict]) -> tuple[float, float]:
    earned = 0.0
    maximum = 0.0
    for question in questions:
        if not isinstance(question, dict):
            continue
        weight = tier_weight(question_tier(question))
        maximum += weight
        if question.get("correct") is True:
            earned += weight
    return earned, maximum


def should_trigger_reinforcement(
    questions: list[dict],
    *,
    cutoff: float = REINFORCEMENT_CUTOFF,
) -> bool:
    """
    Return True when a completed attempt should move a discussed area back to
    needs reinforcing.

    Rules (in order):
    1. No wrong answers → stay discussed
    2. Any easy (tier 1) wrong → reinforce
    3. Only hard (tier 3) wrongs → stay discussed
    4. Otherwise reinforce when weighted score is below cutoff
    """
    if not questions:
        return False

    wrong = [q for q in questions if isinstance(q, dict) and q.get("correct") is False]
    if not wrong:
        return False

    if any(question_tier(q) == 1 for q in wrong):
        return True

    if all(question_tier(q) == 3 for q in wrong):
        return False

    earned, maximum = weighted_score_totals(questions)
    if maximum <= 0:
        return False
    return (earned / maximum) < cutoff
