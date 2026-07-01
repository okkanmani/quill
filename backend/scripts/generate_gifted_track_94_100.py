#!/usr/bin/env python3
"""Generate Thinking Quest (gifted_track) worksheets 94–100."""

import json
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "worksheets"


def mcq(qid, stars, prompt, choices, answer):
    return {
        "id": qid,
        "type": "multiple_choice",
        "stars": stars,
        "prompt": prompt,
        "choices": choices,
        "answer": answer,
        "hint": False,
    }


def sheet(ws_id, title, subject, quest, weeks, questions, **extra):
    data = {
        "title": title,
        "subject": subject,
        "gifted_track": True,
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
            mcq("q1", 2, "What is the next number: 4, 9, 14, 19, …?", ["24", "23", "25", "22"], "24"),
            mcq("q2", 2, "What is the next number: 3, 6, 12, 24, …?", ["36", "48", "30", "42"], "48"),
            mcq("q3", 2, "What is the next number: 100, 95, 90, 85, …?", ["80", "75", "84", "70"], "80"),
            mcq("q4", 2, "What is the missing number: 2, 5, 10, 17, 26, ?", ["35", "37", "36", "34"], "37"),
            mcq("q5", 2, "What is 25 × 4 mentally?", ["100", "90", "80", "120"], "100"),
            mcq("q6", 2, "What is 15 × 6?", ["80", "90", "85", "95"], "90"),
            mcq("q7", 2, "What is 144 ÷ 12?", ["11", "12", "13", "14"], "12"),
            mcq("q8", 2, "What is the next number: 1, 4, 9, 16, 25, …?", ["30", "36", "35", "49"], "36"),
            mcq("q9", 2, "A rule is “add 7 each time.” If you start at 5, what is the 4th term?", ["26", "19", "33", "20"], "26"),
            mcq("q10", 2, "What is the next number: 2, 3, 5, 8, 12, …?", ["15", "16", "17", "18"], "17"),
            mcq("q11", 2, "Which number completes the pattern 50, 45, 40, …, 30?", ["35", "25", "32", "38"], "35"),
            mcq("q12", 2, "What is 999 + 1?", ["1,000", "990", "100", "10,000"], "1,000"),
        ],
    )

    sheet(
        "questions_95",
        "Thinking Quest — Logic Locks",
        "general",
        "Quest 2",
        "3-4",
        [
            mcq("q1", 2, "All bloops are razzies. Some razzies are lazzies. Which must be true?", ["Some bloops might be lazzies", "All lazzies are bloops", "No bloops are lazzies", "All razzies are bloops"], "Some bloops might be lazzies"),
            mcq("q2", 2, "If it rains, soccer is cancelled. Soccer was not cancelled. What can you conclude?", ["It did not rain", "It rained", "Soccer always runs", "Nothing"], "It did not rain"),
            mcq("q3", 2, "Amy is taller than Ben. Ben is taller than Cal. Who is shortest?", ["Cal", "Ben", "Amy", "Cannot tell"], "Cal"),
            mcq("q4", 2, "Three friends each have a different pet: cat, dog, fish. Sam has the dog. Jo does not have the cat. What pet does Jo have?", ["Fish", "Cat", "Dog", "Bird"], "Fish"),
            mcq("q5", 2, "Exactly one of these statements is true: (A) 2+2=5  (B) 3×4=12  (C) 10−6=3. Which is true?", ["B", "A", "C", "None"], "B"),
            mcq("q6", 2, "A number is doubled, then 3 is added. The result is 19. What was the number?", ["8", "11", "16", "22"], "8"),
            mcq("q7", 2, "Red, blue, and green pencils are in a row. Red is not next to green. Blue is in the middle. Which colors are on the ends?", ["Red and green", "Red and blue", "Blue and green", "All red"], "Red and green"),
            mcq("q8", 2, "If today is Wednesday, what day will it be 10 days from now?", ["Saturday", "Sunday", "Friday", "Monday"], "Saturday"),
            mcq("q9", 2, "Two kids tell you: One always lies, one always tells the truth. Alex says “I am the liar.” What is Alex?", ["The liar", "The truth-teller", "Both", "Neither"], "The liar"),
            mcq("q10", 2, "You need 3 tokens for a prize. You have 7 tokens. How many complete prizes can you get?", ["2", "3", "1", "4"], "2"),
            mcq("q11", 2, "A code uses A=1, B=2, C=3… What is the sum of the letter values in “BAD”?", ["6", "7", "8", "5"], "7"),
            mcq("q12", 2, "Five students sit in a line. Maya is 2nd. Jordan is to Maya’s right. Who could be 1st?", ["Anyone except Maya", "Only Jordan", "Only Maya", "No one"], "Anyone except Maya"),
        ],
    )

    sheet(
        "questions_96",
        "Thinking Quest — Fraction Force",
        "math",
        "Quest 3",
        "5-6",
        [
            mcq("q1", 2, "What is 1/2 + 1/4?", ["3/4", "2/6", "1/3", "2/4"], "3/4"),
            mcq("q2", 2, "Which fraction is largest: 2/3, 3/5, 1/2?", ["2/3", "3/5", "1/2", "All equal"], "2/3"),
            mcq("q3", 2, "Share 24 cookies equally among 6 friends. How many each?", ["4", "3", "6", "8"], "4"),
            mcq("q4", 2, "A recipe needs 3/4 cup flour. You double the recipe. How much flour?", ["1 1/2 cups", "1 cup", "3/2 tsp", "6/4 tbsp"], "1 1/2 cups"),
            mcq("q5", 2, "What is 2/5 of 35?", ["14", "12", "10", "16"], "14"),
            mcq("q6", 2, "Ratio of red to blue paint is 2:3. If you use 8 parts red, how many parts blue?", ["12", "10", "6", "16"], "12"),
            mcq("q7", 2, "Pizza has 8 slices. You eat 3. What fraction is left?", ["5/8", "3/8", "1/2", "3/5"], "5/8"),
            mcq("q8", 2, "Convert 3/4 to a decimal.", ["0.75", "0.34", "0.5", "0.25"], "0.75"),
            mcq("q9", 2, "Books cost $12 each. You buy 5. Total cost?", ["$60", "$50", "$17", "$72"], "$60"),
            mcq("q10", 2, "A tank is 1/3 full. 20 L more fills it halfway. How big is the tank?", ["120 L", "60 L", "90 L", "100 L"], "120 L"),
            mcq("q11", 2, "What is 5/6 − 1/3?", ["1/2", "4/3", "1/6", "2/3"], "1/2"),
            mcq("q12", 2, "Three numbers average 10. Two of them are 8 and 11. What is the third?", ["11", "10", "9", "12"], "11"),
        ],
    )

    sheet(
        "questions_97",
        "Thinking Quest — Shape Shifters",
        "math",
        "Quest 4",
        "7-8",
        [
            mcq("q1", 2, "A square has perimeter 32 cm. What is its area?", ["64 cm²", "16 cm²", "32 cm²", "128 cm²"], "64 cm²"),
            mcq("q2", 2, "A rectangle is 9 cm by 4 cm. What is its area?", ["36 cm²", "26 cm²", "13 cm²", "18 cm²"], "36 cm²"),
            mcq("q3", 2, "How many lines of symmetry does a square have?", ["4", "2", "1", "8"], "4"),
            mcq("q4", 2, "A triangle has base 10 cm and height 6 cm. Area?", ["30 cm²", "60 cm²", "16 cm²", "36 cm²"], "30 cm²"),
            mcq("q5", 2, "How many cubes of side 1 cm fit in a box 3×4×2 cm?", ["24", "12", "9", "20"], "24"),
            mcq("q6", 2, "An L-shape is made from two rectangles: 4×2 and 2×3 (no overlap). Total area?", ["14 cm²", "12 cm²", "10 cm²", "20 cm²"], "14 cm²"),
            mcq("q7", 2, "A circle’s diameter is 10 cm. What is its radius?", ["5 cm", "10 cm", "20 cm", "2.5 cm"], "5 cm"),
            mcq("q8", 2, "You fold a square sheet in half twice. How many layers when you cut a small hole?", ["4 holes when unfolded", "1 hole", "2 holes", "8 holes"], "4 holes when unfolded"),
            mcq("q9", 2, "Perimeter of an equilateral triangle with side 7 cm?", ["21 cm", "14 cm", "49 cm", "7 cm"], "21 cm"),
            mcq("q10", 2, "A room is 5 m long and 4 m wide. How many 1 m² floor tiles cover it?", ["20", "9", "18", "10"], "20"),
            mcq("q11", 2, "Which 3D shape has 6 faces that are all squares?", ["Cube", "Sphere", "Cylinder", "Cone"], "Cube"),
            mcq("q12", 2, "Two identical squares overlap. Each side is 6 cm. Overlap is a 2×2 square. Shaded area (both squares, no double count)?", ["68 cm²", "72 cm²", "64 cm²", "60 cm²"], "68 cm²"),
        ],
    )

    q98 = [
        mcq("q1", 2, "What is 18 × 15?", ["270", "280", "260", "250"], "270"),
        mcq("q2", 2, "What is 0.6 × 0.5?", ["0.3", "0.03", "3.0", "0.35"], "0.3"),
        mcq("q3", 3, "If 4 machines make 48 parts in 6 hours, how many parts do 2 machines make in 6 hours (same rate)?", ["24", "12", "96", "36"], "24"),
        mcq("q4", 2, "What is the average of 8, 12, and 16?", ["12", "10", "14", "11"], "12"),
        mcq("q5", 3, "How many two-digit numbers contain the digit 7 at least once?", ["18", "19", "17", "10"], "19"),
        mcq("q6", 2, "A 120 km trip at 60 km/h takes how many hours?", ["2", "3", "1.5", "4"], "2"),
        mcq("q7", 3, "What is 1 + 2 + 3 + … + 10?", ["55", "45", "50", "60"], "55"),
        mcq("q8", 2, "Which fraction equals 0.25?", ["1/4", "1/5", "2/5", "3/4"], "1/4"),
        mcq("q9", 3, "A number is multiplied by 3, then 5 is subtracted. The answer is 16. Find the number.", ["7", "5", "8", "6"], "7"),
        mcq("q10", 2, "How many edges on a cube?", ["12", "8", "6", "10"], "12"),
        mcq("q11", 3, "In a class of 30, 40% chose chess club. How many students?", ["12", "15", "10", "18"], "12"),
        mcq("q12", 2, "What is the next term: 1, 1, 2, 3, 5, 8, …?", ["13", "11", "12", "10"], "13"),
        mcq("q13", 3, "A square and rectangle share perimeter 24. Square side 4. Rectangle width 4. Rectangle length?", ["8", "6", "10", "12"], "8"),
        mcq("q14", 2, "Solve mentally: 1000 − 347", ["653", "663", "643", "673"], "653"),
        mcq("q15", 3, "You flip a fair coin twice. Probability of two heads?", ["1/4", "1/2", "1/3", "1/8"], "1/4"),
    ]
    sheet("questions_98", "Thinking Quest — Mixed Mission", "math", "Quest 5", "9-10", q98)

    sheet(
        "questions_99",
        "Thinking Quest — Quick Think Sprint",
        "math",
        "Quest 6",
        "11",
        [
            mcq("q1", 2, "What is 7 × 8?", ["56", "54", "58", "48"], "56"),
            mcq("q2", 2, "What is 3/4 of 20?", ["15", "12", "10", "16"], "15"),
            mcq("q3", 2, "A rectangle is 6 cm by 5 cm. Perimeter?", ["22 cm", "30 cm", "11 cm", "20 cm"], "22 cm"),
            mcq("q4", 2, "What is 25% of 80?", ["20", "25", "16", "30"], "20"),
            mcq("q5", 2, "Next number: 5, 10, 20, 40, …?", ["80", "60", "70", "50"], "80"),
            mcq("q6", 2, "If x + 9 = 17, what is x?", ["8", "9", "7", "26"], "8"),
            mcq("q7", 2, "How many minutes in 2 hours?", ["120", "100", "60", "90"], "120"),
            mcq("q8", 2, "Which is smallest: 0.5, 0.05, 0.55?", ["0.05", "0.5", "0.55", "All equal"], "0.05"),
            mcq("q9", 2, "Area of square with side 9 cm?", ["81 cm²", "36 cm²", "18 cm²", "72 cm²"], "81 cm²"),
            mcq("q10", 2, "Share 45 stickers among 5 friends equally. Each gets?", ["9", "8", "7", "10"], "9"),
        ],
        timed=True,
        time_limit_minutes=20,
    )

    q100 = [
        mcq("q1", 2, "What is 12 × 11?", ["132", "122", "142", "112"], "132"),
        mcq("q2", 3, "How many paths from A to B on a 2×2 grid (right/up only)?", ["6", "4", "8", "2"], "6"),
        mcq("q3", 2, "What is 2/3 + 1/6?", ["5/6", "3/9", "1/2", "3/6"], "5/6"),
        mcq("q4", 3, "Average of 5 numbers is 8. Four numbers average 7. Fifth number?", ["12", "10", "11", "9"], "12"),
        mcq("q5", 2, "Perimeter of rectangle 12 m by 5 m?", ["34 m", "60 m", "17 m", "30 m"], "34 m"),
        mcq("q6", 3, "If 5 workers finish a job in 12 days, how long for 10 workers (same work rate)?", ["6 days", "24 days", "10 days", "8 days"], "6 days"),
        mcq("q7", 2, "What is 0.4 + 0.35?", ["0.75", "0.39", "0.85", "0.7"], "0.75"),
        mcq("q8", 3, "Digits 2, 4, 6 used once each. How many 3-digit numbers?", ["6", "3", "9", "12"], "6"),
        mcq("q9", 2, "What is 144 ÷ 16?", ["9", "8", "12", "10"], "9"),
        mcq("q10", 3, "Clock shows 4:00. Smaller angle between hands?", ["120°", "90°", "60°", "150°"], "120°"),
        mcq("q11", 2, "Ratio 3:2, total 25 parts. How many are the larger share?", ["15", "10", "12", "18"], "15"),
        mcq("q12", 3, "Think of a number, double it, add 10, get 30. Original number?", ["10", "20", "5", "15"], "10"),
    ]
    sheet("questions_100", "Thinking Quest — Boss Level Review", "math", "Quest 7", "12", q100)


if __name__ == "__main__":
    main()
