#!/usr/bin/env python3
"""Simulate RC adaptive v2 passage tier movement (local QA).

Usage:
  cd backend && .venv/bin/python scripts/simulate_rc_tier_movement.py
  cd backend && .venv/bin/python scripts/simulate_rc_tier_movement.py --worksheet questions_rc_local_v2_tier_4s
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests import (  # noqa: E402
    RC_PASSAGE_COMPLEX,
    RC_PASSAGE_EASY,
    _adaptation_tier_after_answer,
    _assign_through_slot_rc_v2,
    _build_rc_passage_answer,
    _question_lookup,
    _uses_rc_adaptive_v2,
    get_worksheet,
    test_sitting_count_from_data,
)

CORRECT = "It matches a detail stated in the passage"
WRONG = "Unrelated detail from another topic"
TIER_LABEL = {RC_PASSAGE_EASY: "easy", RC_PASSAGE_COMPLEX: "complex"}


def _load_worksheet(worksheet_id: str) -> dict:
    ws = get_worksheet(worksheet_id)
    if not ws:
        path = Path(__file__).resolve().parents[1] / "data" / "worksheets" / f"{worksheet_id}.json"
        if path.exists():
            ws = json.loads(path.read_text())
        else:
            raise SystemExit(f"Worksheet not found: {worksheet_id}")
    if not _uses_rc_adaptive_v2(ws):
        raise SystemExit(f"{worksheet_id} is not an adaptive RC v2 test.")
    return ws


def _responses_for_pattern(
    lookup: dict[str, dict], question_ids: list[str], pattern: str
) -> dict[str, str]:
    """pattern: all_correct | mostly_wrong | half_correct (alternate wrong)."""
    out: dict[str, str] = {}
    for i, qid in enumerate(question_ids):
        q = lookup[qid]
        expected = str(q.get("answer") or "").strip()
        if pattern == "all_correct":
            out[qid] = expected
        elif pattern == "mostly_wrong":
            out[qid] = WRONG
        elif pattern == "half_correct":
            out[qid] = expected if i % 2 == 0 else WRONG
        else:
            raise ValueError(f"Unknown pattern: {pattern}")
    return out


def run_scenario(
    ws: dict,
    *,
    name: str,
    patterns: list[str],
    seed: int = 42,
) -> None:
    sitting_count = test_sitting_count_from_data(ws)
    lookup = _question_lookup(ws)
    sequence: list[dict | None] = [None] * sitting_count
    answers: dict = {}
    rng = random.Random(seed)

    print(f"\n=== {name} (seed={seed}) ===")
    for slot in range(1, sitting_count + 1):
        sequence = _assign_through_slot_rc_v2(
            sequence, answers, ws, sitting_count, slot, rng, adaptive=True
        )
        entry = sequence[slot - 1]
        assert isinstance(entry, dict)
        tier = int(entry["tier"])
        qids = [str(q) for q in entry["question_ids"]]
        print(
            f"  Sitting {slot}: {TIER_LABEL.get(tier, tier)} passage "
            f"({entry['passage_id']}), questions={len(qids)}"
        )

        if slot > len(patterns):
            break

        pattern = patterns[slot - 1]
        responses = _responses_for_pattern(lookup, qids, pattern)
        answer = _build_rc_passage_answer(entry, responses, lookup, ws)
        answers[str(slot)] = answer
        next_tier = _adaptation_tier_after_answer(answer, ws, tier)
        print(
            f"    answers: {pattern} → weighted {answer['weighted_pct']:.0%} "
            f"→ next tier {TIER_LABEL.get(next_tier, next_tier)}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate RC v2 tier movement")
    parser.add_argument(
        "--worksheet",
        default="questions_rc_local_v2_tier_4s",
        help="Worksheet id (default: 4-sitting tier demo)",
    )
    args = parser.parse_args()
    ws = _load_worksheet(args.worksheet)

    print(f"Worksheet: {ws.get('title')} ({args.worksheet})")
    print(f"Sittings: {test_sitting_count_from_data(ws)}")
    print("Thresholds: ≥80% on easy → complex; <70% on complex → easy; else stay")

    run_scenario(
        ws,
        name="Promote then demote then promote",
        patterns=["all_correct", "mostly_wrong", "all_correct", "half_correct"],
        seed=7,
    )
    run_scenario(
        ws,
        name="Stay on easy (weak sitting 1)",
        patterns=["half_correct", "all_correct"],
        seed=7,
    )
    run_scenario(
        ws,
        name="Promote on sitting 1 only (2-sitting test)",
        patterns=["all_correct"],
        seed=42,
    )


if __name__ == "__main__":
    main()
