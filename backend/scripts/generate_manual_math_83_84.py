#!/usr/bin/env python3
"""Generate manual-eval algebra & geometry worksheets 83–84."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worksheets import validate_worksheet_data

OUT = Path(__file__).resolve().parents[1] / "data" / "worksheets"
STARS = 2


def sa(qid, prompt, answer):
    return {
        "id": qid,
        "type": "short_answer",
        "stars": STARS,
        "prompt": prompt,
        "answer": answer,
        "hint": False,
    }


ALGEBRA = [
    sa("q1", "Solve for n: n + 6 = 14", "8"),
    sa("q2", "Solve for y: y − 4 = 11", "15"),
    sa("q3", "Solve for p: 3p = 24", "8"),
    sa("q4", "Solve for m: m + 9 = 20", "11"),
    sa("q5", "Solve for x: x − 7 = 5", "12"),
    sa("q6", "Solve for n: 5n = 45", "9"),
    sa("q7", "Each L-shape uses 2 matchsticks. How many matchsticks for 6 L-shapes?", "12"),
    sa("q8", "Write an expression for “5 more than a number t”.", "t + 5"),
    sa("q9", "If 2n + 1 = 13, what is n?", "6"),
    sa("q10", "A number plus 10 equals 25. What is the number?", "15"),
    sa("q11", "Solve for k: k + 18 = 30", "12"),
    sa("q12", "Solve for m: 4m = 36", "9"),
    sa("q13", "Solve for w: w − 9 = 16", "25"),
    sa("q14", "If 3x = 21, what is x?", "7"),
    sa("q15", "Ravi had x rupees, spent ₹20, and has ₹35 left. What is x?", "55"),
    sa("q16", "Solve for n: n + 13 = 13", "0"),
    sa("q17", "7 more than y is 19. What is y?", "12"),
    sa("q18", "Solve for n: 2n = 18", "9"),
    sa("q19", "Solve for x: x − 5 = 12", "17"),
    sa("q20", "Solve for n: 6 + n = 25", "19"),
]

GEOMETRY = [
    sa("q1", "A square has sides of 9 cm. What is its perimeter?", "36 cm"),
    sa("q2", "A rectangle is 8 cm long and 5 cm wide. What is its area?", "40 cm²"),
    sa("q3", "What is the sum of the three angles in any triangle?", "180°"),
    sa("q4", "How many degrees are in a right angle?", "90°"),
    sa("q5", "A circle has radius 5 cm. What is its diameter?", "10 cm"),
    sa("q6", "A square has sides of 7 cm. What is its area?", "49 cm²"),
    sa("q7", "A rectangle is 12 cm long and 4 cm wide. What is its perimeter?", "32 cm"),
    sa("q8", "Which tool is used to draw circles in geometry constructions?", "Compasses"),
    sa("q9", "Two lines that meet at 90° are called —", "Perpendicular"),
    sa("q10", "How many degrees are in a straight angle?", "180°"),
    sa("q11", "Each angle in an equilateral triangle measures how many degrees?", "60°"),
    sa("q12", "A triangle has base 10 cm and height 6 cm. What is its area?", "30 cm²"),
    sa("q13", "How many sides does a hexagon have?", "6"),
    sa("q14", "An equilateral triangle has sides of 5 cm. What is its perimeter?", "15 cm"),
    sa("q15", "Two lines in a plane that never meet are —", "Parallel"),
    sa("q16", "How many vertices does a cube have?", "8"),
    sa("q17", "A parallelogram has base 9 cm and height 4 cm. What is its area?", "36 cm²"),
    sa("q18", "Half of a full turn is how many degrees?", "180°"),
    sa("q19", "A square has perimeter 28 cm. What is the length of one side?", "7 cm"),
    sa("q20", "A circle has diameter 12 cm. What is its radius?", "6 cm"),
]


def write(wid, title, questions):
    data = {
        "title": title,
        "subject": "math",
        "evaluation": "manual",
        "scratchpad": True,
        "created_at": "2026-06-25T12:00:00Z",
        "questions": questions,
    }
    errs = validate_worksheet_data(data)
    if errs:
        raise ValueError(f"{wid}: {errs}")
    path = OUT / f"{wid}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {path.name} ({len(questions)} questions)")


if __name__ == "__main__":
    write("questions_83", "Math — Algebra (written answers)", ALGEBRA)
    write("questions_84", "Math — Geometry (written answers)", GEOMETRY)
