#!/usr/bin/env python3
"""Generate questions_113.json — Math adaptive test (dry run, 20 sitting × 3 tiers)."""

import json
from datetime import datetime, timezone
from pathlib import Path

WORKSHEETS = Path(__file__).resolve().parents[1] / "data" / "worksheets"
NOW = datetime.now(timezone.utc).isoformat()
SITTING = 20


def mcq(qid, prompt, answer, choices, stars=2, area=None):
    return {
        "id": qid,
        "type": "multiple_choice",
        "stars": stars,
        "prompt": prompt,
        "choices": choices,
        "answer": answer,
        "hint": False,
        **({"area": area} if area else {}),
    }


def tier1_questions():
    """Easier tier — 20 unique questions."""
    specs = [
        ("What is 7 + 8?", "15", ["15", "14", "16", "56"], "addition"),
        ("What is 20 − 13?", "7", ["7", "33", "6", "8"], "subtraction"),
        ("What is 6 × 4?", "24", ["24", "10", "20", "28"], "multiplication"),
        ("What is 36 ÷ 6?", "6", ["6", "30", "42", "9"], "division"),
        ("Which fraction equals 1/2?", "3/6", ["3/6", "2/5", "1/3", "2/3"], "fractions"),
        ("What is 0.5 as a fraction in lowest terms?", "1/2", ["1/2", "5/10", "2/5", "1/5"], "decimals"),
        ("How many sides does a hexagon have?", "6", ["6", "5", "8", "4"], "geometry"),
        ("What is the perimeter of a square with side 5 cm?", "20 cm", ["20 cm", "25 cm", "10 cm", "15 cm"], "geometry"),
        ("Which number is even?", "18", ["18", "15", "21", "17"], "numbers"),
        ("Round 47 to the nearest ten.", "50", ["50", "40", "47", "45"], "rounding"),
        ("What is 3²?", "9", ["9", "6", "8", "12"], "exponents"),
        ("Solve: x + 5 = 12", "7", ["7", "17", "5", "2"], "algebra"),
        ("What is 25% of 80?", "20", ["20", "25", "40", "16"], "percent"),
        ("Which angle is acute?", "45°", ["45°", "95°", "120°", "180°"], "geometry"),
        ("What is the place value of 8 in 3,482?", "Hundreds", ["Hundreds", "Tens", "Ones", "Thousands"], "place value"),
        ("Convert 2.5 hours to minutes.", "150", ["150", "250", "125", "120"], "measurement"),
        ("What is the median of 4, 7, 9?", "7", ["7", "4", "9", "6"], "statistics"),
        ("A bag has 3 red and 5 blue marbles. P(red)?", "3/8", ["3/8", "5/8", "3/5", "1/3"], "probability"),
        ("Which expression equals 12?", "3 × 4", ["3 × 4", "5 + 4", "20 − 9", "6 + 4"], "expressions"),
        ("What is −3 + 10?", "7", ["7", "−7", "13", "−13"], "integers"),
    ]
    return [mcq(f"t1q{i+1}", p, a, c, stars=1, area=ar) for i, (p, a, c, ar) in enumerate(specs)]


def tier2_questions():
    specs = [
        ("Evaluate: 18 − 3 × (2 + 4)", "0", ["0", "36", "12", "6"], "order of operations"),
        ("Solve: 4x − 9 = 15", "6", ["6", "24", "4", "5"], "algebra"),
        ("What is 2/3 + 1/6?", "5/6", ["5/6", "3/9", "1/2", "3/6"], "fractions"),
        ("A rectangle is 9 cm by 4 cm. What is its area?", "36 cm²", ["36 cm²", "26 cm²", "13 cm²", "18 cm²"], "geometry"),
        ("What is 15% of 240?", "36", ["36", "24", "40", "30"], "percent"),
        ("Simplify: 5x + 3x − 2", "8x − 2", ["8x − 2", "8x + 2", "2x − 2", "15x"], "algebra"),
        ("What is the GCF of 24 and 36?", "12", ["12", "6", "72", "4"], "factors"),
        ("Convert 3/8 to a decimal.", "0.375", ["0.375", "0.38", "0.35", "0.83"], "fractions"),
        ("A triangle has angles 65° and 55°. Find the third.", "60°", ["60°", "70°", "120°", "50°"], "geometry"),
        ("What is 1.2 × 0.5?", "0.6", ["0.6", "6", "1.7", "0.06"], "decimals"),
        ("Find the mean of 12, 15, 18, 21.", "16.5", ["16.5", "15", "18", "66"], "statistics"),
        ("If 5 notebooks cost $7.50, one notebook costs —", "$1.50", ["$1.50", "$2.50", "$12.50", "$0.75"], "ratios"),
        ("What is 4³?", "64", ["64", "12", "16", "81"], "exponents"),
        ("Solve: 2(x + 3) = 14", "4", ["4", "7", "5", "11"], "algebra"),
        ("What is 7/12 − 1/4?", "1/3", ["1/3", "1/2", "5/12", "2/3"], "fractions"),
        ("A circle has radius 5 cm. Diameter?", "10 cm", ["10 cm", "25 cm", "5 cm", "15 cm"], "geometry"),
        ("Which ratio is equivalent to 2:5?", "8:20", ["8:20", "4:8", "10:2", "5:2"], "ratios"),
        ("What is (−4) × (−6)?", "24", ["24", "−24", "10", "−10"], "integers"),
        ("How many cm are in 2.3 m?", "230", ["230", "23", "2300", "0.23"], "measurement"),
        ("A number increases from 50 to 65. Percent increase?", "30%", ["30%", "15%", "25%", "35%"], "percent"),
    ]
    return [mcq(f"t2q{i+1}", p, a, c, stars=2, area=ar) for i, (p, a, c, ar) in enumerate(specs)]


def tier3_questions():
    specs = [
        ("Evaluate: 24 − 2 × (3 + 5)²", "−104", ["−104", "16", "88", "−88"], "order of operations"),
        ("Solve: 3x + 7 = 34", "9", ["9", "11", "7", "8"], "algebra"),
        ("What is 3/4 ÷ 2/5?", "15/8", ["15/8", "6/20", "5/6", "8/15"], "fractions"),
        ("Parallelogram: base 12 cm, height 8 cm. Area?", "96 cm²", ["96 cm²", "40 cm²", "48 cm²", "192 cm²"], "geometry"),
        ("After 15% off, price is $68. Original price?", "$80", ["$80", "$78.20", "$58.80", "$85"], "percent"),
        ("LCM of 15 and 20?", "60", ["60", "5", "300", "35"], "factors"),
        ("GCF of 48 and 72?", "24", ["24", "12", "8", "6"], "factors"),
        ("Compute: 6.5 × 0.8", "5.2", ["5.2", "52", "5.02", "6.13"], "decimals"),
        ("Cube edge 4 cm. Volume?", "64 cm³", ["64 cm³", "16 cm³", "48 cm³", "12 cm³"], "geometry"),
        ("Mean of 6, 10, 14, 18?", "12", ["12", "11", "13", "14"], "statistics"),
        ("5 notebooks for $12.50. Cost of 8?", "$20", ["$20", "$17.50", "$22.50", "$25"], "ratios"),
        ("Flour:sugar = 5:2. Flour 350 g → sugar?", "140 g", ["140 g", "175 g", "100 g", "875 g"], "ratios"),
        ("Complementary: one angle 38°. The other?", "52°", ["52°", "142°", "48°", "62°"], "geometry"),
        ("45% of 320?", "144", ["144", "128", "160", "136"], "percent"),
        ("Compute: (−8) + 15 − (−3)", "10", ["10", "−26", "4", "−4"], "integers"),
        ("Simplify: 2(3x + 4) − 5x", "x + 8", ["x + 8", "6x + 8", "x − 8", "11x + 8"], "algebra"),
        ("Isosceles: sides 13, 13, base 10. Perimeter?", "36 cm", ["36 cm", "26 cm", "33 cm", "23 cm"], "geometry"),
        ("7/8 − 1/3?", "13/24", ["13/24", "6/5", "1/2", "5/24"], "fractions"),
        ("240 km in 3 h. Average speed?", "80 km/h", ["80 km/h", "720 km/h", "60 km/h", "120 km/h"], "rates"),
        ("Circle diameter 14 cm, π = 22/7. Area?", "154 cm²", ["154 cm²", "44 cm²", "616 cm²", "77 cm²"], "geometry"),
    ]
    return [mcq(f"t3q{i+1}", p, a, c, stars=3, area=ar) for i, (p, a, c, ar) in enumerate(specs)]


def main():
    questions = tier1_questions() + tier2_questions() + tier3_questions()
    data = {
        "title": "Math Adaptive Test — Dry Run",
        "subject": "math",
        "scratchpad": False,
        "created_at": NOW,
        "content_badge": "Test",
        "is_test": True,
        "test_sitting_count": SITTING,
        "timed": True,
        "time_limit_minutes": 45,
        "questions": questions,
    }
    path = WORKSHEETS / "questions_113.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {path.name} ({len(questions)} questions, sitting={SITTING})")


if __name__ == "__main__":
    main()
