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

export const ENGLISH_TYPES = [
  { value: "critical_reasoning", label: "Critical reasoning" },
  { value: "reading_comprehension", label: "Reading comprehension" },
];

export const CHOICE_LABELS = ["A", "B", "C", "D"];

export function defaultQuestionCount(stars) {
  return STARS_OPTIONS.find((o) => o.value === stars)?.count ?? 20;
}

export const DEFAULT_RC_PASSAGE_COUNT = 4;
export const DEFAULT_RC_QUESTIONS_PER_PASSAGE = 5;
export const DEFAULT_RC_MIN_WORDS = 200;

export function defaultPassageCount() {
  return DEFAULT_RC_PASSAGE_COUNT;
}

export function emptyPassage(
  id = "p1",
  questionCount = DEFAULT_RC_QUESTIONS_PER_PASSAGE,
  aiPrompt = "",
  minWords = DEFAULT_RC_MIN_WORDS,
) {
  return {
    id,
    title: "",
    body: "",
    questionCount,
    aiPrompt,
    minWords,
  };
}

export function buildPassageList(
  count = DEFAULT_RC_PASSAGE_COUNT,
  questionsPerPassage = DEFAULT_RC_QUESTIONS_PER_PASSAGE,
) {
  return Array.from({ length: count }, (_, i) =>
    emptyPassage(`p${i + 1}`, questionsPerPassage),
  );
}

export function buildDefaultRcPassages() {
  return buildPassageList(
    DEFAULT_RC_PASSAGE_COUNT,
    DEFAULT_RC_QUESTIONS_PER_PASSAGE,
  );
}

export function reindexPassages(passages) {
  return passages.map((passage, index) => ({
    ...passage,
    id: `p${index + 1}`,
  }));
}

export function totalRcQuestionCount(passages) {
  return passages.reduce(
    (sum, passage) => sum + Math.max(1, Number(passage.questionCount) || 1),
    0,
  );
}

export function buildQuestionsFromPassages(passages, existing = []) {
  const byPassage = {};
  existing.forEach((question) => {
    if (!question.passageId) return;
    if (!byPassage[question.passageId]) byPassage[question.passageId] = [];
    byPassage[question.passageId].push(question);
  });

  const result = [];
  passages.forEach((passage) => {
    const bucket = byPassage[passage.id] || [];
    const count = Math.max(1, Number(passage.questionCount) || 1);
    for (let i = 0; i < count; i += 1) {
      if (bucket[i]) {
        result.push({ ...bucket[i], passageId: passage.id });
      } else {
        result.push(emptyMcqQuestion(passage.id));
      }
    }
  });
  return result;
}

export function addRcPassage(passages, questions) {
  const nextPassages = reindexPassages([
    ...passages,
    emptyPassage(`p${passages.length + 1}`, DEFAULT_RC_QUESTIONS_PER_PASSAGE),
  ]);
  return {
    passages: nextPassages,
    questions: buildQuestionsFromPassages(nextPassages, questions),
  };
}

export function removeRcPassageAt(passages, questions, index) {
  if (passages.length <= 1) {
    return { passages, questions };
  }

  let offset = 0;
  const groups = passages.map((passage) => {
    const count = Math.max(1, Number(passage.questionCount) || 1);
    const group = questions.slice(offset, offset + count);
    offset += count;
    return group;
  });
  groups.splice(index, 1);
  const nextPassages = reindexPassages(passages.filter((_, i) => i !== index));
  const nextQuestions = [];
  nextPassages.forEach((passage, passageIndex) => {
    const count = Math.max(1, Number(nextPassages[passageIndex].questionCount) || 1);
    const group = groups[passageIndex] || [];
    for (let i = 0; i < count; i += 1) {
      nextQuestions.push(
        group[i]
          ? { ...group[i], passageId: passage.id }
          : emptyMcqQuestion(passage.id),
      );
    }
  });
  return { passages: nextPassages, questions: nextQuestions };
}

export function questionPassageMeta(passages, questionIndex) {
  let offset = 0;
  for (let passageIndex = 0; passageIndex < passages.length; passageIndex += 1) {
    const count = Math.max(1, Number(passages[passageIndex].questionCount) || 1);
    if (questionIndex < offset + count) {
      return {
        passageIndex,
        questionInPassage: questionIndex - offset + 1,
        passage: passages[passageIndex],
      };
    }
    offset += count;
  }
  return null;
}

export function groupQuestionsByPassage(passages, questions) {
  let offset = 0;
  return passages.map((passage) => {
    const count = Math.max(1, Number(passage.questionCount) || 1);
    const group = questions.slice(offset, offset + count).map((question, localIndex) => ({
      question,
      globalIndex: offset + localIndex,
      localIndex,
    }));
    offset += count;
    return group;
  });
}

export function isBuilderQuestionComplete(question, format) {
  if (!question.prompt.trim()) return false;
  if (format === "multiple_choice") {
    return (
      question.choices.every((c) => c.trim()) &&
      new Set(question.choices.map((c) => c.trim())).size === 4
    );
  }
  return Boolean(question.answer.trim());
}

export function draftRcToBuilderState(draft) {
  const passages = (draft.passages || []).map((passage, index) => ({
    id: passage.id || `p${index + 1}`,
    title: passage.title || "",
    body: passage.body || "",
    questionCount: (passage.questions || []).length || DEFAULT_RC_QUESTIONS_PER_PASSAGE,
    aiPrompt: "",
    minWords: DEFAULT_RC_MIN_WORDS,
  }));
  const questions = [];
  (draft.passages || []).forEach((passage) => {
    (passage.questions || []).forEach((question) => {
      questions.push({
        prompt: question.prompt,
        area: question.area || "",
        choices: question.choices,
        correctIndex: question.correct_index,
        passageId: passage.id,
      });
    });
  });
  return {
    title: draft.title || "",
    passages,
    questions,
  };
}

export function isBuilderCompatibleWorksheet(worksheet) {
  if (!worksheet?.questions?.length) return false;
  const passages = worksheet.passages || [];
  return passages.every((p) => {
    const body = p.body || p.text;
    return Boolean(body?.trim()) && !p.chart && !p.table;
  });
}

export function emptyMcqQuestion(passageId = "") {
  return {
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    area: "",
    passageId,
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
  return Array.from({ length: count }, () => factory());
}

export function resizeQuestions(questions, count, format) {
  if (questions.length === count) return questions;
  if (questions.length > count) return questions.slice(0, count);
  const factory =
    format === "short_answer" ? emptyShortAnswerQuestion : emptyMcqQuestion;
  const next = [...questions];
  while (next.length < count) {
    next.push(factory());
  }
  return next;
}

export function validateBuilderForm({
  title,
  subject,
  format,
  englishType,
  passages,
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

  if (subject === "english" && englishType === "reading_comprehension") {
    if (!passages?.length) {
      errors.push("Add at least one passage for reading comprehension.");
    }
    passages?.forEach((passage, i) => {
      if (!passage.title?.trim()) {
        errors.push(`Passage ${i + 1}: title is required.`);
      }
      if (!passage.body?.trim()) {
        errors.push(`Passage ${i + 1}: passage text is required.`);
      }
      const count = Math.max(1, Number(passage.questionCount) || 1);
      if (count < 1 || count > 15) {
        errors.push(`Passage ${i + 1}: question count must be between 1 and 15.`);
      }
    });
    const expectedTotal = totalRcQuestionCount(passages || []);
    if (questions.length !== expectedTotal) {
      errors.push(
        `Expected ${expectedTotal} questions from passage counts but found ${questions.length}.`,
      );
    }
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
    if (
      subject === "english" &&
      englishType === "reading_comprehension" &&
      !q.passageId
    ) {
      errors.push(`Question ${n}: missing linked passage.`);
    }
  });

  return errors;
}

export function validateBuilderParamsForAi({
  subject,
  format,
  englishType,
  passages,
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
  if (subject === "english" && englishType === "reading_comprehension") {
    if (!passages?.length) {
      errors.push("Add at least one passage for reading comprehension.");
    }
    passages?.forEach((passage, i) => {
      const count = Math.max(1, Number(passage.questionCount) || 1);
      if (count < 1 || count > 15) {
        errors.push(`Passage ${i + 1}: question count must be between 1 and 15.`);
      }
      const minWords = Number(passage.minWords);
      if (!minWords || minWords < 50) {
        errors.push(`Passage ${i + 1}: minimum words must be at least 50.`);
      } else if (minWords > 2000) {
        errors.push(`Passage ${i + 1}: minimum words must be at most 2000.`);
      }
    });
    return errors;
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

export function worksheetToBuilderState(worksheet) {
  const questions = worksheet.questions || [];
  const first = questions[0] || {};
  const format =
    worksheet.evaluation === "manual" || first.type === "short_answer"
      ? "short_answer"
      : "multiple_choice";
  const stars = Number(first.stars) || 2;
  const passages = (worksheet.passages || []).map((passage, index) => {
    const passageId = passage.id || `p${index + 1}`;
    const linkedCount = questions.filter((q) => q.passage_id === passageId).length;
    return {
      id: passageId,
      title: passage.title || "",
      body: passage.body || passage.text || "",
      questionCount: linkedCount || DEFAULT_RC_QUESTIONS_PER_PASSAGE,
      aiPrompt: "",
      minWords: DEFAULT_RC_MIN_WORDS,
    };
  });
  const englishType =
    worksheet.subject === "english"
      ? passages.length === 0
        ? "critical_reasoning"
        : passages.length > 1 ||
            questions.every((q) => q.passage_id)
          ? "reading_comprehension"
          : "critical_reasoning"
      : "";

  const builderQuestions = questions.map((q) => {
    const base = {
      prompt: q.prompt || "",
      area: q.area || "",
      passageId: q.passage_id || "",
    };
    if (format === "multiple_choice") {
      const choices = Array.isArray(q.choices) ? [...q.choices] : ["", "", "", ""];
      while (choices.length < 4) choices.push("");
      const correctIndex = Math.max(0, choices.indexOf(q.answer));
      return { ...base, choices: choices.slice(0, 4), correctIndex };
    }
    return { ...base, answer: q.answer || "" };
  });

  return {
    title: worksheet.title || "",
    subject: worksheet.subject || "math",
    stars,
    format,
    englishType,
    passages,
    timed: Boolean(worksheet.timed),
    timeLimitMinutes: worksheet.time_limit_minutes || 10,
    questionCount: questions.length,
    questions: builderQuestions,
    learnSubject: worksheet.learn_subject || "",
    learnSection: worksheet.learn_section || "",
  };
}

export function builderPayload({
  title,
  subject,
  stars,
  format,
  englishType,
  passages,
  questionCount,
  timed,
  timeLimitMinutes,
  questions,
  learnSubject,
  learnSection,
  lockOnCreate,
}) {
  const payload = {
    title: title.trim(),
    subject,
    stars,
    format,
    question_count: questionCount,
    timed,
    time_limit_minutes: timed ? Number(timeLimitMinutes) : null,
    lock_on_create: Boolean(lockOnCreate),
    questions: questions.map((q) => {
      const base = { prompt: q.prompt.trim() };
      if (q.area?.trim()) base.area = q.area.trim().toLowerCase();
      if (q.passageId) base.passage_id = q.passageId;
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

  if (subject === "english" && englishType) {
    payload.english_type = englishType;
  }
  if (
    subject === "english" &&
    englishType === "reading_comprehension" &&
    passages?.length
  ) {
    payload.passages = passages.map((passage) => ({
      id: passage.id,
      title: passage.title.trim(),
      body: passage.body.trim(),
    }));
  }

  if (learnSubject) {
    payload.learn_subject = learnSubject;
    if (learnSection) payload.learn_section = learnSection;
  }

  return payload;
}
