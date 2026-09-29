import {
  CHOICE_LABELS,
  GRADE_OPTIONS,
  STARS_OPTIONS,
  buildQuestionList,
  defaultQuestionCount,
  defaultScratchpadForSubject,
  draftToBuilderQuestions,
  isBuilderQuestionComplete,
} from "./questionBuilderUtils";

export const PREP_PROGRAMS = [
  {
    value: "ccat",
    label: "CCAT",
    description:
      "Canadian Cognitive Abilities Test–style reasoning (verbal, quantitative, non-verbal). Auto-graded multiple choice.",
  },
  {
    value: "gauss",
    label: "Gauss / contest math",
    description:
      "CEMC Gauss–style contest multiple choice. Appears under Math Enrichment for students.",
  },
  {
    value: "thinking_quest",
    label: "Thinking Quest",
    description:
      "Gifted-track logic and patterns with written answers you grade. Appears under Thinking Quest by week.",
  },
];

export const CCAT_SUBJECTS = [
  { value: "general", label: "Mixed reasoning" },
  { value: "math", label: "Quantitative focus" },
  { value: "english", label: "Verbal focus" },
];

export const GIFTED_TRACK_WEEKS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Week ${i + 1}`,
}));

export function formatForPrepProgram(program) {
  return program === "thinking_quest" ? "short_answer" : "multiple_choice";
}

export function subjectForPrepProgram(program, subject) {
  if (program === "gauss") return "math";
  if program === "ccat") return subject || "general";
  return subject || "general";
}

export function inferPrepProgramFromWorksheet(worksheet) {
  if (worksheet?.prep_program) return worksheet.prep_program;
  if (worksheet?.gifted_track) return "thinking_quest";
  if (worksheet?.math_enrichment) return "gauss";
  return "ccat";
}

export function worksheetToChallengeState(worksheet) {
  const program = inferPrepProgramFromWorksheet(worksheet);
  const format = formatForPrepProgram(program);
  const questions = worksheet.questions || [];
  const first = questions[0] || {};
  const stars = Number(first.stars) || 2;

  const builderQuestions = questions.map((q) => {
    const base = {
      prompt: q.prompt || "",
      area: q.area || "",
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
    prepProgram: program,
    subject: worksheet.subject || "general",
    stars,
    format,
    questionCount: questions.length,
    questions: builderQuestions,
    giftedTrackWeek: worksheet.gifted_track_week || 1,
    contentBadge: worksheet.content_badge || "",
    timed: Boolean(worksheet.timed),
    timeLimitMinutes: worksheet.time_limit_minutes || 15,
    scratchpad: worksheet.scratchpad !== false,
  };
}

export function challengeBuilderPayload({
  title,
  prepProgram,
  subject,
  stars,
  format,
  questionCount,
  timed,
  timeLimitMinutes,
  scratchpad,
  questions,
  giftedTrackWeek,
  contentBadge,
  lockOnCreate,
}) {
  const resolvedSubject = subjectForPrepProgram(prepProgram, subject);
  const payload = {
    title: title.trim(),
    subject: resolvedSubject,
    stars,
    format,
    question_count: questions.length,
    timed,
    time_limit_minutes: timed ? Number(timeLimitMinutes) : null,
    lock_on_create: Boolean(lockOnCreate),
    scratchpad: Boolean(scratchpad),
    prep_program: prepProgram,
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

  if (prepProgram === "thinking_quest") {
    payload.gifted_track_week = Number(giftedTrackWeek) || 1;
  }
  const badge = (contentBadge || "").trim();
  if (badge) payload.content_badge = badge;

  return payload;
}

export function validateChallengeBuilderForm({
  title,
  prepProgram,
  questions,
  format,
  giftedTrackWeek,
}) {
  const errors = [];
  if (!title.trim()) errors.push("Title is required.");
  if (!prepProgram) errors.push("Choose a prep program.");
  if (prepProgram === "thinking_quest") {
    const week = Number(giftedTrackWeek);
    if (!Number.isInteger(week) || week < 1 || week > 12) {
      errors.push("Thinking Quest requires a week from 1 to 12.");
    }
  }
  if (!questions.length) errors.push("Add at least one question.");
  questions.forEach((q, i) => {
    if (!isBuilderQuestionComplete(q, format)) {
      errors.push(`Question ${i + 1} is incomplete.`);
    }
  });
  return errors;
}

export {
  CHOICE_LABELS,
  GRADE_OPTIONS,
  STARS_OPTIONS,
  buildQuestionList,
  defaultQuestionCount,
  defaultScratchpadForSubject,
  draftToBuilderQuestions,
};
