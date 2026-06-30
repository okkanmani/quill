#!/usr/bin/env python3
"""Generate worksheet batch 76–82: ★3, 15 questions each, balanced MC positions."""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worksheets import validate_worksheet_data

OUT = Path(__file__).resolve().parents[1] / "data" / "worksheets"
STARS = 3
COUNT = 15


def balanced_positions(n: int, k: int = 4) -> list[int]:
    positions = [i % k for i in range(n)]
    random.shuffle(positions)
    return positions


def mc(qid, prompt, answer, distractors, pos, pid=None):
    distractors = [d for d in distractors if d != answer][:3]
    slots = distractors[:]
    slots.insert(min(pos, len(slots)), answer)
    q = {
        "id": qid,
        "type": "multiple_choice",
        "stars": STARS,
        "prompt": prompt,
        "choices": slots,
        "answer": answer,
        "hint": False,
    }
    if pid:
        q["passage_id"] = pid
    return q


def build(specs, seed):
    random.seed(seed)
    positions = balanced_positions(len(specs))
    out = []
    for i, item in enumerate(specs):
        if len(item) == 5:
            qid, pid, prompt, answer, distractors = item
        else:
            qid, prompt, answer, distractors = item
            pid = None
        out.append(mc(qid, prompt, answer, list(distractors), positions[i], pid))
    return out


def passage(pid, title, body=None, chart=None, table=None):
    p = {"id": pid, "title": title}
    if body:
        p["body"] = body
    if chart:
        p["chart"] = chart
    if table:
        p["table"] = table
    return p


def write(wid, meta, passages, questions):
    data = {**meta, "created_at": "2026-06-23T12:00:00Z", "questions": questions}
    if passages:
        data["passages"] = passages
    errs = validate_worksheet_data(data)
    if errs:
        raise ValueError(f"{wid}: {errs}")
    pos = {}
    for q in questions:
        idx = q["choices"].index(q["answer"])
        pos[idx] = pos.get(idx, 0) + 1
    path = OUT / f"{wid}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{wid}: {len(questions)} Q positions {dict(sorted(pos.items()))}")


# --- 76 NCERT Algebra ---
ALGEBRA = [
    ("q1", "If n matchsticks make n L-shapes and each L uses 2 sticks, how many for 9 Ls?", "18", ["11", "16", "20"]),
    ("q2", "Which is an algebraic expression (not an equation)?", "3x + 5", ["x + 4 = 9", "2m = 14", "y − 3 = 10"]),
    ("q3", "Solve: n + 8 = 21", "n = 13", ["n = 29", "n = 7", "n = 11"]),
    ("q4", "Solve: y − 6 = 15", "y = 21", ["y = 9", "y = 19", "y = 24"]),
    ("q5", "Solve: 4p = 36", "p = 9", ["p = 32", "p = 40", "p = 6"]),
    ("q6", "A number plus 12 equals 30. Which equation fits?", "n + 12 = 30", ["12n = 30", "n − 12 = 30", "n + 30 = 12"]),
    ("q7", "If 2n + 1 = 17, what is n?", "8", ["7", "9", "16"]),
    ("q8", "Which inverse operation undoes multiplying by 5?", "Divide by 5", ["Add 5", "Subtract 5", "Multiply by 5 again"]),
    ("q9", "Ravi has x rupees. After spending ₹25 he has ₹40. Which equation is correct?", "x − 25 = 40", ["x + 25 = 40", "25x = 40", "x − 40 = 25"]),
    ("q10", "What is the solution of m + 15 = 15?", "m = 0", ["m = 30", "m = 15", "m = 1"]),
    ("q11", "Which expression means '5 more than a number y'?", "y + 5", ["5y", "y − 5", "y ÷ 5"]),
    ("q12", "Solve: x + 19 = 50", "x = 31", ["x = 69", "x = 29", "x = 41"]),
    ("q13", "If 3n = 27, check which value of n works.", "9", ["6", "8", "10"]),
    ("q14", "Which is an equation?", "7 − k = 2", ["7 − k", "3a + 1", "2m"]),
    ("q15", "Meena thinks of a number, doubles it, and gets 24. Which equation matches?", "2n = 24", ["n + 2 = 24", "n − 2 = 24", "n ÷ 2 = 24"]),
]

# --- 77 NCERT Practical Geometry ---
PRACT_GEOM = [
    ("q1", "Which tool is used to draw arcs and circles in classical constructions?", "Compasses", ["Protractor", "Divider only", "Set-square only"]),
    ("q2", "A circle is the set of points at a fixed distance from the —", "centre", ["diameter", "chord", "tangent"]),
    ("q3", "To construct a circle of radius 4 cm, compasses should be opened to —", "4 cm", ["2 cm", "8 cm", "Any length"]),
    ("q4", "The perpendicular bisector of segment AB meets AB at —", "90°", ["45°", "60°", "180° only at endpoints"]),
    ("q5", "Every point on the perpendicular bisector of AB is —", "equidistant from A and B", ["closer to A", "closer to B", "on segment AB only"]),
    ("q6", "Which angle is often built by constructing an equilateral triangle?", "60°", ["45°", "90°", "120° only without steps"]),
    ("q7", "A protractor is mainly used to —", "measure and draw angles", ["draw circles only", "compare masses", "bisect segments without arcs"]),
    ("q8", "To copy an angle ∠X at point P, you must keep the —", "same compass opening for corresponding arcs", ["ruler tilted", "protractor at X only", "segment length doubled"]),
    ("q9", "120° can be constructed by placing two — adjacent on a line.", "60° angles", ["30° angles", "90° angles", "45° angles"]),
    ("q10", "In classical construction, a ruler (straight edge) is used to draw —", "straight lines", ["circles", "measured arcs", "angles without tools"]),
    ("q11", "When bisecting AB, compass openings must be —", "more than half of AB", ["exactly half of AB", "less than half of AB", "equal to AB"]),
    ("q12", "A set-square helps draw lines that are —", "perpendicular or at fixed angles", ["always curved", "only horizontal", "random slants"]),
    ("q13", "The fixed distance from centre to any point on a circle is the —", "radius", ["diameter", "perimeter", "arc length"]),
    ("q14", "To construct a perpendicular from a point on a line, equal arcs are drawn —", "on both sides of the point on the line", ["only above the line", "only from off the line", "without using the point"]),
    ("q15", "A divider is mainly used to —", "compare lengths", ["measure angles", "draw 60°", "shade regions"]),
]

# --- 78 English RC ★3 (3 passages × 5) ---
ENG_PASSAGES = [
    passage("p1", "The seed library",
        body="In a town where winters lasted half the year, Ms. Ortiz opened a seed library inside the public library's back room. Patrons checked out envelopes of tomato, bean, and sunflower seeds with the same card they used for books. They promised to return seeds from their healthiest plants in autumn. Teen volunteer Kai labeled each envelope with sowing dates and frost warnings. Some families failed the first season because they planted too early; Kai added a soil thermometer loan program. By the third year, borrowers brought back twice as many seeds as they had taken, and the catalog included drought-tolerant varieties suggested by elderly gardeners who had kept heirlooms in biscuit tins for decades."),
    passage("p2", "Under the stadium lights",
        body="Track coach Alvarez timed hundred-metre repeats under lights that attracted moths the size of thumbs. Sprinter Dina noticed her starts improved when she counted breaths instead of staring at rivals. Alvarez filmed her blocks from a low angle and saw her rear foot lifting a fraction early. They drilled a shorter first stride so her torso stayed lower. Dina kept a notebook of sleep hours, noting that seven and a half hours beat six when exams stacked up. At the district meet she false-started once, then asked officials to let her run a time trial after the heat; the request was denied, but she channelled the frustration into a personal best in the long jump later that day."),
    passage("p3", "The archive detective",
        body="Historian Priya searched municipal archives for the origin of a fountain that appeared on a 1924 postcard but not on an 1898 map. Dust on ledger spines smelled of vinegar from old repairs. She matched brick suppliers in tax records to a cancelled theatre contract. A clerk pointed her to a box of unpaid invoices showing the fountain installed in 1911 as a publicity stunt for a silent cinema. Priya scanned brittle programmes advertising matinee prices in cents. She published a short article arguing the city's heritage walk should include the cinema site, not only the fountain, because stories travel with money and brick, not just water."),
]

ENG_Q = [
    ("q1", "p1", "A seed library differs from a shop because patrons —", "borrow seeds and return seeds from later harvests", ["buy seeds permanently", "only read about plants", "trade books for money"]),
    ("q2", "p1", "Early planting failures led Kai to —", "add a soil thermometer loan program", ["close the library", "stop labeling envelopes", "ban tomatoes"]),
    ("q3", "p1", "Heirloom varieties entered the catalog when —", "elderly gardeners shared seeds they had saved for years", ["the frost ended", "Kai false-started", "invoices were unpaid"]),
    ("q4", "p1", "By the third year, returned seeds were —", "twice the number taken out", ["half the number taken out", "exactly equal to books checked out", "unused"]),
    ("q5", "p1", "Frost warnings on envelopes helped families —", "avoid planting too early", ["run faster", "find theatre contracts", "measure moths"]),
    ("q6", "p2", "Dina's starts improved when she —", "counted breaths instead of watching rivals", ["skipped sleep", "lengthened her first stride", "stared at moths"]),
    ("q7", "p2", "Film showed Dina's problem was —", "her rear foot lifting slightly too early", ["officials denying a trial", "long jump shoes", "ledger dust"]),
    ("q8", "p2", "Alvarez and Dina changed her first stride to —", "keep her torso lower", ["raise her torso", "slow the long jump", "plant seeds earlier"]),
    ("q9", "p2", "Dina's notebook linked performance to —", "sleep hours around exam weeks", ["brick suppliers", "seed envelopes", "1924 postcards"]),
    ("q10", "p2", "After the denied time trial, Dina —", "set a personal best in the long jump", ["quit track", "opened a seed library", "published about fountains"]),
    ("q11", "p3", "Priya noticed the fountain on —", "a 1924 postcard missing from an 1898 map", ["a seed envelope", "a track starting block", "a soil thermometer"]),
    ("q12", "p3", "Tax records helped her connect —", "brick suppliers to a cancelled theatre", ["moths to sleep", "tomatoes to frost", "runners to breath counts"]),
    ("q13", "p3", "Invoices showed the fountain was built in 1911 to —", "promote a silent cinema", ["water seed libraries", "time sprinters", "repair ledgers"]),
    ("q14", "p3", "Priya argued the heritage walk should include —", "the cinema site as well as the fountain", ["only the fountain", "only moths", "only district meets"]),
    ("q15", "p3", "Her article stressed that stories follow —", "money and brick, not just water", ["only athletic drills", "only planting dates", "only unpaid fines"]),
]

# --- 79 Data ★3 ---
DATA1_PASSAGES = [
    passage("p1", "Monthly savings",
        body="Four students tracked rupees saved per month.",
        chart={"type": "bar", "title": "Savings (₹)", "labels": ["Ira", "Jay", "Kim", "Leo"],
               "values": [450, 620, 380, 550], "xLabel": "Student", "yLabel": "₹"}),
    passage("p2", "Transport to school",
        body="How 120 students travel to school.",
        chart={"type": "pie", "title": "Transport mode", "labels": ["Walk", "Bus", "Cycle", "Car"], "values": [35, 40, 30, 15]}),
    passage("p3", "Plant height",
        body="Height of a bean plant over five weeks (cm).",
        chart={"type": "line", "title": "Plant height", "labels": ["W1", "W2", "W3", "W4", "W5"],
               "values": [4, 9, 15, 22, 28], "xLabel": "Week", "yLabel": "cm"}),
]

DATA1_Q = [
    ("q1", "p1", "Who saved the most?", "Jay", ["Ira", "Kim", "Leo"]),
    ("q2", "p1", "How much did Kim save?", "₹380", ["₹450", "₹550", "₹620"]),
    ("q3", "p1", "How much more did Jay save than Kim?", "₹240", ["₹170", "₹200", "₹280"]),
    ("q4", "p1", "Total savings of all four?", "₹2000", ["₹1900", "₹2100", "₹1800"]),
    ("q5", "p1", "Leo saved how much more than Ira?", "₹100", ["₹80", "₹120", "₹170"]),
    ("q6", "p2", "Which mode is most common?", "Bus", ["Walk", "Cycle", "Car"]),
    ("q7", "p2", "How many students walk?", "35", ["40", "30", "15"]),
    ("q8", "p2", "Walk and cycle together are what fraction of 120?", "13/24", ["1/3", "1/2", "7/12"]),
    ("q9", "p2", "How many more take the bus than a car?", "25", ["20", "30", "15"]),
    ("q10", "p2", "Car riders are what percent of 120?", "12.5%", ["15%", "10%", "25%"]),
    ("q11", "p3", "In which week was height 15 cm?", "W3", ["W2", "W4", "W5"]),
    ("q12", "p3", "Growth from W1 to W5?", "24 cm", ["20 cm", "28 cm", "22 cm"]),
    ("q13", "p3", "Average weekly growth W1→W5 (over 4 intervals)?", "6 cm", ["5 cm", "7 cm", "4 cm"]),
    ("q14", "p3", "Which week-to-week jump was largest?", "W3 to W4", ["W1 to W2", "W2 to W3", "W4 to W5"]),
    ("q15", "p3", "Height at W4 was how much more than W2?", "13 cm", ["10 cm", "15 cm", "11 cm"]),
]

# --- 80 Data ★3 set 2 ---
DATA2_PASSAGES = [
    passage("p1", "Quiz scores",
        body="Team scores out of 40.",
        chart={"type": "bar", "title": "Team average", "labels": ["Red", "Blue", "Green", "Gold"],
               "values": [32, 28, 35, 30], "xLabel": "Team", "yLabel": "Score"}),
    passage("p2", "Library loans",
        body="Books borrowed in one month by category.",
        chart={"type": "pie", "title": "Loans by category", "labels": ["Fiction", "Science", "History", "Other"], "values": [90, 60, 45, 45]}),
    passage("p3", "Temperature week",
        body="Daily high (°C) for seven days.",
        chart={"type": "line", "title": "Daily high", "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
               "values": [22, 25, 27, 24, 29, 31, 28], "xLabel": "Day", "yLabel": "°C"}),
]

DATA2_Q = [
    ("q1", "p1", "Which team scored highest?", "Green", ["Red", "Blue", "Gold"]),
    ("q2", "p1", "Blue team's score?", "28", ["30", "32", "35"]),
    ("q3", "p1", "Green beat Red by how many points?", "3", ["2", "4", "7"]),
    ("q4", "p1", "Mean of the four team scores?", "31.25", ["30", "32", "31"]),
    ("q5", "p1", "How many teams scored at least 30?", "3", ["2", "4", "1"]),
    ("q6", "p2", "Largest category?", "Fiction", ["Science", "History", "Other"]),
    ("q7", "p2", "Science loans as fraction of total?", "1/4", ["1/3", "3/10", "2/5"]),
    ("q8", "p2", "History and Other combined?", "90", ["80", "100", "105"]),
    ("q9", "p2", "How many more Fiction than Science?", "30", ["25", "35", "45"]),
    ("q10", "p2", "Total loans?", "240", ["220", "260", "200"]),
    ("q11", "p3", "Highest daily high?", "31°C on Saturday", ["29°C Friday", "28°C Sunday", "27°C Wednesday"]),
    ("q12", "p3", "Wed to Fri change?", "2°C increase", ["3°C drop", "5°C increase", "No change"]),
    ("q13", "p3", "Sum Mon–Fri highs?", "127°C", ["125°C", "130°C", "120°C"]),
    ("q14", "p3", "Sat was how much warmer than Mon?", "9°C", ["7°C", "8°C", "6°C"]),
    ("q15", "p3", "Which day was 2°C cooler than Thursday?", "Monday", ["Tuesday", "Sunday", "Wednesday"]),
]

# Fix q11 answer to match choices style - use "Saturday" or "31°C"
DATA2_Q[10] = ("q11", "p3", "On which day was the high 31°C?", "Saturday", ["Friday", "Sunday", "Wednesday"])

# --- 81 Biology ★3 ---
BIOLOGY = [
    ("q1", "The basic unit of life is the —", "cell", ["tissue", "organ", "organ system"]),
    ("q2", "Which organelle is called the powerhouse of the cell?", "Mitochondria", ["Nucleus", "Cell wall", "Chloroplast in animals"]),
    ("q3", "Plants make food by —", "photosynthesis", ["respiration only", "digestion", "circulation"]),
    ("q4", "The green pigment in leaves is —", "chlorophyll", ["hemoglobin", "melanin", "cellulose"]),
    ("q5", "Which blood vessel carries blood away from the heart?", "Artery", ["Vein", "Capillary only", "Valve"]),
    ("q6", "The human heart has how many chambers?", "4", ["2", "3", "6"]),
    ("q7", "Which system breaks down food into absorbable nutrients?", "Digestive system", ["Respiratory system", "Skeletal system", "Nervous system"]),
    ("q8", "Exchange of gases in humans mainly happens in the —", "lungs", ["stomach", "bones", "skin only"]),
    ("q9", "Which part of the brain helps with balance?", "Cerebellum", ["Cerebrum only", "Spinal cord tip", "Rib cage"]),
    ("q10", "Xylem in plants mainly transports —", "water and minerals", ["sugar only", "oxygen in blood", "waste in urine"]),
    ("q11", "A group of similar cells doing one job is a —", "tissue", ["organ", "organism", "molecule"]),
    ("q12", "Which is a vertebrate?", "Fish", ["Insect", "Jellyfish", "Spider"]),
    ("q13", "Vaccines help the body —", "develop immunity to diseases", ["digest faster", "grow taller instantly", "produce chlorophyll"]),
    ("q14", "Decomposers such as fungi —", "break down dead matter", ["only eat living prey", "make oxygen in lungs", "pump blood"]),
    ("q15", "Stomata on leaves mainly allow —", "gas exchange", ["blood flow", "bone growth", "sound production"]),
]


def main():
    assert all(len(x) == COUNT for x in [ALGEBRA, PRACT_GEOM, ENG_Q, DATA1_Q, DATA2_Q, BIOLOGY])

    write("questions_76", {
        "title": "Math — Algebra (NCERT)",
        "subject": "math",
        "content_badge": "NCERT",
        "learn_subject": "math-ncert-g6",
        "learn_section": "ncert-ch11-algebra",
        "scratchpad": True,
    }, None, build(ALGEBRA, 76))

    write("questions_77", {
        "title": "Math — Practical geometry (NCERT)",
        "subject": "math",
        "content_badge": "NCERT",
        "learn_subject": "math-ncert-g6",
        "learn_section": "ncert-ch14-practical-geometry",
        "scratchpad": True,
    }, None, build(PRACT_GEOM, 77))

    write("questions_78", {
        "title": "English — Reading comprehension (hard)",
        "subject": "english",
        "scratchpad": False,
    }, ENG_PASSAGES, build(ENG_Q, 78))

    write("questions_79", {
        "title": "Data analysis — Mixed charts (hard)",
        "subject": "data",
        "scratchpad": True,
        "learn_subject": "math",
        "learn_section": "data-graphs",
    }, DATA1_PASSAGES, build(DATA1_Q, 79))

    write("questions_80", {
        "title": "Data analysis — Trends & comparisons (hard)",
        "subject": "data",
        "scratchpad": True,
        "learn_subject": "math",
        "learn_section": "data-graphs",
    }, DATA2_PASSAGES, build(DATA2_Q, 80))

    write("questions_81", {
        "title": "Science — Biology (hard)",
        "subject": "science",
        "scratchpad": True,
    }, None, build(BIOLOGY, 81))


if __name__ == "__main__":
    main()
