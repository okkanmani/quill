#!/usr/bin/env python3
"""Generate questions_109.json – questions_112.json (Grade 6 Ontario timed sets)."""

import json
from datetime import datetime, timezone
from pathlib import Path

WORKSHEETS = Path(__file__).resolve().parents[1] / "data" / "worksheets"
NOW = datetime.now(timezone.utc).isoformat()
TIMED = {"timed": True, "time_limit_minutes": 30}


def mcq(qid, prompt, answer, choices, stars=3, area=None, passage_id=None):
    q = {
        "id": qid,
        "type": "multiple_choice",
        "stars": stars,
        "prompt": prompt,
        "choices": choices,
        "answer": answer,
        "hint": False,
    }
    if area:
        q["area"] = area
    if passage_id:
        q["passage_id"] = passage_id
    return q


def write(name, data):
    path = WORKSHEETS / name
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {path.name} ({len(data['questions'])} questions)")


def build_math_109():
    qs = [
        mcq("q1", "Evaluate: 24 − 2 × (3 + 5)²", "−104", ["−104", "16", "88", "−88"], area="numbers"),
        mcq("q2", "Solve for x: 3x + 7 = 34", "9", ["9", "11", "7", "8"], area="algebra"),
        mcq("q3", "What is 3/4 ÷ 2/5?", "15/8", ["15/8", "6/20", "5/6", "8/15"], area="numbers"),
        mcq("q4", "A parallelogram has base 12 cm and height 8 cm. What is its area?", "96 cm²", ["96 cm²", "40 cm²", "48 cm²", "192 cm²"], area="geometry"),
        mcq("q5", "After a 15% discount, a jacket costs $68. What was the original price?", "$80", ["$80", "$78.20", "$58.80", "$85"], area="numbers"),
        mcq("q6", "What is the least common multiple of 15 and 20?", "60", ["60", "5", "300", "35"], area="numbers"),
        mcq("q7", "What is the greatest common factor of 48 and 72?", "24", ["24", "12", "8", "6"], area="numbers"),
        mcq("q8", "Compute: 6.5 × 0.8", "5.2", ["5.2", "52", "5.02", "6.13"], area="numbers"),
        mcq("q9", "A cube has edge length 4 cm. What is its volume?", "64 cm³", ["64 cm³", "16 cm³", "48 cm³", "12 cm³"], area="geometry"),
        mcq("q10", "What is the mean of 6, 10, 14, and 18?", "12", ["12", "11", "13", "14"], area="numbers"),
        mcq("q11", "Five notebooks cost $12.50. At the same rate, how much do 8 notebooks cost?", "$20", ["$20", "$17.50", "$22.50", "$25"], area="numbers"),
        mcq("q12", "A recipe uses flour and sugar in ratio 5 : 2. If you use 350 g flour, how much sugar is needed?", "140 g", ["140 g", "175 g", "100 g", "875 g"], area="numbers"),
        mcq("q13", "Two angles are complementary. One measures 38°. What is the other?", "52°", ["52°", "142°", "48°", "62°"], area="geometry"),
        mcq("q14", "What is 45% of 320?", "144", ["144", "128", "160", "136"], area="numbers"),
        mcq("q15", "Compute: (−8) + 15 − (−3)", "10", ["10", "−26", "4", "−4"], area="numbers"),
        mcq("q16", "Simplify: 2(3x + 4) − 5x", "x + 8", ["x + 8", "6x + 8", "x − 8", "11x + 8"], area="algebra"),
        mcq("q17", "An isosceles triangle has two equal sides of 13 cm and base 10 cm. What is its perimeter?", "36 cm", ["36 cm", "26 cm", "33 cm", "23 cm"], area="geometry"),
        mcq("q18", "What is 7/8 − 1/3?", "13/24", ["13/24", "6/5", "1/2", "5/24"], area="numbers"),
        mcq("q19", "A train travels 240 km in 3 hours. What is its average speed?", "80 km/h", ["80 km/h", "720 km/h", "60 km/h", "120 km/h"], area="numbers"),
        mcq("q20", "A circle has diameter 14 cm. Using π = 22/7, what is the area?", "154 cm²", ["154 cm²", "44 cm²", "616 cm²", "77 cm²"], area="geometry"),
    ]
    write(
        "questions_109.json",
        {
            "title": "Math — Grade 6 Ontario (timed, 30 min, ★★★)",
            "subject": "math",
            "scratchpad": True,
            "created_at": NOW,
            "questions": qs,
            **TIMED,
        },
    )


def build_science_110():
    qs = [
        mcq("q1", "During photosynthesis, plants release which gas into the air?", "Oxygen", ["Oxygen", "Carbon monoxide", "Nitrogen only", "Helium"]),
        mcq("q2", "In a series circuit with one burned-out bulb, the other bulbs —", "also go out because the path is broken", ["also go out because the path is broken", "become brighter", "stay lit if wired in parallel", "produce more voltage"]),
        mcq("q3", "Biodiversity in an ecosystem refers to —", "the variety of living species and their interactions", ["the variety of living species and their interactions", "only the number of trees", "how much rain falls", "the speed of wind"]),
        mcq("q4", "Burning wood to ash is best classified as —", "a chemical change", ["a chemical change", "a physical change only", "evaporation", "condensation"]),
        mcq("q5", "The small intestine’s main role in digestion is to —", "absorb nutrients into the bloodstream", ["absorb nutrients into the bloodstream", "exchange oxygen and carbon dioxide", "pump blood to the brain", "filter waste into urine only"]),
        mcq("q6", "Which instrument measures atmospheric pressure?", "Barometer", ["Barometer", "Anemometer", "Graduated cylinder", "Meter stick"]),
        mcq("q7", "Compared with weather, climate describes —", "long-term patterns over many years", ["long-term patterns over many years", "today’s temperature only", "a single thunderstorm", "wind direction at one moment"]),
        mcq("q8", "Removing decomposers from a forest would most likely —", "slow nutrient recycling in the soil", ["slow nutrient recycling in the soil", "increase oxygen in rocks", "stop Earth’s rotation", "create new species instantly"]),
        mcq("q9", "A balloon sticks to a wall after rubbing because —", "electrons transferred, creating opposite charges that attract", ["electrons transferred, creating opposite charges that attract", "gravity disappears", "air pressure becomes zero", "the wall becomes magnetic forever"]),
        mcq("q10", "Water that falls as rain or snow is called —", "precipitation", ["precipitation", "evaporation", "transpiration only", "condensation only"]),
        mcq("q11", "Which force opposes forward motion of an airplane through the air?", "Drag", ["Drag", "Lift", "Weight only", "Thrust only"]),
        mcq("q12", "Solar panels use a — energy source.", "renewable", ["renewable", "non-renewable fossil", "nuclear only", "single-use chemical"]),
        mcq("q13", "We see moon phases because —", "the angle between Sun, Moon, and Earth changes as the Moon orbits", ["the angle between Sun, Moon, and Earth changes as the Moon orbits", "the Moon produces its own sunlight", "Earth’s shadow never affects the Moon", "the Moon stops rotating each month"]),
        mcq("q14", "An organism’s niche is best described as —", "its role in the ecosystem, including food and habitat use", ["its role in the ecosystem, including food and habitat use", "only the place it sleeps", "the colour of its fur", "how fast it runs once"]),
        mcq("q15", "A fixed pulley mainly helps by —", "changing the direction of the applied force", ["changing the direction of the applied force", "doubling the weight of the load", "eliminating friction completely", "creating energy"]),
        mcq("q16", "Copper wire is used in circuits because it —", "conducts electricity well", ["conducts electricity well", "blocks all electron flow", "is always an insulator", "melts at room temperature"]),
        mcq("q17", "In a food web, energy from the Sun is first captured by —", "producers such as plants", ["producers such as plants", "top predators only", "decomposers only", "rocks and minerals"]),
        mcq("q18", "A student measures daily highs for two weeks and calls it “Toronto’s climate.” The best critique is —", "climate needs long-term data, not just two weeks", ["climate needs long-term data, not just two weeks", "two weeks is always enough", "temperature cannot be measured", "climate means one rainy day"]),
        mcq("q19", "Which planet is known for its prominent ring system?", "Saturn", ["Saturn", "Mercury", "Venus", "Mars"]),
        mcq("q20", "Building roads through a wetland most directly threatens biodiversity by —", "destroying habitats and fragmenting populations", ["destroying habitats and fragmenting populations", "increasing photosynthesis rates only", "adding oxygen to space", "cooling the inner core of Earth"]),
    ]
    write(
        "questions_110.json",
        {
            "title": "Science — Grade 6 Ontario (timed, 30 min, ★★★)",
            "subject": "science",
            "scratchpad": False,
            "created_at": NOW,
            "questions": qs,
            **TIMED,
        },
    )


def build_english_111():
    passages = [
        {
            "id": "p1",
            "title": "The seed library",
            "body": "When the public library added a seed cabinet beside the cookbook shelves, some patrons laughed. Others signed up immediately. Cardholders could borrow heirloom tomato, bean, and sunflower packets, grow the plants, and return seeds from the healthiest crops in labelled envelopes. Librarian Mr. Okafor explained that the program preserved local varieties adapted to short summers while teaching food literacy.\n\nCritics worried borrowers would forget to return seeds or plant nothing at all. Okafor tracked data: seventy-two percent returned seeds within a year, and workshop attendance tripled. Students mapped which neighbourhoods had community garden plots and which had only pavement. The seed library, Okafor argued, was not a gimmick—it was a way to keep knowledge circulating the way stories do when people share books.",
        },
        {
            "id": "p2",
            "title": "The transit survey",
            "body": "City planners posted an online survey asking residents which bus route needed evening service. Within a week, 1,200 people responded, and Route 18 won by a wide margin. The mayor announced the result as proof that democracy works.\n\nTransportation analyst Priya Nair noted the survey reached mostly people with home internet and time to answer during the day. Night-shift hospital workers, who relied on Route 18 after midnight, were underrepresented. Nair recommended combining survey results with automatic passenger counters already installed on buses. The mayor agreed to pilot counters on Route 18 before adding trips, saying good decisions need more than loud voices—they need representative data.",
        },
        {
            "id": "p3",
            "title": "The debate club rule",
            "body": "Debate club adopted a new rule: speakers must restate an opponent’s point in their own words before offering a rebuttal. At first, meetings ran long. Then members noticed fewer shouting matches. Captain Lina said the rule slowed people down just enough to listen.",
        },
    ]
    qs = [
        mcq("q1", "The seed library differs from traditional book lending because borrowers are expected to —", "return seeds from plants they grew", ["return seeds from plants they grew", "keep all packets permanently", "sell seeds for profit", "avoid planting anything"], passage_id="p1"),
        mcq("q2", "Mr. Okafor’s main goal includes preserving —", "local plant varieties suited to short summers", ["local plant varieties suited to short summers", "only imported flowers", "pavement gardens", "library fines"], passage_id="p1"),
        mcq("q3", "Critics initially feared borrowers would —", "forget to return seeds or not plant them", ["forget to return seeds or not plant them", "read too many cookbooks", "remove bus routes", "stop workshops entirely"], passage_id="p1"),
        mcq("q4", "The phrase “knowledge circulating” suggests seeds and stories both —", "spread and remain available when shared", ["spread and remain available when shared", "disappear after one use", "belong only to experts", "replace all public libraries"], passage_id="p1"),
        mcq("q5", "Students mapping garden plots versus pavement most directly supported —", "understanding which neighbourhoods could use the program", ["understanding which neighbourhoods could use the program", "counting library chairs", "designing bus schedules", "measuring tomato mass only"], passage_id="p1"),
        mcq("q6", "Seventy-two percent returning seeds mainly shows —", "most participants followed through on the program", ["most participants followed through on the program", "the program failed", "workshops were cancelled", "heirloom plants cannot grow"], passage_id="p1"),
        mcq("q7", "The mayor treated the survey as proof that —", "residents’ preferences were heard through voting", ["residents’ preferences were heard through voting", "internet access is unnecessary", "Route 18 had no night riders", "counters should be removed"], passage_id="p2"),
        mcq("q8", "Nair’s main concern about the survey was that it —", "underrepresented people without daytime internet access", ["underrepresented people without daytime internet access", "included too many hospital workers", "lasted more than one week", "counted passengers automatically"], passage_id="p2"),
        mcq("q9", "Night-shift workers were especially relevant because they —", "needed Route 18 service after midnight", ["needed Route 18 service after midnight", "designed the online form", "opposed all buses", "worked only online"], passage_id="p2"),
        mcq("q10", "Nair recommended passenger counters because they —", "provide data from actual ridership, not only survey replies", ["provide data from actual ridership, not only survey replies", "replace all drivers", "eliminate the need for routes", "publish mayor speeches"], passage_id="p2"),
        mcq("q11", "The mayor’s final decision was to —", "pilot counters on Route 18 before adding evening trips", ["pilot counters on Route 18 before adding evening trips", "cancel Route 18 immediately", "ignore Nair’s advice", "survey only daytime riders again"], passage_id="p2"),
        mcq("q12", "The debate rule requires speakers to —", "summarize an opponent’s view before rebutting", ["summarize an opponent’s view before rebutting", "speak without listening", "avoid rebuttals entirely", "interrupt after five seconds"], passage_id="p3"),
        mcq("q13", "Lina believed the rule reduced shouting because it —", "forced members to slow down and listen", ["forced members to slow down and listen", "banned all disagreements", "shortened every meeting", "removed captains from clubs"], passage_id="p3"),
        mcq("q14", "Choose the best revision: \"Me and Jada was late because the streetcar don't arrive.\"", "Jada and I were late because the streetcar did not arrive", ["Jada and I were late because the streetcar did not arrive", "Me and Jada was late because the streetcar don't arrive", "Jada and I is late because the streetcar didn't arrived", "Jada and me were late because the streetcar don't arrived"], area="grammar"),
        mcq("q15", "Choose the best revision: \"Running for the train, my phone fell onto the platform.\"", "As I ran for the train, my phone fell onto the platform", ["As I ran for the train, my phone fell onto the platform", "Running for the train, the phone fell onto the platform", "Running for the train, the platform dropped my phone", "Running for the train, the train fell my phone"], area="grammar"),
        mcq("q16", "Choose the best revision: \"Neither the coaches nor the goalie are ready for overtime.\"", "Neither the coaches nor the goalie is ready for overtime", ["Neither the coaches nor the goalie is ready for overtime", "Neither the coaches nor the goalie are ready for overtime", "Neither the coach nor the goalies is ready for overtime", "Neither the coaches or the goalie is ready for overtime"], area="grammar"),
        mcq("q17", "Choose the best revision: \"The team have practiced, but the schedule don't list our game.\"", "The team has practiced, but the schedule does not list our game", ["The team has practiced, but the schedule does not list our game", "The team have practiced, but the schedule doesn't list our game", "The team has practiced, but the schedule don't list our game", "The team have practiced, but the schedule doesn't lists our game"], area="grammar"),
        mcq("q18", "Argument: \"Our juice must be healthy because athletes drink it on TV.\" The flaw is —", "famous users do not prove a product is healthy for everyone", ["famous users do not prove a product is healthy for everyone", "television always lies", "juice cannot be sold in bottles", "athletes never drink water"], area="grammar"),
        mcq("q19", "Which title best fits passage 2?", "Listening Beyond the Loudest Survey Answers", ["Listening Beyond the Loudest Survey Answers", "Why Libraries Should Lend Buses", "How to Forget Route Numbers", "Tomatoes on City Hall Steps"], passage_id="p2"),
        mcq("q20", "Across all three passages, successful groups improve decisions by —", "combining listening with evidence beyond first impressions", ["combining listening with evidence beyond first impressions", "avoiding all rules and data", "speaking loudest first", "ignoring underrepresented voices"], passage_id="p1"),
    ]
    write(
        "questions_111.json",
        {
            "title": "English — Grade 6 Ontario (timed, 30 min, ★★★)",
            "subject": "english",
            "scratchpad": False,
            "created_at": NOW,
            "passages": passages,
            "questions": qs,
            **TIMED,
        },
    )


def build_data_112():
    passages = [
        {
            "id": "p1",
            "title": "Basketball free throws",
            "body": "Successful free throws in practice (out of 20 attempts) for four players.",
            "chart": {
                "type": "bar",
                "title": "Free throws made",
                "labels": ["Ava", "Ben", "Cara", "Dev"],
                "values": [16, 12, 18, 14],
                "xLabel": "Player",
                "yLabel": "Made / 20",
            },
        },
        {
            "id": "p2",
            "title": "Lunch waste audit",
            "body": "Fraction of lunch waste by category from a one-day school audit (120 kg total).",
            "chart": {
                "type": "pie",
                "title": "Waste by category",
                "labels": ["Fruit/veg", "Bread", "Packaging", "Other"],
                "values": [30, 24, 42, 24],
            },
        },
        {
            "id": "p3",
            "title": "Temperature during field trip",
            "body": "Air temperature (°C) recorded each hour from 9 a.m. to 2 p.m.",
            "chart": {
                "type": "line",
                "title": "Hourly temperature",
                "labels": ["9", "10", "11", "12", "1", "2"],
                "values": [12, 15, 18, 21, 20, 17],
                "xLabel": "Hour",
                "yLabel": "°C",
            },
        },
        {
            "id": "p4",
            "title": "Library visits by grade",
            "body": "Number of student library visits last month.",
            "table": {
                "headers": ["Grade", "Students", "Total visits", "Mean visits per student"],
                "rows": [
                    ["5", "80", "320", "4.0"],
                    ["6", "75", "450", "6.0"],
                    ["7", "70", "420", "6.0"],
                    ["8", "65", "325", "5.0"],
                ],
            },
        },
    ]
    qs = [
        mcq("q1", "Who made the most free throws?", "Cara", ["Cara", "Ava", "Dev", "Ben"], passage_id="p1", area="data"),
        mcq("q2", "How many more free throws did Cara make than Ben?", "6", ["6", "4", "8", "2"], passage_id="p1", area="data"),
        mcq("q3", "What is the mean number of free throws made by the four players?", "15", ["15", "14", "16", "60"], passage_id="p1", area="data"),
        mcq("q4", "Ava made what percent of her 20 attempts?", "80%", ["80%", "75%", "16%", "20%"], passage_id="p1", area="data"),
        mcq("q5", "Which waste category is largest?", "Packaging", ["Packaging", "Fruit/veg", "Bread", "Other"], passage_id="p2", area="data"),
        mcq("q6", "How many kg of packaging waste were collected?", "42 kg", ["42 kg", "30 kg", "24 kg", "120 kg"], passage_id="p2", area="data"),
        mcq("q7", "Fruit/vegetable waste is what fraction of the total?", "1/4", ["1/4", "1/3", "1/5", "2/5"], passage_id="p2", area="data"),
        mcq("q8", "Packaging waste is what percent of the total? (nearest whole percent)", "35%", ["35%", "30%", "42%", "25%"], passage_id="p2", area="data"),
        mcq("q9", "What was the highest temperature recorded?", "21°C", ["21°C", "20°C", "18°C", "17°C"], passage_id="p3", area="data"),
        mcq("q10", "From 11 a.m. to 1 p.m., temperature changed by how many degrees?", "2°C", ["2°C", "3°C", "−1°C", "5°C"], passage_id="p3", area="data"),
        mcq("q11", "During which one-hour period did temperature drop?", "1 p.m. to 2 p.m.", ["1 p.m. to 2 p.m.", "9 a.m. to 10 a.m.", "10 a.m. to 11 a.m.", "11 a.m. to 12 p.m."], passage_id="p3", area="data"),
        mcq("q12", "What is the range of temperatures shown?", "9°C", ["9°C", "12°C", "21°C", "6°C"], passage_id="p3", area="data"),
        mcq("q13", "Which grade had the highest total library visits?", "6", ["6", "7", "5", "8"], passage_id="p4", area="data"),
        mcq("q14", "How many students are listed across all four grades?", "290", ["290", "280", "300", "275"], passage_id="p4", area="data"),
        mcq("q15", "Grade 5’s mean visits per student is how many below grade 6’s mean?", "2.0", ["2.0", "1.0", "3.0", "0.5"], passage_id="p4", area="data"),
        mcq("q16", "What is the total library visits for grades 6 and 7 combined?", "870", ["870", "840", "900", "770"], passage_id="p4", area="data"),
        mcq("q17", "If grade 8 visits increased by 20% next month, about how many visits would that be?", "390", ["390", "325", "350", "400"], passage_id="p4", area="data"),
        mcq("q18", "Which player is closest to the group mean for free throws?", "Dev", ["Dev", "Ben", "Cara", "Ava"], passage_id="p1", area="data"),
        mcq("q19", "Bread and Other waste combined are what percent of total? (nearest whole percent)", "40%", ["40%", "20%", "50%", "35%"], passage_id="p2", area="data"),
        mcq("q20", "At noon (12), temperature was how many degrees above the 9 a.m. reading?", "9°C", ["9°C", "12°C", "3°C", "21°C"], passage_id="p3", area="data"),
    ]
    write(
        "questions_112.json",
        {
            "title": "Data analysis — Grade 6 Ontario (timed, 30 min, ★★★)",
            "subject": "data",
            "learn_subject": "math",
            "learn_section": "data-graphs",
            "scratchpad": True,
            "created_at": NOW,
            "passages": passages,
            "questions": qs,
            **TIMED,
        },
    )


if __name__ == "__main__":
    build_math_109()
    build_science_110()
    build_english_111()
    build_data_112()
