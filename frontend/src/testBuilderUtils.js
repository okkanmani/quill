import { BUILDER_SUBJECTS, CHOICE_LABELS, GRADE_OPTIONS } from "./questionBuilderUtils";

export { BUILDER_SUBJECTS, CHOICE_LABELS, GRADE_OPTIONS };

export const TEST_TIERS = [
  { value: 1, label: "Tier 1", shortLabel: "★ Easy", weight: "1×" },
  { value: 2, label: "Tier 2", shortLabel: "★★ Medium", weight: "1.5×" },
  { value: 3, label: "Tier 3", shortLabel: "★★★ Hard", weight: "2×" },
];

export const DEFAULT_SITTING_COUNT = 20;
export const DEFAULT_TIME_LIMIT_MINUTES = 45;
export const MIN_SITTING_COUNT = 1;
export const MAX_SITTING_COUNT = 100;

let questionCounter = 0;

export function newTestQuestionId() {
  questionCounter += 1;
  return `tbq_${Date.now()}_${questionCounter}`;
}

export function emptyTestQuestion(tier = 2) {
  return {
    id: newTestQuestionId(),
    tier,
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    area: "",
  };
}

export function countQuestionsByTier(questions) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const question of questions) {
    const tier = Number(question.tier);
    if (tier >= 1 && tier <= 3) counts[tier] += 1;
  }
  return counts;
}

export function minimumBankSize(sittingCount, adaptive) {
  const sitting = Number(sittingCount) || DEFAULT_SITTING_COUNT;
  return adaptive ? sitting * 3 : sitting;
}

export function isTestQuestionComplete(question) {
  if (!question?.prompt?.trim()) return false;
  if (!Array.isArray(question.choices) || question.choices.length !== 4) return false;
  if (!question.choices.every((choice) => String(choice || "").trim())) return false;
  const correctIndex = Number(question.correctIndex);
  return correctIndex >= 0 && correctIndex < 4;
}

export function validateTestBuilder({
  title,
  sittingCount,
  timeLimitMinutes,
  questions,
  adaptive = true,
}) {
  const errors = [];

  if (!title?.trim()) {
    errors.push("Test title is required.");
  }

  const sitting = Number(sittingCount);
  if (!Number.isFinite(sitting) || sitting < MIN_SITTING_COUNT || sitting > MAX_SITTING_COUNT) {
    errors.push(`Sitting size must be between ${MIN_SITTING_COUNT} and ${MAX_SITTING_COUNT}.`);
  }

  const limit = Number(timeLimitMinutes);
  if (!Number.isFinite(limit) || limit <= 0) {
    errors.push("Time limit must be a positive number of minutes.");
  }

  const tierCounts = countQuestionsByTier(questions);

  if (adaptive) {
    for (const tier of [1, 2, 3]) {
      if (tierCounts[tier] < sitting) {
        errors.push(
          `Tier ${tier} needs at least ${sitting} questions (has ${tierCounts[tier]}).`,
        );
      }
    }
  } else if (questions.length < sitting) {
    errors.push(`Question bank needs at least ${sitting} questions (has ${questions.length}).`);
  }

  questions.forEach((question, index) => {
    if (!isTestQuestionComplete(question)) {
      errors.push(`Question ${index + 1} is incomplete.`);
    }
  });

  return errors;
}

export function draftToTestBuilderQuestions(draft, { adaptive = true, sittingCount } = {}) {
  let items = (draft?.questions || []).map((question) => ({
    id: newTestQuestionId(),
    tier: Number(question.stars) || 2,
    prompt: question.prompt || "",
    choices: Array.isArray(question.choices) ? [...question.choices] : ["", "", "", ""],
    correctIndex: Number(question.correct_index) || 0,
    area: question.area || "",
  }));
  if (!adaptive && sittingCount > 0) {
    items = items.slice(0, sittingCount);
  }
  return items;
}

export function buildTestBuilderPreview({
  title,
  subject,
  sittingCount,
  timeLimitMinutes,
  questions,
  adaptive = true,
}) {
  return {
    title: title.trim(),
    subject,
    is_test: true,
    test_adaptive: adaptive,
    test_sitting_count: Number(sittingCount),
    timed: true,
    time_limit_minutes: Number(timeLimitMinutes),
    scratchpad: false,
    content_badge: "Test",
    questions: questions.map((question, index) => ({
      id: question.id || `q${index + 1}`,
      type: "multiple_choice",
      stars: Number(question.tier),
      prompt: question.prompt.trim(),
      choices: question.choices.map((choice) => choice.trim()),
      answer: question.choices[Number(question.correctIndex)]?.trim() || "",
      hint: false,
      area: question.area?.trim() || "",
    })),
  };
}
