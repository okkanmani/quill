#!/usr/bin/env python3
"""Generate Thinking Quest (gifted_track) worksheets 94–100 — manual short answer."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "worksheets"


def sa(qid, stars, prompt, answer):
    return {
        "id": qid,
        "type": "short_answer",
        "stars": stars,
        "prompt": prompt,
        "answer": answer,
        "hint": False,
    }


def start_week(weeks: str | int) -> int:
    if isinstance(weeks, int):
        return weeks
    m = re.match(r"^(\d+)", str(weeks).strip())
    return int(m.group(1)) if m else 1


def sheet(ws_id, title, subject, quest, weeks, questions, **extra):
    data = {
        "title": title,
        "subject": subject,
        "gifted_track": True,
        "gifted_track_week": start_week(weeks),
        "evaluation": "manual",
        "content_badge": quest,
        "scratchpad": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "questions": questions,
    }
    data.update(extra)
    path = OUT / f"{ws_id}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {path.name} ({len(questions)} Q)")


def main():
    sheet(
        "questions_94",
        "Thinking Quest — Pattern Powers",
        "math",
        "Quest 1",
        "1-2",
        [
            sa("q1", 2, "What is the next number in 4, 9, 14, 19, …? Explain the rule you used.", "24"),
            sa("q2", 2, "What is the next number in 3, 6, 12, 24, …? Show how you figured it out.", "48"),
            sa("q3", 2, "What is the next number in 100, 95, 90, 85, …? Explain your pattern.", "80"),
            sa("q4", 2, "Find the missing number: 2, 5, 10, 17, 26, ? Explain why it fits.", "37"),
            sa("q5", 2, "What is 25 × 4? Show your mental math steps.", "100"),
            sa("q6", 2, "What is 15 × 6? Show your work.", "90"),
            sa("q7", 2, "What is 144 ÷ 12? Show your work.", "12"),
            sa("q8", 2, "What is the next number in 1, 4, 9, 16, 25, …? Name the pattern.", "36"),
            sa("q9", 2, "A rule is “add 7 each time,” starting at 5. What is the 4th term? Show the sequence.", "26"),
            sa("q10", 2, "What is the next number in 2, 3, 5, 8, 12, …? Explain the pattern.", "17"),
            sa("q11", 2, "Which number completes 50, 45, 40, …, 30? Explain.", "35"),
            sa("q12", 2, "What is 999 + 1? Show how you know.", "1000"),
        ],
    )

    sheet(
        "questions_95",
        "Thinking Quest — Logic Locks",
        "general",
        "Quest 2",
        "3-4",
        [
            sa("q1", 2, "All bloops are razzies. Some razzies are lazzies. Which statement must be true? Explain.", "Some bloops might be lazzies"),
            sa("q2", 2, "If it rains, soccer is cancelled. Soccer was not cancelled. What can you conclude? Explain.", "It did not rain"),
            sa("q3", 2, "Amy is taller than Ben. Ben is taller than Cal. Who is shortest? Explain.", "Cal"),
            sa("q4", 2, "Three friends each have a different pet: cat, dog, fish. Sam has the dog. Jo does not have the cat. What pet does Jo have? Show your reasoning.", "Fish"),
            sa("q5", 2, "Exactly one statement is true: (A) 2+2=5  (B) 3×4=12  (C) 10−6=3. Which one? Explain.", "B"),
            sa("q6", 2, "A number is doubled, then 3 is added. The result is 19. What was the number? Show your steps.", "8"),
            sa("q7", 2, "Red, blue, and green pencils are in a row. Red is not next to green. Blue is in the middle. What colors are on the ends? Explain.", "Red and green"),
            sa("q8", 2, "If today is Wednesday, what day will it be 10 days from now? Show how you counted.", "Saturday"),
            sa("q9", 2, "One kid always lies, one always tells the truth. Alex says “I am the liar.” Is Alex the liar or the truth-teller? Explain.", "The liar"),
            sa("q10", 2, "You need 3 tokens for a prize. You have 7 tokens. How many complete prizes can you get? Explain.", "2"),
            sa("q11", 2, "A=1, B=2, C=3… What is the sum of the letter values in “BAD”? Show your work.", "7"),
            sa("q12", 2, "Five students sit in a line. Maya is 2nd. Jordan is to Maya’s right. Who could be 1st? Explain.", "Anyone except Maya"),
        ],
    )

    sheet(
        "questions_96",
        "Thinking Quest — Fraction Force",
        "math",
        "Quest 3",
        "5-6",
        [
            sa("q1", 2, "What is 1/2 + 1/4? Show your work.", "3/4"),
            sa("q2", 2, "Which is largest: 2/3, 3/5, or 1/2? Explain how you compared.", "2/3"),
            sa("q3", 2, "Share 24 cookies equally among 6 friends. How many does each get? Show your work.", "4"),
            sa("q4", 2, "A recipe needs 3/4 cup flour. You double the recipe. How much flour? Show your work.", "1 1/2 cups"),
            sa("q5", 2, "What is 2/5 of 35? Show your steps.", "14"),
            sa("q6", 2, "Ratio of red to blue paint is 2:3. If you use 8 parts red, how many parts blue? Explain.", "12"),
            sa("q7", 2, "A pizza has 8 slices. You eat 3. What fraction is left? Explain.", "5/8"),
            sa("q8", 2, "Convert 3/4 to a decimal. Show how.", "0.75"),
            sa("q9", 2, "Books cost $12 each. You buy 5. What is the total cost? Show your work.", "$60"),
            sa("q10", 2, "A tank is 1/3 full. Adding 20 L fills it halfway. How big is the tank? Show your reasoning.", "120 L"),
            sa("q11", 2, "What is 5/6 − 1/3? Show your work.", "1/2"),
            sa("q12", 2, "Three numbers average 10. Two of them are 8 and 11. What is the third? Show your work.", "11"),
        ],
    )

    sheet(
        "questions_97",
        "Thinking Quest — Shape Shifters",
        "math",
        "Quest 4",
        "7-8",
        [
            sa("q1", 2, "A square has perimeter 32 cm. What is its area? Show your work.", "64 cm²"),
            sa("q2", 2, "A rectangle is 9 cm by 4 cm. What is its area? Show your work.", "36 cm²"),
            sa("q3", 2, "How many lines of symmetry does a square have? Explain or sketch.", "4"),
            sa("q4", 2, "A triangle has base 10 cm and height 6 cm. What is its area? Show the formula and answer.", "30 cm²"),
            sa("q5", 2, "How many 1 cm cubes fit in a box 3×4×2 cm? Show your work.", "24"),
            sa("q6", 2, "An L-shape uses two rectangles 4×2 and 2×3 (no overlap). What is the total area? Show how.", "14 cm²"),
            sa("q7", 2, "A circle’s diameter is 10 cm. What is its radius? Explain.", "5 cm"),
            sa("q8", 2, "You fold a square sheet in half twice and cut one small hole. How many holes appear when unfolded? Explain.", "4 holes when unfolded"),
            sa("q9", 2, "An equilateral triangle has side 7 cm. What is its perimeter? Show your work.", "21 cm"),
            sa("q10", 2, "A room is 5 m by 4 m. How many 1 m² tiles cover the floor? Show your work.", "20"),
            sa("q11", 2, "Which 3D shape has 6 faces that are all squares? Name it and explain.", "Cube"),
            sa("q12", 2, "Two identical squares (side 6 cm) overlap in a 2×2 square. What is the total shaded area (no double counting)? Show work.", "68 cm²"),
        ],
    )

    q98 = [
        sa("q1", 2, "What is 18 × 15? Show your work.", "270"),
        sa("q2", 2, "What is 0.6 × 0.5? Show how you know.", "0.3"),
        sa("q3", 3, "4 machines make 48 parts in 6 hours. How many parts do 2 machines make in 6 hours (same rate)? Explain.", "24"),
        sa("q4", 2, "What is the average of 8, 12, and 16? Show your work.", "12"),
        sa("q5", 3, "How many two-digit numbers contain the digit 7 at least once? Explain your method.", "19"),
        sa("q6", 2, "A 120 km trip at 60 km/h takes how many hours? Show your work.", "2"),
        sa("q7", 3, "What is 1 + 2 + 3 + … + 10? Show a method (you may use a shortcut).", "55"),
        sa("q8", 2, "Which fraction equals 0.25? Explain.", "1/4"),
        sa("q9", 3, "A number is multiplied by 3, then 5 is subtracted. The answer is 16. Find the number. Show your steps.", "7"),
        sa("q10", 2, "How many edges does a cube have? Explain or describe.", "12"),
        sa("q11", 3, "In a class of 30, 40% chose chess club. How many students? Show your work.", "12"),
        sa("q12", 2, "What is the next term in 1, 1, 2, 3, 5, 8, …? Name the pattern.", "13"),
        sa("q13", 3, "A square and rectangle share perimeter 24. The square has side 4. The rectangle has width 4. What is the rectangle’s length? Show work.", "8"),
        sa("q14", 2, "Solve: 1000 − 347. Show your mental math.", "653"),
        sa("q15", 3, "You flip a fair coin twice. What is the probability of two heads? Explain.", "1/4"),
    ]
    sheet("questions_98", "Thinking Quest — Mixed Mission", "math", "Quest 5", "9-10", q98)

    sheet(
        "questions_99",
        "Thinking Quest — Quick Think Sprint",
        "math",
        "Quest 6",
        "11",
        [
            sa("q1", 2, "What is 7 × 8? Show your work.", "56"),
            sa("q2", 2, "What is 3/4 of 20? Show your work.", "15"),
            sa("q3", 2, "A rectangle is 6 cm by 5 cm. What is its perimeter? Show your work.", "22 cm"),
            sa("q4", 2, "What is 25% of 80? Show how you calculated it.", "20"),
            sa("q5", 2, "What is the next number in 5, 10, 20, 40, …? Explain the rule.", "80"),
            sa("q6", 2, "If x + 9 = 17, what is x? Show your steps.", "8"),
            sa("q7", 2, "How many minutes are in 2 hours? Explain.", "120"),
            sa("q8", 2, "Which is smallest: 0.5, 0.05, or 0.55? Explain how you compared.", "0.05"),
            sa("q9", 2, "What is the area of a square with side 9 cm? Show your work.", "81 cm²"),
            sa("q10", 2, "Share 45 stickers equally among 5 friends. How many each? Show your work.", "9"),
        ],
        timed=True,
        time_limit_minutes=20,
    )

    q100 = [
        sa("q1", 2, "What is 12 × 11? Show your work.", "132"),
        sa("q2", 3, "How many paths from A to B on a 2×2 grid (right and up only)? Explain with a sketch or list.", "6"),
        sa("q3", 2, "What is 2/3 + 1/6? Show your work.", "5/6"),
        sa("q4", 3, "Average of 5 numbers is 8. Four numbers average 7. What is the fifth number? Show work.", "12"),
        sa("q5", 2, "Perimeter of a rectangle 12 m by 5 m? Show your work.", "34 m"),
        sa("q6", 3, "5 workers finish a job in 12 days. How long for 10 workers (same rate)? Explain.", "6 days"),
        sa("q7", 2, "What is 0.4 + 0.35? Show your work.", "0.75"),
        sa("q8", 3, "Using digits 2, 4, 6 once each, how many 3-digit numbers can you make? Explain.", "6"),
        sa("q9", 2, "What is 144 ÷ 16? Show your work.", "9"),
        sa("q10", 3, "A clock shows 4:00. What is the smaller angle between the hands? Explain.", "120°"),
        sa("q11", 2, "Ratio 3:2, total 25 parts. How many are in the larger share? Show work.", "15"),
        sa("q12", 3, "Think of a number, double it, add 10, get 30. What was the number? Show your steps.", "10"),
    ]
    sheet("questions_100", "Thinking Quest — Boss Level Review", "math", "Quest 7", "12", q100)


if __name__ == "__main__":
    main()
