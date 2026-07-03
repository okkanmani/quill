#!/usr/bin/env python3
"""
Tag math worksheet questions with an ``area`` slug (algebra, numbers, geometry, …).

Usage:
  cd backend && python scripts/tag_math_question_areas.py
  cd backend && python scripts/tag_math_question_areas.py --dry-run

Re-import worksheets after tagging:
  python seed_worksheets.py --merge
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
WORKSHEETS_DIR = BACKEND / "data" / "worksheets"

LEARN_SECTION_AREA: dict[str, str] = {
    "algebra-equations": "algebra",
    "algebra-patterns": "algebra",
    "ncert-ch11-algebra": "algebra",
    "geometry-shapes": "geometry",
    "geometry-measurement": "geometry",
    "ncert-ch04-basic-geometrical-ideas": "geometry",
    "ncert-ch05-understanding-elementary-shapes": "geometry",
    "ncert-ch10-mensuration": "geometry",
    "ncert-ch13-symmetry": "geometry",
    "ncert-ch14-practical-geometry": "geometry",
    "number-place-value": "numbers",
    "number-operations": "numbers",
    "number-fractions": "numbers",
    "number-decimals": "numbers",
    "ncert-ch01-knowing-our-numbers": "numbers",
    "ncert-ch02-whole-numbers": "numbers",
    "ncert-ch03-playing-with-numbers": "numbers",
    "ncert-ch06-integers": "numbers",
    "ncert-ch07-fractions": "numbers",
    "ncert-ch08-decimals": "numbers",
    "ncert-ch12-ratio-and-proportion": "numbers",
    "data-graphs": "data",
    "data-probability": "probability",
    "ncert-ch09-data-handling": "data",
    "money-basics": "financial-literacy",
}

TITLE_KEYWORDS: list[tuple[str, str]] = [
    ("algebra", "algebra"),
    ("geometry", "geometry"),
    ("graph", "data"),
    ("data", "data"),
    ("probability", "probability"),
    ("fraction", "numbers"),
    ("decimal", "numbers"),
    ("number", "numbers"),
    ("pattern", "patterns"),
    ("thinking quest", "patterns"),
    ("contest", "numbers"),
    ("timed test", "mixed"),
    ("overall", "mixed"),
]

PROMPT_RULES: list[tuple[str, list[str]]] = [
    ("algebra", ["algebra", "variable", "expression", "solve for", "simplify", "evaluate 2a", "3n", "matchstick", "equation"]),
    ("3d-geometry", ["volume", "cube", "prism", "cylinder", "3-d", "3d", "net of"]),
    ("geometry", ["triangle", "angle", "perimeter", "area of", "parallel", "symmetry", "shape", "degree", "°", "radius", "diameter", "circumference"]),
    ("numbers", ["fraction", "decimal", "÷", "×", "+", "−", "-", "round", "place value", "percent", "%", "ratio", "proportion", "integer", "whole number", "lcm", "hcf", "factor", "multiple", "divide", "multiply", "add", "subtract", "what is "]),
    ("data", ["graph", "chart", "mean", "median", "mode", "data", "table shows", "plot"]),
    ("probability", ["probability", "likely", "chance", "outcome"]),
    ("financial-literacy", ["cost", "price", "$", "budget", "tax", "tip", "money", "cent"]),
    ("patterns", ["pattern", "next number", "next term", "sequence", "rule you used"]),
]


def worksheet_default_area(data: dict) -> str | None:
    learn = data.get("learn_section")
    if isinstance(learn, str) and learn.strip():
        mapped = LEARN_SECTION_AREA.get(learn.strip().lower())
        if mapped:
            return mapped
    if data.get("gifted_track"):
        return "patterns"
    title = (data.get("title") or "").lower()
    for needle, area in TITLE_KEYWORDS:
        if needle in title:
            return area
    return None


def infer_area_from_prompt(prompt: str) -> str | None:
    text = (prompt or "").lower()
    for area, keywords in PROMPT_RULES:
        if any(k in text for k in keywords):
            return area
    return None


def infer_question_area(data: dict, question: dict) -> str | None:
    existing = question.get("area")
    if isinstance(existing, str) and existing.strip():
        return existing.strip().lower()

    default = worksheet_default_area(data)
    if default and default != "mixed":
        return default

    prompt_area = infer_area_from_prompt(question.get("prompt", ""))
    if prompt_area:
        return prompt_area

    if default == "mixed":
        return infer_area_from_prompt(question.get("prompt", "")) or "numbers"

    return None


def tag_file(path: Path, *, dry_run: bool) -> tuple[int, int]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    if (data.get("subject") or "").strip().lower() != "math":
        return 0, 0

    questions = data.get("questions") or []
    tagged = 0
    for q in questions:
        if not isinstance(q, dict):
            continue
        area = infer_question_area(data, q)
        if not area:
            continue
        if q.get("area") != area:
            q["area"] = area
            tagged += 1

    if tagged and not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return tagged, len(questions)


def main() -> int:
    parser = argparse.ArgumentParser(description="Tag math worksheet questions with area.")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing.")
    args = parser.parse_args()

    total_tagged = 0
    total_questions = 0
    files_changed = 0

    for path in sorted(WORKSHEETS_DIR.glob("questions_*.json")):
        tagged, count = tag_file(path, dry_run=args.dry_run)
        if tagged:
            files_changed += 1
            print(f"{path.name}: tagged {tagged}/{count} questions")
        total_tagged += tagged
        if count:
            total_questions += count

    mode = "would tag" if args.dry_run else "tagged"
    print(f"\n{mode} {total_tagged} questions across {files_changed} math worksheets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
