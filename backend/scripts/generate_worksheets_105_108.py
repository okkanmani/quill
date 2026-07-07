#!/usr/bin/env python3
"""Generate questions_105.json – questions_108.json."""

import json
from datetime import datetime, timezone
from pathlib import Path

WORKSHEETS = Path(__file__).resolve().parents[1] / "data" / "worksheets"
NOW = datetime.now(timezone.utc).isoformat()


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


def build_math_105():
    qs = [
        mcq("q1", "Evaluate: 18 − 3 × (4 + 2)", "0", ["0", "90", "12", "6"], area="numbers"),
        mcq("q2", "Solve for n: 5n − 11 = 34", "9", ["9", "7", "8", "5"], area="algebra"),
        mcq("q3", "What is 2/3 ÷ 5/6?", "4/5", ["4/5", "5/4", "10/18", "2/5"], area="numbers"),
        mcq("q4", "A triangle has base 14 cm and height 9 cm. What is its area?", "63 cm²", ["63 cm²", "126 cm²", "23 cm²", "126 cm"], area="geometry"),
        mcq("q5", "After a 20% increase, a price is $96. What was the original price?", "$80", ["$80", "$76.80", "$100", "$86"], area="numbers"),
        mcq("q6", "What is the least common multiple of 12 and 18?", "36", ["36", "6", "72", "216"], area="numbers"),
        mcq("q7", "What is the greatest common factor of 54 and 81?", "27", ["27", "9", "18", "3"], area="numbers"),
        mcq("q8", "Compute: 4.25 × 3.2", "13.6", ["13.6", "12.8", "14.2", "13.05"], area="numbers"),
        mcq("q9", "A rectangular prism is 5 cm × 6 cm × 7 cm. What is its volume?", "210 cm³", ["210 cm³", "18 cm³", "105 cm³", "35 cm³"], area="geometry"),
        mcq("q10", "What is the mean of 8, 11, 15, and 18?", "13", ["13", "12", "13.5", "14"], area="numbers"),
        mcq("q11", "Four notebooks cost $13.60. At the same rate, how much do 9 notebooks cost?", "$30.60", ["$30.60", "$27.20", "$34.00", "$36.40"], area="numbers"),
        mcq("q12", "A ratio of red to blue beads is 5 : 7. If there are 48 beads total, how many are red?", "20", ["20", "28", "24", "15"], area="numbers"),
        mcq("q13", "Two angles are supplementary. One measures 118°. What is the other?", "62°", ["62°", "72°", "58°", "118°"], area="geometry"),
        mcq("q14", "What is 37.5% of 240?", "90", ["90", "80", "96", "108"], area="numbers"),
        mcq("q15", "Compute: (−6) + (−4) − (−9)", "−1", ["−1", "−19", "1", "−5"], area="numbers"),
        mcq("q16", "Simplify: 3(2x − 5) + 4x", "10x − 15", ["10x − 15", "10x − 5", "6x − 15", "5x − 15"], area="algebra"),
        mcq("q17", "A rectangle has length 17 cm and width 11 cm. What is its perimeter?", "56 cm", ["56 cm", "187 cm", "34 cm", "28 cm"], area="geometry"),
        mcq("q18", "What is 5/6 − 1/4?", "7/12", ["7/12", "4/10", "1/2", "11/12"], area="numbers"),
        mcq("q19", "A cyclist travels at 18 km/h for 2.5 hours. How far does she travel?", "45 km", ["45 km", "36 km", "20.5 km", "40 km"], area="numbers"),
        mcq("q20", "A circle has radius 7 cm. Using π = 22/7, what is the circumference?", "44 cm", ["44 cm", "154 cm", "22 cm", "49 cm"], area="geometry"),
        mcq("q21", "What is the median of 4, 9, 11, 11, 15?", "11", ["11", "10", "9", "11.5"], area="numbers"),
        mcq("q22", "Express 0.375 as a fraction in simplest form.", "3/8", ["3/8", "375/1000", "3/5", "5/8"], area="numbers"),
        mcq("q23", "A rectangle’s width is w cm. Its length is 2w + 5 cm. The perimeter is 58 cm. Find w.", "8", ["8", "12", "6", "10"], area="algebra"),
        mcq("q24", "Evaluate: 2⁴ + 3² − 5", "20", ["20", "18", "22", "14"], area="numbers"),
        mcq("q25", "A jacket priced at $85 is discounted by 30%. What is the sale price?", "$59.50", ["$59.50", "$55.00", "$25.50", "$60.00"], area="numbers"),
        mcq("q26", "How many integers n satisfy −3 < n ≤ 4?", "7", ["7", "8", "6", "5"], area="numbers"),
        mcq("q27", "A bag has 3 red, 5 blue, and 2 green marbles. What is P(not green)?", "4/5", ["4/5", "2/5", "3/5", "1/2"], area="data"),
        mcq("q28", "Solve for y: 4(y − 3) = 2y + 10", "11", ["11", "8", "9", "7"], area="algebra"),
        mcq("q29", "The angles of a triangle are x°, 2x°, and 3x°. What is x?", "30", ["30", "60", "90", "45"], area="geometry"),
        mcq("q30", "A store marks up cost by 40% to set the price, then offers 25% off that price. If cost is $50, what is the final price?", "$52.50", ["$52.50", "$50.00", "$57.50", "$45.00"], area="numbers"),
    ]
    write(
        "questions_105.json",
        {
            "title": "Math — Grade 6 challenge mix (timed, ★★★)",
            "subject": "math",
            "timed": True,
            "time_limit_minutes": 45,
            "scratchpad": True,
            "created_at": NOW,
            "questions": qs,
        },
    )


def build_english_rc_106():
    passages = [
        {
            "id": "p1",
            "title": "The community solar garden",
            "body": "When the old factory lot sat empty for a decade, neighbours argued about whether to sell it for apartments or turn it into something shared. Ms. Delgado, a science teacher, proposed a community solar garden: rows of panels on raised frames with walkways between them so people could still gather. Families could buy a share of the output and receive credits on their electricity bills. Skeptics said winter sun was too weak and snow would bury the panels. Delgado's students measured sunlight across seasons and built scale models showing how tilted panels shed snow faster than flat ones.\n\nThe city council approved a pilot with strict rules: at least forty percent of shares had to go to households earning below the median income, and a youth crew would maintain the beds of native plants installed between the rows. By the second summer, the garden produced enough power for twelve homes, and the student crew published a plain-language guide other towns copied. Delgado insisted the project was never only about watts; it was about who gets a voice when infrastructure is planned.",
        },
        {
            "id": "p2",
            "title": "Letters from the trail",
            "body": "In 1912, postal clerk Hiram Okonkwo hiked ridge routes too steep for wagons, carrying mail in waxed satchels. His letters home describe frost on his beard by dawn and sandstone that \"hummed\" when wind passed through slots. One entry tells of a stranded pianist who played scales until mules arrived, calming skittish horses. Okonkwo counted steps on a switchback—four hundred twelve from creek to crest—and noted how his pace slowed when he memorized new routes.\n\nHistorian Ana Reyes found the journals in a sealed trunk donated to a museum basement. She cross-checked landmarks against survey maps and confirmed three forgotten shortcuts Okonkwo marked with stacked stones. Reyes argues that official maps recorded highways for merchants, while walkers like Okonkwo preserved paths for people carrying weight on their backs. Her exhibit pairs scanned journal pages with modern photos taken from the same compass bearings.",
        },
        {
            "id": "p3",
            "title": "The robotics club compromise",
            "body": "Last spring, the robotics club had twelve members but only one competition kit. Captain Eli wanted to enter the regional tournament; treasurer Sam pointed out that registration, travel, and spare parts would consume the entire club budget. They surveyed members: eight wanted to compete, four preferred building workshop projects open to the whole school.\n\nThe compromise they drafted split the year. Fall semester focused on open workshop nights where anyone could solder sensors. Winter funds went to a scaled-down tournament robot with a modular design so parts could be reused in spring demos. Eli agreed to publish costs publicly each month; Sam agreed to train two assistant treasurers. Faculty advisor Ms. Chen noted that the plan succeeded because it treated money and inclusion as linked problems, not separate arguments.",
        },
    ]
    qs = [
        mcq("q1", "A community solar garden differs from selling the lot for apartments because it —", "creates shared energy benefits and gathering space rather than private housing only", ["creates shared energy benefits and gathering space rather than private housing only", "guarantees free electricity forever", "eliminates all winter snow", "prevents teenagers from measuring sunlight"], passage_id="p1"),
        mcq("q2", "Skeptics worried most about —", "weak winter sun and snow covering panels", ["weak winter sun and snow covering panels", "too many native plants", "students building scale models", "council meetings lasting too long"], passage_id="p1"),
        mcq("q3", "The council required forty percent of shares for lower-income households to —", "ensure broader access to the project's benefits", ["ensure broader access to the project's benefits", "reduce the number of panels", "ban student maintenance crews", "speed up apartment construction"], passage_id="p1"),
        mcq("q4", "Delgado's comment that the project was \"never only about watts\" mainly emphasizes —", "who participates in planning infrastructure", ["who participates in planning infrastructure", "how to copy guidebooks", "competition between towns", "the weight of solar panels"], passage_id="p1"),
        mcq("q5", "Okonkwo's job involved —", "carrying mail on foot along steep routes", ["carrying mail on foot along steep routes", "driving wagons on highways", "designing official merchant maps", "tuning pianos professionally"], passage_id="p2"),
        mcq("q6", "Reyes confirmed Okonkwo's shortcuts by —", "matching journal landmarks to survey maps and modern photos", ["matching journal landmarks to survey maps and modern photos", "guessing where stones might be", "interviewing mule drivers only", "ignoring compass bearings"], passage_id="p2"),
        mcq("q7", "Reyes argues official maps often recorded —", "highways for merchants rather than walkers' paths", ["highways for merchants rather than walkers' paths", "every hiking trail equally", "only piano delivery routes", "postal rates instead of landforms"], passage_id="p2"),
        mcq("q8", "The pianist in Okonkwo's journal helped by —", "playing scales until mules arrived and calming horses", ["playing scales until mules arrived and calming horses", "carrying the mail satchel", "stacking stones on shortcuts", "drawing new survey maps"], passage_id="p2"),
        mcq("q9", "The robotics club's main resource conflict was —", "one competition kit versus costs of registering and traveling", ["one competition kit versus costs of registering and traveling", "too many kits but no advisor", "members refusing to solder sensors", "a ban on workshop nights"], passage_id="p3"),
        mcq("q10", "Eight of twelve members wanted to —", "enter the regional tournament", ["enter the regional tournament", "eliminate the treasurer role", "stop publishing costs", "sell the kit for spare parts"], passage_id="p3"),
        mcq("q11", "The compromise allocated fall semester to —", "open workshop nights for the whole school", ["open workshop nights for the whole school", "travel to regionals immediately", "private meetings without advisors", "buying apartment shares"], passage_id="p3"),
        mcq("q12", "Ms. Chen credited the plan because it —", "linked financial transparency with inclusive access", ["linked financial transparency with inclusive access", "avoided all competition", "removed modular robot parts", "ignored member surveys"], passage_id="p3"),
        mcq("q13", "Which word best describes Delgado's role in passage 1?", "advocate", ["advocate", "bystander", "merchant", "critic"], passage_id="p1"),
        mcq("q14", "Across passages 1 and 3, leaders succeed partly by —", "sharing information and widening who can participate", ["sharing information and widening who can participate", "keeping plans secret", "rejecting all compromises", "focusing only on equipment"], passage_id="p1"),
        mcq("q15", "The tone of passage 2 is best described as —", "respectful and investigative", ["respectful and investigative", "mocking and casual", "angry and dismissive", "humorous and fictional"], passage_id="p2"),
    ]
    write(
        "questions_106.json",
        {
            "title": "English — Reading comprehension (Grade 6, ★★★)",
            "subject": "english",
            "scratchpad": False,
            "created_at": NOW,
            "passages": passages,
            "questions": qs,
        },
    )


def build_english_cr_107():
    passages = [
        {
            "id": "p1",
            "title": "Later school start times",
            "body": "A district moved middle-school start times from 7:30 a.m. to 8:45 a.m. Tardiness dropped by thirty percent in the first semester, and nurses logged fewer morning headaches. The superintendent claimed the later bell directly improved student health.\n\nResearchers noted the same year introduced free breakfast in the cafeteria and a phone-lock policy during homeroom. They also pointed out that families with early work shifts still struggled to arrange drop-offs, so attendance gains were uneven across neighbourhoods.",
        }
    ]
    qs = [
        mcq("q1", "The researchers' comments most directly suggest the attendance and health improvements —", "might reflect several simultaneous changes, not just the later bell alone", ["might reflect several simultaneous changes, not just the later bell alone", "prove teenagers need no sleep", "show breakfast causes headaches", "mean phone locks harm health"], passage_id="p1"),
        mcq("q2", "The superintendent treats reduced tardiness chiefly as evidence that —", "later start times benefit students", ["later start times benefit students", "nurses should start school earlier", "breakfast should be removed", "phones improve punctuality"], passage_id="p1"),
        mcq("q3", "Which study design would best test whether the later bell alone caused fewer headaches?", "Compare similar schools where only start times differ while holding breakfast and phone policies constant", ["Compare similar schools where only start times differ while holding breakfast and phone policies constant", "Survey students about favourite subjects", "Measure cafeteria noise levels", "Ask families to wake up earlier"], passage_id="p1"),
        mcq("q4", "Statement: \"Only students who complete the safety quiz may use the workshop tools.\" Priya is using the drill press. What follows logically?", "Priya completed the safety quiz", ["Priya completed the safety quiz", "Priya dislikes quizzes", "No one completed the quiz", "Workshop tools are broken"], passage_id="p1"),
        mcq("q5", "Advertisement: \"Our sneakers make you faster because Olympic athletes wear them.\" The flaw is closest to —", "assuming a product must be good because famous people use it", ["assuming a product must be good because famous people use it", "measuring speed with a stopwatch", "designing shoes in multiple sizes", "testing shoes on a track"], passage_id="p1"),
        mcq("q6", "Choose the best revision of the sentence: \"Me and Amir was planning to submit the report until the wifi don't work.\"", "Amir and I were planning to submit the report until the Wi‑Fi did not work", ["Amir and I were planning to submit the report until the Wi‑Fi did not work", "Me and Amir was planning to submit the report until the wifi doesn't work", "Amir and I is planning to submit the report until the wifi don't work", "Amir and me were planning to submit the report until the Wi‑Fi didn't worked"], area="grammar"),
        mcq("q7", "Choose the best revision: \"Running for the bus, the backpack strap broke and books fell.\"", "As I ran for the bus, the backpack strap broke and books fell", ["As I ran for the bus, the backpack strap broke and books fell", "Running for the bus, the books fell from the strap", "Running for the bus, the strap was broken by books", "Running for the bus, the bus broke the strap"], area="grammar"),
        mcq("q8", "Choose the best revision: \"Neither the coaches nor the captain are willing to cancel the match.\"", "Neither the coaches nor the captain is willing to cancel the match", ["Neither the coaches nor the captain is willing to cancel the match", "Neither the coaches nor the captain are willing to cancel the match", "Neither the coach nor the captains is willing to cancel the match", "Neither the coaches or the captain is willing to cancel the match"], area="grammar"),
        mcq("q9", "Choose the best revision: \"The data shows that students which study daily improves more steady.\"", "The data show that students who study daily improve more steadily", ["The data show that students who study daily improve more steadily", "The data shows that students which study daily improves more steady", "The data show that students who study daily improves more steady", "The data shows that students who study daily improve more steadily"], area="grammar"),
        mcq("q10", "Choose the best revision: \"Because the experiment failed, therefore we repeated the trial.\"", "Because the experiment failed, we repeated the trial", ["Because the experiment failed, we repeated the trial", "Because the experiment failed, therefore we repeated the trial", "The experiment failed, because we repeated the trial", "Because the experiment failed, so we repeated the trial"], area="grammar"),
        mcq("q11", "Argument: \"If a food is natural, it must be healthy; honey is natural, so any amount is healthy.\" Which question best challenges the assumption?", "Can a natural food still harm health when consumed in large amounts?", ["Can a natural food still harm health when consumed in large amounts?", "What colour is honey?", "Do bees live in hives?", "Is honey sold in jars?"], area="grammar"),
        mcq("q12", "Choose the best revision: \"The committee have decided to move the debate, but no one have told the judges.\"", "The committee has decided to move the debate, but no one has told the judges", ["The committee has decided to move the debate, but no one has told the judges", "The committee have decided to move the debate, but no one has told the judges", "The committee has decided to move the debate, but no one have told the judges", "The committee have decided to move the debate, but nobody has told the judges"], area="grammar"),
    ]
    write(
        "questions_107.json",
        {
            "title": "English — Critical reasoning & sentence correction (Grade 6)",
            "subject": "english",
            "scratchpad": False,
            "created_at": NOW,
            "passages": passages,
            "questions": qs,
        },
    )


def build_data_108():
    passages = [
        {
            "id": "p1",
            "title": "Club fundraising",
            "body": "Amount raised ($) by four clubs in one month.",
            "chart": {
                "type": "bar",
                "title": "Funds raised",
                "labels": ["Robotics", "Drama", "Eco", "Chess"],
                "values": [420, 310, 385, 265],
                "xLabel": "Club",
                "yLabel": "Dollars",
            },
        },
        {
            "id": "p2",
            "title": "Survey: commute method",
            "body": "200 students reported how they travel to school.",
            "chart": {
                "type": "pie",
                "title": "Commute methods",
                "labels": ["Walk", "Bus", "Car", "Bike"],
                "values": [50, 80, 45, 25],
            },
        },
        {
            "id": "p3",
            "title": "Plant height study",
            "body": "Average height (cm) of bean plants measured each week for five weeks.",
            "chart": {
                "type": "line",
                "title": "Mean plant height",
                "labels": ["Wk1", "Wk2", "Wk3", "Wk4", "Wk5"],
                "values": [4, 9, 14, 18, 23],
                "xLabel": "Week",
                "yLabel": "cm",
            },
        },
        {
            "id": "p4",
            "title": "Test scores by class",
            "body": "Scores out of 50 on a data quiz.",
            "table": {
                "headers": ["Class", "Students", "Mean", "Median", "Range"],
                "rows": [
                    ["6A", "24", "38", "39", "22"],
                    ["6B", "26", "34", "35", "18"],
                    ["6C", "25", "41", "42", "16"],
                ],
            },
        },
    ]
    qs = [
        mcq("q1", "Which club raised the most money?", "Robotics", ["Robotics", "Eco", "Drama", "Chess"], passage_id="p1", area="data"),
        mcq("q2", "How much more did Robotics raise than Chess?", "$155", ["$155", "$145", "$165", "$125"], passage_id="p1", area="data"),
        mcq("q3", "What is the mean amount raised by the four clubs?", "$345", ["$345", "$350", "$340", "$355"], passage_id="p1", area="data"),
        mcq("q4", "Eco raised what percent of the total raised by all four clubs? (nearest whole percent)", "27%", ["27%", "30%", "25%", "33%"], passage_id="p1", area="data"),
        mcq("q5", "How many students take the bus?", "80", ["80", "50", "45", "25"], passage_id="p2", area="data"),
        mcq("q6", "What fraction of the 200 students walk to school?", "1/4", ["1/4", "1/5", "2/5", "3/10"], passage_id="p2", area="data"),
        mcq("q7", "How many more students take the bus than bike?", "55", ["55", "45", "60", "35"], passage_id="p2", area="data"),
        mcq("q8", "Car commuters are what percent of the survey? (nearest whole percent)", "23%", ["23%", "20%", "25%", "18%"], passage_id="p2", area="data"),
        mcq("q9", "From week 1 to week 5, mean height increased by how many cm?", "19", ["19", "18", "20", "23"], passage_id="p3", area="data"),
        mcq("q10", "What was the average weekly increase in mean height from week 1 to week 5?", "4.75 cm", ["4.75 cm", "5 cm", "4.5 cm", "3.8 cm"], passage_id="p3", area="data"),
        mcq("q11", "During which week-to-week period did height increase the most?", "Week 1 to Week 2", ["Week 1 to Week 2", "Week 4 to Week 5", "Week 2 to Week 3", "Week 3 to Week 4"], passage_id="p3", area="data"),
        mcq("q12", "Which class has the highest median score?", "6C", ["6C", "6A", "6B", "All equal"], passage_id="p4", area="data"),
        mcq("q13", "Which class has the largest range?", "6A", ["6A", "6C", "6B", "Cannot tell"], passage_id="p4", area="data"),
        mcq("q14", "How many students total are in the three classes?", "75", ["75", "74", "76", "70"], passage_id="p4", area="data"),
        mcq("q15", "Class 6C's mean is how many points above class 6B's mean?", "7", ["7", "5", "8", "6"], passage_id="p4", area="data"),
    ]
    write(
        "questions_108.json",
        {
            "title": "Data analysis — Charts, tables & inference (timed, ★★★ hard)",
            "subject": "data",
            "learn_subject": "math",
            "learn_section": "data-graphs",
            "timed": True,
            "time_limit_minutes": 30,
            "scratchpad": True,
            "created_at": NOW,
            "passages": passages,
            "questions": qs,
        },
    )


if __name__ == "__main__":
    build_math_105()
    build_english_rc_106()
    build_english_cr_107()
    build_data_108()
