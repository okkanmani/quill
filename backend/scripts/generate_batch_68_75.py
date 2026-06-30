#!/usr/bin/env python3
"""Generate worksheet batch 68–75: 20 Q each, balanced MC answer positions."""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worksheets import validate_worksheet_data

OUT = Path(__file__).resolve().parents[1] / "data" / "worksheets"


def balanced_positions(n: int, k: int = 4) -> list[int]:
    """Assign answer positions so each index appears roughly n/k times."""
    positions = [i % k for i in range(n)]
    random.shuffle(positions)
    return positions


def mc(qid: str, prompt: str, answer: str, distractors: list[str], stars: int, pos: int, pid: str | None = None):
    distractors = [d for d in distractors if d != answer][:3]
    while len(distractors) < 3:
        distractors.append(f"__fill_{len(distractors)}")
    slots = distractors[:]
    slots.insert(min(pos, len(slots)), answer)
    q = {
        "id": qid,
        "type": "multiple_choice",
        "stars": stars,
        "prompt": prompt,
        "choices": slots,
        "answer": answer,
        "hint": False,
    }
    if pid:
        q["passage_id"] = pid
    return q


def build_questions(specs: list[tuple], stars: int, seed: int) -> list[dict]:
    random.seed(seed)
    positions = balanced_positions(len(specs))
    out = []
    for i, item in enumerate(specs):
        if len(item) == 4:
            qid, prompt, answer, distractors = item
            pid = None
        else:
            qid, pid, prompt, answer, distractors = item
        out.append(mc(qid, prompt, answer, list(distractors), stars, positions[i], pid))
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


def write_sheet(wid: str, meta: dict, passages: list | None, questions: list[dict]):
    data = {**meta, "created_at": "2026-06-22T12:00:00Z", "questions": questions}
    if passages:
        data["passages"] = passages
    errs = validate_worksheet_data(data)
    if errs:
        raise ValueError(f"{wid}: {errs}")
    pos = {}
    for q in questions:
        pos[q["choices"].index(q["answer"])] = pos.get(q["choices"].index(q["answer"]), 0) + 1
    path = OUT / f"{wid}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{wid}: {len(questions)} Q ★{questions[0]['stars']} positions {dict(sorted(pos.items()))}")


# --- MATH ★2 (68) ---
MATH2 = [
    ("q1", "What is 3/5 + 1/10?", "7/10", ["4/15", "2/5", "4/5"]),
    ("q2", "What is 24% of 150?", "36", ["30", "40", "24"]),
    ("q3", "Evaluate: 48 ÷ 6 + 7 × 2", "22", ["18", "26", "14"]),
    ("q4", "A square has perimeter 36 cm. What is the length of one side?", "9 cm", ["6 cm", "12 cm", "18 cm"]),
    ("q5", "What is 5.6 − 2.75?", "2.85", ["3.15", "2.95", "3.35"]),
    ("q6", "Solve for n: n − 14 = 29", "n = 43", ["n = 15", "n = 33", "n = 45"]),
    ("q7", "Which fraction is equivalent to 0.6?", "3/5", ["2/3", "6/10 simplified wrong as 6/100", "1/6"]),
    ("q8", "A triangle has base 12 cm and height 8 cm. What is its area?", "48 cm²", ["96 cm²", "20 cm²", "40 cm²"]),
    ("q9", "What is the LCM of 6 and 8?", "24", ["14", "48", "12"]),
    ("q10", "Round 7.849 to the nearest tenth.", "7.8", ["7.9", "7.85", "8.0"]),
    ("q11", "What is 2³?", "8", ["6", "9", "12"]),
    ("q12", "A ratio of cats to dogs is 3 : 5. If there are 15 cats, how many dogs?", "25", ["20", "9", "30"]),
    ("q13", "What is 1/4 of 96?", "24", ["48", "32", "12"]),
    ("q14", "How many degrees in a straight angle?", "180°", ["90°", "360°", "270°"]),
    ("q15", "What is 4.2 × 0.5?", "2.1", ["21", "0.21", "8.4"]),
    ("q16", "Solve for y: 4y = 52", "y = 13", ["y = 48", "y = 16", "y = 11"]),
    ("q17", "Which is greater: 3/8 or 2/5?", "2/5", ["3/8", "They are equal", "Cannot tell"]),
    ("q18", "A cube has edges of 5 cm. What is its volume?", "125 cm³", ["25 cm³", "75 cm³", "150 cm³"]),
    ("q19", "What is 15% of 200?", "30", ["25", "35", "20"]),
    ("q20", "Evaluate: 100 − 4 × (6 + 4)", "60", ["40", "80", "96"]),
]

# --- MATH ★3 (69) ---
MATH3 = [
    ("q1", "What is 2/3 × 3/4?", "1/2", ["6/12 wrong path", "5/7", "2/3"]),
    ("q2", "A shirt costs $40. It is discounted by 30%. What is the sale price?", "$28", ["$30", "$12", "$32"]),
    ("q3", "Evaluate: (5 + 3)² − 4 × 6", "40", ["64", "28", "52"]),
    ("q4", "A parallelogram has base 11 cm and height 9 cm. What is its area?", "99 cm²", ["20 cm²", "88 cm²", "110 cm²"]),
    ("q5", "What is 0.375 as a fraction in simplest form?", "3/8", ["375/1000", "3/7", "5/8"]),
    ("q6", "Solve for x: 2x + 5 = 3x − 7", "x = 12", ["x = 2", "x = −12", "x = 7"]),
    ("q7", "What is the HCF of 36 and 48?", "12", ["6", "24", "18"]),
    ("q8", "A train travels 240 km in 4 hours. How far in 7 hours at the same speed?", "420 km", ["360 km", "280 km", "480 km"]),
    ("q9", "What is 5/6 − 1/4?", "7/12", ["1/2", "4/10", "1/3"]),
    ("q10", "The ratio of boys to girls is 4 : 5. If there are 36 boys, how many students in total?", "81", ["45", "72", "64"]),
    ("q11", "What is the value of 3 + 4 × 2²?", "19", ["28", "14", "49"]),
    ("q12", "A circle has radius 7 cm. What is its diameter?", "14 cm", ["7 cm", "21 cm", "3.5 cm"]),
    ("q13", "Convert 2.5 hours to minutes.", "150 minutes", ["125 minutes", "250 minutes", "120 minutes"]),
    ("q14", "What is 3/4 of 2/3?", "1/2", ["6/12 unsimplified as answer", "2/4", "5/6"]),
    ("q15", "Solve: 3(n + 4) = 27", "n = 5", ["n = 9", "n = 7", "n = 4"]),
    ("q16", "A bag has 3 red, 5 blue, and 2 green marbles. What fraction are blue?", "1/2", ["5/8", "5/10", "2/5"]),
    ("q17", "What is 1.25 × 1.25?", "1.5625", ["2.5", "1.5", "2.25"]),
    ("q18", "The average of 8, 12, and 16 is:", "12", ["10", "14", "36"]),
    ("q19", "A rectangular prism is 4 cm × 5 cm × 6 cm. What is its volume?", "120 cm³", ["60 cm³", "90 cm³", "150 cm³"]),
    ("q20", "If 5 workers finish a job in 12 days, how many days for 8 workers at the same rate?", "7.5 days", ["15 days", "8 days", "10 days"]),
]

# Fix some bad distractors in MATH2 q7 - let me fix in script before run
MATH2[6] = ("q7", "Which fraction is equivalent to 0.6?", "3/5", ["1/2", "2/5", "6/100"])

# --- ENGLISH passages ---
ENG2_PASSAGES = [
    passage("p1", "The compost experiment",
        body="Maya's class built two compost bins. Bin A held fruit peels and tea leaves; Bin B added shredded newspaper for balance. Each week they turned the piles with a fork and measured temperature with a probe. Maya noticed Bin B stayed warmer in cold weather and broke down carrot tops faster. She recorded worm counts too—Bin B had twice as many red wigglers by week four. Their teacher explained that carbon-rich paper balanced nitrogen-rich scraps, keeping microbes active. Maya posted a chart in the hallway so younger students would add paper towels instead of dumping only apple cores."),
    passage("p2", "Sound in the music room",
        body="During music, Mr. Lee demonstrated how a tuning fork vibrates. Students felt the buzz on their lips when they touched the stem lightly. He stretched a rubber band around a box to show pitch: tighter bands sang higher notes. When Amira plucked slowly, the wave looked lazy on the phone slow-motion video; a quick pluck made tight peaks. Mr. Lee warned that volume and pitch are different—yelling does not make your voice higher. The class tested rulers overhanging the desk, changing length to hear pitch climb as the free part shortened."),
    passage("p3", "The lost trail map",
        body="On a hiking trip, Jonah unfolded a waterproof map while his partner Leena checked the compass. Fog rolled in, hiding the ridge they had followed uphill. Jonah matched creek bends to blue lines on the map and spotted a shelter symbol two centimetres north of their dot. Leena confirmed they had been walking east too long without gaining elevation. They backtracked to the fork with three pine blazes and reached the shelter before rain. Jonah later laminated spare maps for the club, noting that batteries die but ink survives if kept dry."),
    passage("p4", "Repair café afternoon",
        body="At the community repair café, volunteers fixed toasters, jeans, and wobbly chairs. Priya brought a lamp whose switch sparked. An electrician named Gus opened the base, replaced a frayed wire, and showed Priya how strain relief prevents bends. Nearby, a seamstress patched knees while explaining that reinforcing inside stops new holes. Priya's grandmother fixed a music box by realigning a spring she cleaned with mild soap. The event kept kilograms of metal out of landfill. Priya signed up to log repairs in a shared spreadsheet so the school could start its own monthly clinic."),
]

ENG2_Q = [
    ("q1", "p1", "In the passage, \"balance\" most nearly refers to —", "mixing types of compost materials correctly", ["keeping the bin level on a scale", "equal numbers of worms", "hiding smells"]),
    ("q2", "p1", "Why did Bin B break down carrot tops faster?", "It stayed warmer and had more microbes and worms", ["It had no fruit peels", "It was in the sun only", "It was never turned"]),
    ("q3", "p1", "What can be inferred about paper towels in Bin B?", "They add carbon that helps the compost work better", ["They should never be used", "They kill worms", "They make compost colder"]),
    ("q4", "p1", "Which title best fits the passage?", "Balancing a classroom compost bin", ["Selling worms online", "Cooking with carrot tops", "Building a greenhouse"]),
    ("q5", "p1", "The chart in the hallway was meant to —", "teach younger students what to add besides fruit cores", ["measure temperature daily", "count students", "replace the teacher's notes"]),
    ("q6", "p2", "Volume and pitch differ because —", "yelling is louder but not necessarily higher in pitch", ["pitch always equals volume", "tuning forks cannot be loud", "rubber bands only change volume"]),
    ("q7", "p2", "When Amira plucked quickly, the slow-motion video showed —", "tighter peaks on the wave", ["no movement", "lower pitch only", "a flat line"]),
    ("q8", "p2", "Shorter free ruler length made pitch —", "climb higher", ["drop lower", "stay the same always", "stop"]),
    ("q9", "p2", "Mr. Lee used a tuning fork mainly to show —", "vibration creates sound", ["maps are waterproof", "compost needs paper", "fog hides ridges"]),
    ("q10", "p2", "Which sense did students use when touching the fork stem?", "Touch", ["Smell", "Taste", "Sight only"]),
    ("q11", "p3", "Jonah found the shelter by —", "matching creek bends to the map", ["guessing a random direction", "following louder birds", "turning off the compass"]),
    ("q12", "p3", "They had walked east too long without —", "gaining elevation", ["using ink", "carrying paper", "seeing pine trees"]),
    ("q13", "p3", "Laminating spare maps helps because —", "ink survives if kept dry when batteries fail", ["fog cannot form", "compasses read maps", "rain stops"]),
    ("q14", "p3", "The three pine blazes marked —", "a fork on the trail", ["the shelter door", "a compost bin", "a music room"]),
    ("q15", "p3", "Leena's compass was useful for checking —", "direction of travel", ["worm counts", "pitch of rulers", "sparked wires"]),
    ("q16", "p4", "Gus fixed the lamp by —", "replacing a frayed wire", ["painting the base", "adding fruit peels", "tightening a rubber band"]),
    ("q17", "p4", "Reinforcing inside jeans stops —", "new holes from forming at weak spots", ["all washing", "color fading only", "sparks"]),
    ("q18", "p4", "The repair café kept metal out of —", "landfill", ["maps", "music boxes only", "trail shelters"]),
    ("q19", "p4", "Priya signed up to —", "log repairs for a future school clinic", ["sell toasters", "laminate maps", "measure compost heat"]),
    ("q20", "p4", "Strain relief on a cord prevents —", "sharp bends that break wires", ["sound waves", "higher pitch", "fog"]),
]

ENG3_PASSAGES = [
    passage("p1", "Arctic expedition journal",
        body="Dr. Singh's team drilled ice cores thinner than drinking straws yet packed centuries of dust. Each layer's bubbles trapped ancient air; lab machines measured carbon dioxide rising after the industrial age. Graduate student Lina charted melt ponds spreading across the surface—dark water absorbed more sunlight than reflective ice, accelerating thaw. Singh cautioned reporters not to confuse weather with climate: one cold winter does not erase a long trend. The team also tagged narwhals whose migration shifted weeks earlier as passages opened. Lina wrote that data, not slogans, should guide policy."),
    passage("p2", "Debate club semifinals",
        body="The topic was whether cities should ban single-use plastics. Amir argued that bans push innovation in biodegradable packaging, citing a pilot where cafés saved money after switching to reusable cups with small deposits. Zoe countered that enforcement unfairly burdens small vendors who cannot bulk-order alternatives. She proposed tiered fines and grants instead. Both teams used rebuttal time to question sources: Amir challenged a Zoe chart missing post-2018 data; Zoe noted Amir's study was funded by a reusable-bottle company. Judges scored evidence and refutation separately from delivery."),
    passage("p3", "The clockmaker's apprentice",
        body="Elena filed a brass gear whose teeth had burrs catching the escapement. Master Vo taught her to listen: a healthy tick spaced evenly, while a scrape meant friction somewhere unseen. She cleaned pivots with pegwood and oiled sparingly—too much oil attracted dust that acted like sandpaper. When the mainspring snapped, Vo showed how tempering metal changed brittleness. Elena repaired a school tower clock that had stopped at 3:17 during a storm, replacing a bent pendulum rod. Vo reminded her that precision tools demand patience more than strength."),
    passage("p4", "Night market spices",
        body="Rafiq inherited his uncle's spice stall measuring coriander by the scoop. Tourists photographed piles of turmeric; locals asked for specific grinds for dal. Rafiq explained that whole seeds stay fragrant longer but need toasting before grinding. He refused to dye chili powder brighter red, saying trust beat appearance. When a supplier offered cheap filler, Rafiq tested samples in water—pure turmeric sank cleanly while adulterated dust clouded. He posted handwritten origin cards beside each jar, sales rising among chefs who valued traceability over discounts."),
]

ENG3_Q = [
    ("q1", "p1", "Ice cores help scientists study —", "air from past centuries trapped in bubbles", ["only current weather", "narwhal diets alone", "debate club scores"]),
    ("q2", "p1", "Melt ponds speed thaw because dark water —", "absorbs more sunlight than reflective ice", ["freezes faster", "blocks all light", "cools the core drill"]),
    ("q3", "p1", "Singh warned reporters not to confuse —", "weather with climate", ["gears with springs", "spices with maps", "volume with pitch"]),
    ("q4", "p1", "Lina argued policy should follow —", "data rather than slogans", ["single cold winters", "tourist photos only", "unchecked suppliers"]),
    ("q5", "p1", "Narwhal tags showed migration —", "shifted earlier as passages opened", ["stopped completely", "followed compost bins", "depended on lamp switches"]),
    ("q6", "p2", "Amir supported bans by noting —", "innovation in biodegradable packaging", ["higher spice prices", "broken pendulums", "ice drill thickness"]),
    ("q7", "p2", "Zoe worried bans could —", "burden small vendors on cost", ["increase narwhal counts", "stop clock ticks", "melt all ice instantly"]),
    ("q8", "p2", "Zoe proposed —", "tiered fines and grants instead of a flat ban", ["more single-use cups", "ending debate club", "dyeing chili powder"]),
    ("q9", "p2", "Amir challenged Zoe's chart for —", "missing post-2018 data", ["using too many colors", "listing compass directions", "measuring worm heat"]),
    ("q10", "p2", "Judges scored evidence separately from —", "delivery", ["gear filing", "spice toasting", "map laminating"]),
    ("q11", "p3", "Burrs on a gear caused —", "scraping uneven ticks", ["brighter turmeric", "earlier narwhal migration", "debate rebuttals"]),
    ("q12", "p3", "Too much oil on pivots —", "attracts dust that increases friction", ["stops all sound", "dyes chili red", "laminate maps"]),
    ("q13", "p3", "Tempering metal changes —", "brittleness of springs", ["pitch of rulers", "CO₂ in bubbles", "ban enforcement"]),
    ("q14", "p3", "The school clock stopped because —", "a bent pendulum rod after a storm", ["spice filler clouded water", "lack of biodegradable cups", "fog on the ridge"]),
    ("q15", "p3", "Vo emphasized patience over —", "strength when using precision tools", ["measuring coriander", "winning debates", "drilling ice"]),
    ("q16", "p4", "Whole spice seeds stay fragrant if —", "stored whole until toasting and grinding", ["dyed brighter", "mixed with filler", "left in melt ponds"]),
    ("q17", "p4", "Rafiq tested chili purity by —", "mixing samples in water to see cloudiness", ["listening for ticks", "using a compass", "drilling ice cores"]),
    ("q18", "p4", "Origin cards increased sales among —", "chefs who valued traceability", ["judges scoring delivery", "tourists only taking photos", "clockmakers filing gears"]),
    ("q19", "p4", "Rafiq refused to —", "dye chili powder brighter red", ["measure coriander", "toast seeds", "label jars"]),
    ("q20", "p4", "Trust beat appearance because —", "customers returned when quality was honest", ["bans were enforced", "springs never snapped", "fog never formed"]),
]

# --- SCIENCE Physics ★2 (72) ---
PHYS2 = [
    ("q1", "What unit is used to measure force?", "Newton", ["Joule", "Watt", "Metre"]),
    ("q2", "A ball at rest stays at rest unless acted on by an unbalanced force. This is —", "Newton's first law of inertia", ["Newton's third law only", "The law of conservation of mass", "Archimedes' principle"]),
    ("q3", "Which is a contact force?", "Friction", ["Gravity", "Magnetic attraction at a distance", "Electrostatic force"]),
    ("q4", "Work is done when a force moves an object in the direction of the force. Unit of work?", "Joule", ["Newton", "Pascal", "Hertz"]),
    ("q5", "A lever helps lift a load with less effort by trading —", "distance for force", ["mass for colour", "time for temperature", "sound for light"]),
    ("q6", "Which surface likely has the most friction?", "Rough concrete", ["Ice", "Oiled glass", "Wet soapy tile"]),
    ("q7", "Speed equals —", "distance divided by time", ["time divided by distance", "force times mass", "mass divided by volume"]),
    ("q8", "Heat flows from —", "hotter objects to cooler ones", ["cold to hot only", "only solids to liquids", "light to dark colours only"]),
    ("q9", "Which is the best conductor of heat?", "Metal spoon", ["Wooden stick", "Plastic foam", "Wool scarf"]),
    ("q10", "A pulley can change the —", "direction of a force", ["mass of an object", "gravity on Earth", "melting point of ice"]),
    ("q11", "Gravity on Earth pulls objects —", "toward the centre of Earth", ["only sideways", "away from Earth", "only in water"]),
    ("q12", "Which has more kinetic energy at the same speed?", "A heavier truck", ["A lighter bicycle", "They always have equal energy", "Neither has kinetic energy"]),
    ("q13", "Light travels fastest in —", "vacuum", ["water", "glass", "diamond only"]),
    ("q14", "A shadow forms when light is —", "blocked by an opaque object", ["refracted only", "reflected twice", "converted to heat only"]),
    ("q15", "The pitch of a sound depends on —", "frequency of vibration", ["the colour of the object", "how heavy the air is only", "distance from the equator"]),
    ("q16", "A thermostat uses expansion of metal to —", "switch heating on or off", ["create magnetic fields", "measure mass", "produce light"]),
    ("q17", "Which simple machine is a ramp?", "Inclined plane", ["Wheel and axle", "Pulley", "Wedge only if split"]),
    ("q18", "Pressure equals force divided by —", "area", ["volume", "speed", "temperature"]),
    ("q19", "Magnets attract —", "some metals like iron and nickel", ["all plastics", "all wood", "pure copper always"]),
    ("q20", "Energy cannot be created or destroyed, only transformed. This is the —", "law of conservation of energy", ["law of inertia", "law of floating", "law of reflection only"]),
]

# --- SCIENCE Animal Kingdom ★3 (73) ---
ANIM3 = [
    ("q1", "Animals that maintain constant body temperature are —", "warm-blooded (endothermic)", ["cold-blooded only", "always amphibians", "always invertebrates"]),
    ("q2", "Which group has hair or fur and feeds young with milk?", "Mammals", ["Reptiles", "Birds", "Insects"]),
    ("q3", "An animal that eats only plants is a —", "herbivore", ["carnivore", "omnivore", "decomposer"]),
    ("q4", "Camouflage helps an animal —", "avoid predators or ambush prey", ["digest cellulose", "fly faster than sound", "produce milk"]),
    ("q5", "Which is a vertebrate?", "Frog", ["Earthworm", "Jellyfish", "Spider"]),
    ("q6", "Migration is best defined as —", "seasonal movement to find food or breed", ["sleeping through winter only", "changing colour in autumn", "growing a new shell"]),
    ("q7", "In a food chain, plants are usually —", "producers", ["top predators", "decomposers only", "secondary consumers"]),
    ("q8", "Gills are adapted for —", "breathing dissolved oxygen in water", ["flying long distances", "digging burrows", "storing fat in desert"]),
    ("q9", "Which trait belongs to reptiles?", "Dry scaly skin", ["Feathers", "Moist skin with no scales", "Six jointed legs"]),
    ("q10", "A habitat provides —", "food, water, shelter, and space", ["only mates", "only sunlight", "magnetic north"]),
    ("q11", "Endangered species have populations that are —", "at serious risk of extinction", ["always invasive", "only found in zoos by definition", "unable to migrate"]),
    ("q12", "Ants communicating with chemical trails is an example of —", "behavioural adaptation", ["photosynthesis", "hibernation in fish", "moulting in birds"]),
    ("q13", "Which pair is predator and prey?", "Owl and mouse", ["Cow and grass", "Bee and flower", "Fungus and dead leaf"]),
    ("q14", "Amphibians often begin life in —", "water with gills, then may live on land", ["deserts only", "deep ocean trenches", "polar ice caps only"]),
    ("q15", "Birds are adapted for flight partly because they have —", "light hollow bones and feathers", ["gills and fins", "eight legs", "dry scales only"]),
    ("q16", "An invasive species can harm an ecosystem by —", "outcompeting native species", ["increasing biodiversity always", "cleaning water automatically", "preventing all disease"]),
    ("q17", "Metamorphosis occurs in many —", "insects and amphibians", ["mammals only", "adult birds", "mature fish only"]),
    ("q18", "A food web differs from a food chain because it —", "shows many linked feeding relationships", ["has only one producer", "excludes decomposers always", "ignores habitats"]),
    ("q19", "Whiskers on a cat help it —", "sense nearby objects especially in the dark", ["digest meat in stomach", "regulate body temperature", "lay eggs"]),
    ("q20", "Conservation efforts aim to —", "protect species and their habitats", ["remove all predators", "stop migration", "end all farming"]),
]

# --- DATA ★2 (74) ---
DATA2_PASSAGES = [
    passage("p1", "Weekly step count",
        body="A fitness tracker recorded steps for four friends.",
        chart={"type": "bar", "title": "Steps in one week", "labels": ["Asha", "Ben", "Cara", "Dev"],
               "values": [42000, 35000, 51000, 38000], "xLabel": "Person", "yLabel": "Steps"}),
    passage("p2", "Energy sources",
        body="Share of electricity generated in a region last year.",
        chart={"type": "pie", "title": "Electricity sources", "labels": ["Hydro", "Wind", "Solar", "Gas"], "values": [40, 25, 15, 20]}),
    passage("p3", "Temperature at noon",
        body="Daily noon temperature for one week (°C).",
        chart={"type": "line", "title": "Noon temperature", "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
               "values": [18, 20, 22, 19, 24, 26, 23], "xLabel": "Day", "yLabel": "°C"}),
    passage("p4", "Club membership",
        body="Number of members in school clubs.",
        table={"headers": ["Club", "Members"], "rows": [["Chess", "28"], ["Drama", "34"], ["Robotics", "22"], ["Debate", "31"]]}),
]

DATA2_Q = [
    ("q1", "p1", "Who walked the most steps?", "Cara", ["Asha", "Ben", "Dev"]),
    ("q2", "p1", "How many steps did Ben walk?", "35000", ["38000", "42000", "51000"]),
    ("q3", "p1", "How many more steps did Cara walk than Ben?", "16000", ["12000", "7000", "9000"]),
    ("q4", "p1", "What is the total steps for all four?", "166000", ["160000", "170000", "155000"]),
    ("q5", "p1", "How many fewer steps did Dev walk than Asha?", "4000", ["6000", "13000", "8000"]),
    ("q6", "p2", "Which source produced the largest share?", "Hydro", ["Wind", "Gas", "Solar"]),
    ("q7", "p2", "What fraction came from solar?", "3/20", ["1/4", "1/5", "3/10"]),
    ("q8", "p2", "How much came from wind and solar together?", "40%", ["35%", "45%", "25%"]),
    ("q9", "p2", "Gas and hydro together make what fraction?", "3/5", ["1/2", "2/3", "4/5"]),
    ("q10", "p2", "How many percentage points more is hydro than gas?", "20", ["15", "25", "5"]),
    ("q11", "p3", "On which day was noon temperature highest?", "Saturday", ["Friday", "Sunday", "Wednesday"]),
    ("q12", "p3", "What was the temperature on Monday?", "18°C", ["20°C", "22°C", "24°C"]),
    ("q13", "p3", "How much did temperature rise from Monday to Wednesday?", "4°C", ["2°C", "6°C", "3°C"]),
    ("q14", "p3", "What was the total of Mon–Fri temperatures?", "103°C", ["100°C", "108°C", "98°C"]),
    ("q15", "p3", "Which day was 2°C warmer than Thursday?", "Friday", ["Tuesday", "Sunday", "Monday"]),
    ("q16", "p4", "Which club has the most members?", "Drama", ["Chess", "Debate", "Robotics"]),
    ("q17", "p4", "How many members in Robotics?", "22", ["28", "31", "34"]),
    ("q18", "p4", "How many more in Drama than Chess?", "6", ["3", "9", "12"]),
    ("q19", "p4", "Total members in all clubs?", "115", ["110", "120", "105"]),
    ("q20", "p4", "How many clubs have more than 30 members?", "2", ["1", "3", "4"]),
]

DATA3_PASSAGES = [
    passage("p1", "Test score comparison",
        body="Scores out of 50 for two classes on the same quiz.",
        chart={"type": "bar", "title": "Average score by class", "labels": ["6A", "6B", "6C", "6D"],
               "values": [38, 42, 35, 44], "xLabel": "Class", "yLabel": "Average score"}),
    passage("p2", "Household waste",
        body="Waste collected from 200 homes in one week (kg).",
        chart={"type": "pie", "title": "Waste types", "labels": ["Recycling", "Food", "Paper", "Other"], "values": [70, 50, 40, 40]}),
    passage("p3", "Website visits",
        body="Daily visitors during a product launch.",
        chart={"type": "line", "title": "Visitors", "labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
               "values": [120, 180, 250, 220, 300], "xLabel": "Day", "yLabel": "Visitors"}),
    passage("p4", "Regional rainfall",
        body="Rainfall in millimetres last month.",
        table={"headers": ["Region", "Rainfall (mm)"], "rows": [["North", "85"], ["East", "62"], ["South", "110"], ["West", "78"]]}),
]

DATA3_Q = [
    ("q1", "p1", "Which class had the highest average?", "6D", ["6A", "6B", "6C"]),
    ("q2", "p1", "What was class 6B's average?", "42", ["38", "44", "35"]),
    ("q3", "p1", "How many points higher is 6D than 6C?", "9", ["6", "7", "4"]),
    ("q4", "p1", "What is the sum of all four averages?", "159", ["155", "164", "150"]),
    ("q5", "p1", "Which class scored 4 points above 6A?", "6B", ["6C", "6D", "None"]),
    ("q6", "p2", "Which waste type was largest?", "Recycling", ["Food", "Paper", "Other"]),
    ("q7", "p2", "How many kg of food waste?", "50", ["40", "70", "60"]),
    ("q8", "p2", "Recycling and food together are what fraction of 200 kg?", "3/5", ["1/2", "2/5", "7/10"]),
    ("q9", "p2", "Paper and other waste combined equal how many kg?", "80", ["70", "90", "60"]),
    ("q10", "p2", "How many kg more recycling than paper?", "30", ["20", "40", "10"]),
    ("q11", "p3", "On which day were visitors highest?", "Day 5", ["Day 3", "Day 4", "Day 2"]),
    ("q12", "p3", "How many visitors on Day 2?", "180", ["120", "220", "250"]),
    ("q13", "p3", "Increase from Day 1 to Day 3?", "130", ["100", "70", "160"]),
    ("q14", "p3", "Total visitors Day 1–Day 5?", "1070", ["1000", "1100", "970"]),
    ("q15", "p3", "Day 4 had how many fewer than Day 5?", "80", ["30", "50", "100"]),
    ("q16", "p4", "Which region had most rain?", "South", ["North", "East", "West"]),
    ("q17", "p4", "How much rain in the East?", "62 mm", ["78 mm", "85 mm", "110 mm"]),
    ("q18", "p4", "How much more in South than West?", "32 mm", ["28 mm", "12 mm", "48 mm"]),
    ("q19", "p4", "Total rainfall all regions?", "335 mm", ["320 mm", "350 mm", "310 mm"]),
    ("q20", "p4", "How many regions had at least 80 mm?", "2", ["1", "3", "4"]),
]


def main():
    write_sheet("questions_68", {"title": "Math — Mixed practice (medium)", "subject": "math", "scratchpad": True},
                None, build_questions(MATH2, 2, 68))
    write_sheet("questions_69", {"title": "Math — Mixed practice (hard)", "subject": "math", "scratchpad": True},
                None, build_questions(MATH3, 3, 69))
    write_sheet("questions_70", {"title": "English — Reading comprehension (medium)", "subject": "english", "scratchpad": False},
                ENG2_PASSAGES, build_questions(ENG2_Q, 2, 70))
    write_sheet("questions_71", {"title": "English — Reading comprehension (hard)", "subject": "english", "scratchpad": False},
                ENG3_PASSAGES, build_questions(ENG3_Q, 3, 71))
    write_sheet("questions_72", {"title": "Science — Physics (medium)", "subject": "science", "scratchpad": True},
                None, build_questions(PHYS2, 2, 72))
    write_sheet("questions_73", {"title": "Science — Animal kingdom (hard)", "subject": "science", "scratchpad": True},
                None, build_questions(ANIM3, 3, 73))
    write_sheet("questions_74", {"title": "Data analysis — Charts & tables (medium)", "subject": "data", "scratchpad": True,
                                 "learn_subject": "math", "learn_section": "data-graphs"},
                DATA2_PASSAGES, build_questions(DATA2_Q, 2, 74))
    write_sheet("questions_75", {"title": "Data analysis — Charts & tables (hard)", "subject": "data", "scratchpad": True,
                                 "learn_subject": "math", "learn_section": "data-graphs"},
                DATA3_PASSAGES, build_questions(DATA3_Q, 3, 75))


if __name__ == "__main__":
    main()
