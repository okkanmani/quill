import { BUILDER_SUBJECTS, CHOICE_LABELS, GRADE_OPTIONS, inferEnglishTypeFromWorksheet } from "./questionBuilderUtils";

export { BUILDER_SUBJECTS, CHOICE_LABELS, GRADE_OPTIONS };

export const TEST_TIERS = [
  { value: 1, label: "Tier 1", shortLabel: "★ Easy", difficultyLabel: "Easy", weight: "1×" },
  { value: 2, label: "Tier 2", shortLabel: "★★ Medium", difficultyLabel: "Medium", weight: "1.5×" },
  { value: 3, label: "Tier 3", shortLabel: "★★★ Hard", difficultyLabel: "Hard", weight: "2×" },
];

export const DEFAULT_SITTING_COUNT = 20;
export const DEFAULT_TIME_LIMIT_MINUTES = 45;
export const DEFAULT_RC_PASSAGE_COUNT = 3;
export const DEFAULT_RC_QUESTIONS_PER_PASSAGE = 4;
export const MIN_SITTING_COUNT = 1;
export const MAX_SITTING_COUNT = 100;
export const MIN_RC_PASSAGE_COUNT = 1;
export const MAX_RC_PASSAGE_COUNT = 20;
export const MIN_RC_QUESTIONS_PER_PASSAGE = 1;
export const MAX_RC_QUESTIONS_PER_PASSAGE = 12;

let questionCounter = 0;
let passageCounter = 0;

export function newTestPassageId() {
  passageCounter += 1;
  return `tp_${Date.now()}_${passageCounter}`;
}

export function emptyTestPassage(id = null, tier = 2) {
  return {
    id: id || newTestPassageId(),
    title: "",
    body: "",
    tier: Number(tier) || 2,
  };
}

export function isTestPassageComplete(passage) {
  const tier = Number(passage?.tier);
  return (
    Boolean(passage?.title?.trim() && passage?.body?.trim()) &&
    tier >= 1 &&
    tier <= 3
  );
}

export function emptyRcTestQuestion(passageId) {
  return {
    id: newTestQuestionId(),
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    area: "",
    passageId,
  };
}

export function countRcQuestionsByPassageTier(passages, questions) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  const passageTierById = Object.fromEntries(
    (passages || []).map((passage) => [passage.id, Number(passage.tier) || 2]),
  );
  for (const question of questions || []) {
    const tier = passageTierById[question.passageId];
    if (tier >= 1 && tier <= 3) counts[tier] += 1;
  }
  return counts;
}

export function countPassagesByTier(passages) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const passage of passages || []) {
    const tier = Number(passage.tier);
    if (tier >= 1 && tier <= 3) counts[tier] += 1;
  }
  return counts;
}

export function inferPassageTierFromWorksheet(passage, questions) {
  const stored = Number(passage?.tier ?? passage?.stars);
  if (stored >= 1 && stored <= 3) return stored;
  const linked = (questions || []).filter(
    (question) => question.passage_id === passage.id || question.passageId === passage.id,
  );
  const tiers = linked
    .map((question) => Number(question.stars ?? question.tier))
    .filter((tier) => tier >= 1 && tier <= 3);
  if (!tiers.length) return 2;
  const tally = { 1: 0, 2: 0, 3: 0 };
  for (const tier of tiers) tally[tier] += 1;
  return Number(
    Object.entries(tally).sort((left, right) => right[1] - left[1])[0][0],
  );
}

export function passageTierById(passages) {
  return Object.fromEntries(
    (passages || []).map((passage) => [passage.id, Number(passage.tier) || 2]),
  );
}

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

export function fixedOrderAiBankSize(sittingCount) {
  const sitting = Number(sittingCount) || DEFAULT_SITTING_COUNT;
  return Math.max(sitting + 4, Math.ceil(sitting * 1.2));
}

export function minimumBankSize(sittingCount, adaptive, readingComprehension = false) {
  const sitting = Number(sittingCount) || DEFAULT_SITTING_COUNT;
  if (readingComprehension) return minimumRcPassageBankSize(sitting, adaptive);
  return adaptive ? sitting * 3 : sitting;
}

export function minimumRcPassageBankSize(passageCount, adaptive) {
  const count = Number(passageCount) || DEFAULT_RC_PASSAGE_COUNT;
  return adaptive ? count * 3 : count;
}

export function inferQuestionsPerPassageFromWorksheet(worksheet) {
  const stored = Number(worksheet?.test_rc_questions_per_passage);
  if (stored >= MIN_RC_QUESTIONS_PER_PASSAGE) return stored;
  const passages = worksheet?.passages || [];
  const questions = worksheet?.questions || [];
  if (!passages.length) return DEFAULT_RC_QUESTIONS_PER_PASSAGE;
  const counts = passages.map(
    (passage) =>
      questions.filter((question) => question.passage_id === passage.id).length,
  );
  const nonZero = counts.filter((count) => count > 0);
  if (!nonZero.length) return DEFAULT_RC_QUESTIONS_PER_PASSAGE;
  return Math.max(...nonZero);
}

export function syncPassageQuestions(passages, questions, questionsPerPassage) {
  const target = Math.max(
    MIN_RC_QUESTIONS_PER_PASSAGE,
    Number(questionsPerPassage) || DEFAULT_RC_QUESTIONS_PER_PASSAGE,
  );
  const orphans = unassignedTestQuestions(passages, questions);
  const next = [...orphans];
  for (const passage of passages || []) {
    const linked = (questions || []).filter((question) => question.passageId === passage.id);
    let bucket = [...linked];
    while (bucket.length < target) {
      bucket.push(emptyRcTestQuestion(passage.id));
    }
    if (bucket.length > target) bucket = bucket.slice(0, target);
    next.push(...bucket);
  }
  return next;
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
  readingComprehension = false,
  passages = [],
  questionsPerPassage = DEFAULT_RC_QUESTIONS_PER_PASSAGE,
}) {
  const errors = [];

  if (!title?.trim()) {
    errors.push("Test title is required.");
  }

  const limit = Number(timeLimitMinutes);
  if (!Number.isFinite(limit) || limit <= 0) {
    errors.push("Time limit must be a positive number of minutes.");
  }

  if (readingComprehension) {
    const passageCount = Number(sittingCount);
    const perPassage = Number(questionsPerPassage);
    if (
      !Number.isFinite(passageCount) ||
      passageCount < MIN_RC_PASSAGE_COUNT ||
      passageCount > MAX_RC_PASSAGE_COUNT
    ) {
      errors.push(
        `Passages per test must be between ${MIN_RC_PASSAGE_COUNT} and ${MAX_RC_PASSAGE_COUNT}.`,
      );
    }
    if (
      !Number.isFinite(perPassage) ||
      perPassage < MIN_RC_QUESTIONS_PER_PASSAGE ||
      perPassage > MAX_RC_QUESTIONS_PER_PASSAGE
    ) {
      errors.push(
        `Questions per passage must be between ${MIN_RC_QUESTIONS_PER_PASSAGE} and ${MAX_RC_QUESTIONS_PER_PASSAGE}.`,
      );
    }

    const tierCounts = countPassagesByTier(passages);
    if (adaptive) {
      for (const tier of [1, 2, 3]) {
        if (tierCounts[tier] < passageCount) {
          errors.push(
            `Tier ${tier} needs at least ${passageCount} passages (has ${tierCounts[tier]}).`,
          );
        }
      }
    } else if (passages.length < passageCount) {
      errors.push(
        `Add at least ${passageCount} passages for this test (has ${passages.length}).`,
      );
    }

    if (!passages.length) {
      errors.push("Add at least one passage for reading comprehension.");
    }
    passages.forEach((passage, index) => {
      if (!passage.title?.trim()) {
        errors.push(`Passage ${index + 1} needs a title.`);
      }
      if (!passage.body?.trim()) {
        errors.push(`Passage ${index + 1} needs passage text.`);
      }
      const tier = Number(passage.tier);
      if (!Number.isFinite(tier) || tier < 1 || tier > 3) {
        errors.push(`Passage ${index + 1} needs a difficulty tier.`);
      }
      const linked = questions.filter((question) => question.passageId === passage.id);
      if (linked.length !== perPassage) {
        errors.push(
          `Passage ${index + 1} needs exactly ${perPassage} questions (has ${linked.length}).`,
        );
      }
      linked.forEach((question, questionIndex) => {
        if (!isTestQuestionComplete(question)) {
          errors.push(`Passage ${index + 1}, question ${questionIndex + 1} is incomplete.`);
        }
      });
    });
    const passageIds = new Set(passages.map((passage) => passage.id));
    questions.forEach((question, index) => {
      if (!question.passageId || !passageIds.has(question.passageId)) {
        errors.push(`Question ${index + 1} must be linked to a passage.`);
      }
    });
    return errors;
  }

  const sitting = Number(sittingCount);
  if (!Number.isFinite(sitting) || sitting < MIN_SITTING_COUNT || sitting > MAX_SITTING_COUNT) {
    errors.push(`Sitting size must be between ${MIN_SITTING_COUNT} and ${MAX_SITTING_COUNT}.`);
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

export function draftToTestBuilderQuestions(draft) {
  return (draft?.questions || []).map((question) => ({
    id: newTestQuestionId(),
    tier: Number(question.stars) || 2,
    prompt: question.prompt || "",
    choices: Array.isArray(question.choices) ? [...question.choices] : ["", "", "", ""],
    correctIndex: Number(question.correct_index) || 0,
    area: question.area || "",
  }));
}

export function draftRcToTestBuilderState(draft) {
  const passages = (draft?.passages || []).map((passage, index) => ({
    id: passage.id || newTestPassageId(),
    title: passage.title || "",
    body: passage.body || "",
    tier: Number(passage.tier) || 2,
  }));
  const questions = [];
  for (const passage of draft?.passages || []) {
    for (const question of passage.questions || []) {
      questions.push({
        id: newTestQuestionId(),
        prompt: question.prompt || "",
        area: question.area || "",
        choices: Array.isArray(question.choices)
          ? [...question.choices]
          : ["", "", "", ""],
        correctIndex: Number(question.correct_index) || 0,
        passageId: passage.id,
      });
    }
  }
  return {
    title: draft?.title || "",
    passages,
    questions,
  };
}

export function worksheetQuestionToTestBuilderQuestion(question) {
  const choices = Array.isArray(question?.choices) ? [...question.choices] : ["", "", "", ""];
  while (choices.length < 4) choices.push("");
  const answer = String(question?.answer || "").trim();
  let correctIndex = choices.findIndex((c) => String(c).trim() === answer);
  if (correctIndex < 0) correctIndex = 0;
  return {
    id: newTestQuestionId(),
    tier: Number(question?.stars) || 2,
    prompt: question?.prompt || "",
    choices: choices.slice(0, 4),
    correctIndex,
    area: question?.area || "",
    passageId: question?.passage_id || null,
  };
}

export function worksheetToTestBuilderState(worksheet) {
  if (!worksheet?.is_test) {
    throw new Error("This worksheet is not a test.");
  }
  const mapped = (worksheet.questions || []).map((question, index) => {
    const built = worksheetQuestionToTestBuilderQuestion(question);
    return {
      ...built,
      id: question.id || built.id,
      passageId: question.passage_id || null,
    };
  });
  return {
    title: worksheet.title || "",
    subject: worksheet.subject || "math",
    sittingCount: Number(worksheet.test_sitting_count) || DEFAULT_SITTING_COUNT,
    questionsPerPassage: inferQuestionsPerPassageFromWorksheet(worksheet),
    timeLimitMinutes: Number(worksheet.time_limit_minutes) || DEFAULT_TIME_LIMIT_MINUTES,
    adaptiveEnabled: worksheet.test_adaptive !== false,
    readingComprehensionEnabled:
      worksheet.english_type === "reading_comprehension" ||
      (worksheet.subject === "english" &&
        inferEnglishTypeFromWorksheet(worksheet) === "reading_comprehension"),
    passages: (worksheet.passages || [])
      .map((passage) => {
        const normalized = worksheetPassageToTestPassage(passage);
        if (!normalized) return null;
        return {
          ...normalized,
          tier: inferPassageTierFromWorksheet(passage, worksheet.questions || []),
        };
      })
      .filter(Boolean),
    questions:
      mapped.length > 0
        ? mapped
        : [emptyTestQuestion(1), emptyTestQuestion(2), emptyTestQuestion(3)],
  };
}

export function groupTestQuestionsByPassage(passages, questions) {
  return (passages || []).map((passage) => ({
    passage,
    questions: (questions || []).filter((question) => question.passageId === passage.id),
  }));
}

export function unassignedTestQuestions(passages, questions) {
  const passageIds = new Set((passages || []).map((passage) => passage.id));
  return (questions || []).filter(
    (question) => !question.passageId || !passageIds.has(question.passageId),
  );
}

export function trimQuestionsForPublish(questions, sittingCount, adaptive) {
  if (adaptive || questions.length <= sittingCount) return questions;
  return questions.slice(0, sittingCount);
}

export function bankPassageToTestPassage(passage, tier = null) {
  if (!passage?.id) return null;
  return {
    id: passage.id,
    title: passage.title || "",
    body: passage.body || passage.text || "",
    tier: Number(tier ?? passage.tier ?? passage.stars) || 2,
    ...(passage.chart ? { chart: passage.chart } : {}),
    ...(passage.table ? { table: passage.table } : {}),
  };
}

export function mergeTestPassages(existing, incoming) {
  const byId = new Map((existing || []).filter((p) => p?.id).map((p) => [p.id, p]));
  for (const passage of incoming || []) {
    const normalized = bankPassageToTestPassage(passage);
    if (normalized) byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values());
}

export function worksheetPassageToTestPassage(passage) {
  return bankPassageToTestPassage(passage);
}

export function bankItemToTestQuestion(item) {
  const choices = Array.isArray(item?.choices) ? [...item.choices] : ["", "", "", ""];
  while (choices.length < 4) choices.push("");
  const answer = String(item?.answer || "").trim();
  let correctIndex = choices.findIndex((c) => String(c).trim() === answer);
  if (correctIndex < 0) correctIndex = 0;
  return {
    id: newTestQuestionId(),
    prompt: item?.prompt || "",
    choices: choices.slice(0, 4),
    correctIndex,
    area: item?.area || "",
    passageId: item?.passage_id || null,
    bankTier: Number(item?.stars) || null,
  };
}

export function testQuestionToBankPayload(question, subject, passageId = null, passages = []) {
  const choices = question.choices.map((c) => String(c || "").trim());
  const idx = Number(question.correctIndex);
  const pid = passageId ?? question.passageId;
  const passage = (passages || []).find((entry) => entry.id === pid);
  const stars = passage?.tier
    ? Number(passage.tier)
    : Number(question.tier ?? question.bankTier) || 2;
  const payload = {
    subject,
    stars,
    prompt: question.prompt.trim(),
    choices,
    answer: choices[idx] || "",
    area: question.area?.trim() || "",
  };
  if (pid) payload.passage_id = pid;
  return payload;
}

export function bankItemToEditorQuestion(item) {
  const q = bankItemToTestQuestion(item);
  return { ...q, bankId: item.id, passageId: item.passage_id || null };
}

export function editorQuestionToBankPayload(question, subject, passageId = null) {
  return testQuestionToBankPayload(question, subject, passageId ?? question.passageId);
}

export function buildTestBuilderPreview({
  title,
  subject,
  sittingCount,
  timeLimitMinutes,
  questions,
  passages = [],
  adaptive = true,
  readingComprehension = false,
  questionsPerPassage = DEFAULT_RC_QUESTIONS_PER_PASSAGE,
}) {
  const tiers = passageTierById(passages);
  const usedPassageIds = new Set(
    questions.map((question) => question.passageId).filter(Boolean),
  );
  const passagesOut = (passages || [])
    .filter((passage) => usedPassageIds.has(passage.id))
    .map((passage) => ({
      id: passage.id,
      title: passage.title.trim(),
      body: passage.body.trim(),
      tier: Number(passage.tier) || 2,
      ...(passage.chart ? { chart: passage.chart } : {}),
      ...(passage.table ? { table: passage.table } : {}),
    }));

  const payload = {
    title: title.trim(),
    subject,
    is_test: true,
    test_adaptive: adaptive,
    test_sitting_count: Number(sittingCount),
    timed: true,
    time_limit_minutes: Number(timeLimitMinutes),
    scratchpad: true,
    content_badge: "Test",
    questions: questions.map((question, index) => {
      const item = {
        id: question.id || `q${index + 1}`,
        type: "multiple_choice",
        stars:
          readingComprehension && question.passageId
            ? tiers[question.passageId] || 2
            : Number(question.tier) || 2,
        prompt: question.prompt.trim(),
        choices: question.choices.map((choice) => choice.trim()),
        answer: question.choices[Number(question.correctIndex)]?.trim() || "",
        hint: false,
        area: question.area?.trim() || "",
      };
      if (question.passageId) item.passage_id = question.passageId;
      return item;
    }),
  };
  if (passagesOut.length) payload.passages = passagesOut;
  if (readingComprehension && subject === "english") {
    payload.english_type = "reading_comprehension";
    payload.test_rc_questions_per_passage = Number(questionsPerPassage) || DEFAULT_RC_QUESTIONS_PER_PASSAGE;
  }
  return payload;
}
