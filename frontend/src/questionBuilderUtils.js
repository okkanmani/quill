export const BUILDER_SUBJECTS = [
  { value: "math", label: "Math" },
  { value: "english", label: "English" },
  { value: "science", label: "Science" },
  { value: "data", label: "Data analysis" },
  { value: "general", label: "General" },
];

export const STARS_OPTIONS = [
  { value: 1, label: "★ Easy", count: 25 },
  { value: 2, label: "★★ Medium", count: 20 },
  { value: 3, label: "★★★ Hard", count: 15 },
];

export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Grade ${i + 1}`,
}));

export const CHOICE_LABELS = ["A", "B", "C", "D"];

export function defaultQuestionCount(stars) {
  return STARS_OPTIONS.find((o) => o.value === stars)?.count ?? 20;
}

export function emptyMcqQuestion() {
  return {
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    area: "",
  };
}

export function emptyShortAnswerQuestion() {
  return {
    prompt: "",
    answer: "",
    area: "",
  };
}

export function buildQuestionList(count, format) {
  const factory =
    format === "short_answer" ? emptyShortAnswerQuestion : emptyMcqQuestion;
  return Array.from({ length: count }, factory);
}

export function resizeQuestions(questions, count, format) {
  if (questions.length === count) return questions;
  if (questions.length > count) return questions.slice(0, count);
  const factory =
    format === "short_answer" ? emptyShortAnswerQuestion : emptyMcqQuestion;
  return [
    ...questions,
    ...Array.from({ length: count - questions.length }, factory),
  ];
}

export function validateBuilderForm({
  title,
  subject,
  format,
  timed,
  timeLimitMinutes,
  questions,
}) {
  const errors = [];
  if (!title.trim()) errors.push("Title is required.");
  if (format === "short_answer" && subject !== "math") {
    errors.push("Short answer worksheets must use Math subject.");
  }
  if (timed && (!timeLimitMinutes || Number(timeLimitMinutes) <= 0)) {
    errors.push("Enter a positive time limit for timed worksheets.");
  }

  questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.prompt.trim()) {
      errors.push(`Question ${n}: prompt is required.`);
    }
    if (format === "multiple_choice") {
      const emptyChoice = q.choices.findIndex((c) => !c.trim());
      if (emptyChoice >= 0) {
        errors.push(`Question ${n}: all four choices are required.`);
      }
      const unique = new Set(q.choices.map((c) => c.trim()));
      if (unique.size < 4) {
        errors.push(`Question ${n}: choices must be unique.`);
      }
    } else if (!q.answer.trim()) {
      errors.push(`Question ${n}: reference answer is required.`);
    }
    if (!q.area?.trim()) {
      errors.push(
        `Question ${n}: area is required — use a specific skill label (e.g. two-variable algebra).`,
      );
    }
  });

  return errors;
}

export function validateBuilderParamsForAi({
  subject,
  format,
  timed,
  timeLimitMinutes,
  questionCount,
  apiKeyConfigured,
  aiEnabled,
}) {
  const errors = [];
  if (!aiEnabled) {
    errors.push("AI worksheet generation is disabled on this server.");
  }
  if (!apiKeyConfigured) {
    errors.push("Add your OpenAI API key under Admin → Settings.");
  }
  if (format === "short_answer" && subject !== "math") {
    errors.push("Short answer worksheets must use Math subject.");
  }
  if (timed && (!timeLimitMinutes || Number(timeLimitMinutes) <= 0)) {
    errors.push("Enter a positive time limit for timed worksheets.");
  }
  if (!questionCount || questionCount < 1 || questionCount > 50) {
    errors.push("Question count must be between 1 and 50.");
  }
  return errors;
}

export function draftToBuilderQuestions(draft, format) {
  return draft.questions.map((q) => {
    const base = { prompt: q.prompt, area: q.area || "" };
    if (format === "multiple_choice") {
      return {
        ...base,
        choices: q.choices,
        correctIndex: q.correct_index,
      };
    }
    return {
      ...base,
      answer: q.answer,
    };
  });
}

export function builderPayload({
  title,
  subject,
  stars,
  format,
  questionCount,
  timed,
  timeLimitMinutes,
  questions,
}) {
  return {
    title: title.trim(),
    subject,
    stars,
    format,
    question_count: questionCount,
    timed,
    time_limit_minutes: timed ? Number(timeLimitMinutes) : null,
    questions: questions.map((q) => {
      const base = { prompt: q.prompt.trim() };
      if (q.area?.trim()) base.area = q.area.trim().toLowerCase();
      if (format === "multiple_choice") {
        return {
          ...base,
          choices: q.choices.map((c) => c.trim()),
          correct_index: q.correctIndex,
        };
      }
      return {
        ...base,
        answer: q.answer.trim(),
      };
    }),
  };
}
