/** Reference JSON shapes for admin worksheet upload (matches backend validate_worksheet_data). */

export const MATH_PRACTICE_EXAMPLE = `{
  "title": "Math — Fractions practice",
  "subject": "math",
  "learn_subject": "math",
  "learn_section": "fractions-basics",
  "scratchpad": true,
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "Which fraction is equal to 1/2?",
      "choices": ["2/4", "1/3", "3/5", "2/3"],
      "answer": "2/4",
      "hint": false,
      "area": "fractions",
      "stars": 2
    }
  ]
}`;

export const SCIENCE_PRACTICE_EXAMPLE = `{
  "title": "Science — Ecosystems",
  "subject": "science",
  "scratchpad": false,
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "stars": 2,
      "prompt": "A food chain always starts with —",
      "choices": ["a producer", "a decomposer", "a consumer", "sunlight only"],
      "answer": "a producer",
      "hint": false
    }
  ]
}`;

export const ENGLISH_RC_EXAMPLE = `{
  "title": "English — Reading comprehension",
  "subject": "english",
  "english_type": "reading_comprehension",
  "scratchpad": true,
  "passages": [
    {
      "id": "passage_1",
      "title": "The Old Lighthouse",
      "body": "Paragraph text students read before answering…"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "passage_id": "passage_1",
      "prompt": "What is the main idea?",
      "choices": ["A", "B", "C", "D"],
      "answer": "A",
      "area": "main idea",
      "stars": 2
    }
  ]
}`;

export const DATA_PASSAGE_EXAMPLE = `{
  "title": "Data — Chart and table",
  "subject": "data",
  "scratchpad": true,
  "passages": [
    {
      "id": "chart_1",
      "title": "Books sold",
      "body": "Optional intro sentence.",
      "chart": {
        "type": "bar",
        "title": "Sales by genre",
        "labels": ["Mystery", "Sports", "Science"],
        "values": [12, 8, 15]
      }
    },
    {
      "id": "table_1",
      "title": "Weekly rainfall",
      "table": {
        "headers": ["Day", "Rain (mm)"],
        "rows": [["Mon", 2], ["Tue", 0], ["Wed", 5]]
      }
    }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "passage_id": "chart_1",
      "prompt": "Which genre sold the most?",
      "choices": ["Mystery", "Sports", "Science", "Equal"],
      "answer": "Science"
    }
  ]
}`;

export const MANUAL_WRITING_EXAMPLE = `{
  "title": "Writing — Short response",
  "subject": "english",
  "evaluation": "manual",
  "scratchpad": true,
  "questions": [
    {
      "id": "q1",
      "type": "short_answer",
      "prompt": "Explain your answer in two or three sentences.",
      "answer": "Reference answer for the teacher (not shown to students)."
    }
  ]
}`;

export const ADAPTIVE_TEST_EXAMPLE = `{
  "title": "English RC Test — adaptive",
  "subject": "english",
  "english_type": "reading_comprehension",
  "content_badge": "Test",
  "is_test": true,
  "test_sitting_count": 2,
  "test_rc_questions_per_passage": 4,
  "test_adaptive": true,
  "timed": true,
  "time_limit_minutes": 25,
  "passages": [
    { "id": "p1", "title": "Passage A", "body": "…", "tier": 1 },
    { "id": "p2", "title": "Passage B", "body": "…", "tier": 2 }
  ],
  "questions": [
    {
      "id": "p1_q1",
      "type": "multiple_choice",
      "passage_id": "p1",
      "stars": 1,
      "prompt": "…",
      "choices": ["…", "…", "…", "…"],
      "answer": "…"
    }
  ]
}`;

export const CUSTOM_WORKSHEET_EXAMPLE = `{
  "title": "",
  "subject": "general",
  "questions": []
}`;

/** Tabs for the paste-and-upload JSON editor (each tab keeps its own buffer). */
export const WORKSHEET_EDITOR_TABS = [
  {
    id: "math",
    label: "Math",
    description: "Auto-graded multiple choice. Optional learn hub link fields.",
    json: MATH_PRACTICE_EXAMPLE,
  },
  {
    id: "science",
    label: "Science",
    json: SCIENCE_PRACTICE_EXAMPLE,
  },
  {
    id: "english",
    label: "English RC",
    description: "Questions link to passages via passage_id.",
    json: ENGLISH_RC_EXAMPLE,
  },
  {
    id: "data",
    label: "Data",
    description: "Passages may include chart and/or table instead of long body text.",
    json: DATA_PASSAGE_EXAMPLE,
  },
  {
    id: "manual",
    label: "Manual writing",
    description: 'Requires evaluation: "manual". Students submit text; no choices array.',
    json: MANUAL_WRITING_EXAMPLE,
  },
  {
    id: "test",
    label: "Adaptive test",
    description: "is_test triggers extra validation (sittings, tiers, timed rules).",
    json: ADAPTIVE_TEST_EXAMPLE,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Minimal shell — paste or build your own worksheet JSON.",
    json: CUSTOM_WORKSHEET_EXAMPLE,
  },
];
