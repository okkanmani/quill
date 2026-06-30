#!/usr/bin/env python3
"""Generate manual-eval algebra & geometry worksheets 85–86 (★3, 15 Q)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worksheets import validate_worksheet_data

OUT = Path(__file__).resolve().parents[1] / "data" / "worksheets"
STARS = 3


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
    sa("q1", "Solve for x: 2x + 5 = 19", "7"),
    sa("q2", "Solve for y: 3y − 7 = 14", "7"),
    sa("q3", "If 4n − 3 = 25, what is n?", "7"),
    sa("q4", "Solve for m: 5(m + 2) = 35", "5"),
    sa("q5", "A number is doubled and 6 is added to get 30. What is the number?", "12"),
    sa("q6", "Solve for p: p/3 + 4 = 9", "15"),
    sa("q7", "The rule for matchsticks is 3n + 1. How many matchsticks for n = 8?", "25"),
    sa("q8", "If 2x + 3 = x + 12, what is x?", "9"),
    sa("q9", "Solve for k: 7 − k = 2", "5"),
    sa("q10", "A book costs ₹x. After a ₹45 discount it costs ₹155. What is x?", "200"),
    sa("q11", "Write the solution of 4x = 2x + 10", "5"),
    sa("q12", "If 3(n − 2) = 18, what is n?", "8"),
    sa("q13", "Sum of a number and twice the number is 27. What is the number?", "9"),
    sa("q14", "Solve for t: 2t + 8 = 3t − 1", "9"),
    sa("q15", "Perimeter of a square is 4s. If s = 11, what is the perimeter?", "44"),
]

GEOMETRY = [
    sa("q1", "A trapezoid has parallel sides 8 cm and 12 cm, and height 5 cm. What is its area?", "50 cm²"),
    sa("q2", "The diameter of a circle is 14 cm. What is its radius?", "7 cm"),
    sa("q3", "Two angles of a triangle are 47° and 68°. What is the third angle?", "65°"),
    sa("q4", "A rectangular prism is 5 cm × 4 cm × 3 cm. What is its volume?", "60 cm³"),
    sa("q5", "How many degrees are in four right angles?", "360°"),
    sa("q6", "A parallelogram has base 13 cm and height 6 cm. What is its area?", "78 cm²"),
    sa("q7", "An isosceles triangle has equal sides 10 cm and base 12 cm. What is its perimeter?", "32 cm"),
    sa("q8", "Constructing 60° often uses which special triangle?", "Equilateral"),
    sa("q9", "A circle has radius 9 cm. What is its diameter?", "18 cm"),
    sa("q10", "A rhombus has side 8 cm. What is its perimeter?", "32 cm"),
    sa("q11", "A triangle has area 54 cm² and base 12 cm. What is its height?", "9 cm"),
    sa("q12", "How many edges does a cuboid have?", "12"),
    sa("q13", "Two complementary angles add to 90°. If one is 28°, what is the other?", "62°"),
    sa("q14", "A square has area 121 cm². What is the length of one side?", "11 cm"),
    sa("q15", "120° is made by placing two equal angles on a line. How many degrees is each?", "60°"),
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
    print(f"Wrote {path.name} ({len(questions)} questions, ★{STARS})")


if __name__ == "__main__":
    write("questions_85", "Math — Algebra (written answers, hard)", ALGEBRA)
    write("questions_86", "Math — Geometry (written answers, hard)", GEOMETRY)
