import { BUILDER_SUBJECTS, CHOICE_LABELS, GRADE_OPTIONS, inferEnglishTypeFromWorksheet } from "./questionBuilderUtils";

export { BUILDER_SUBJECTS, CHOICE_LABELS, GRADE_OPTIONS };

export const TEST_TIERS = [
  { value: 1, label: "Tier 1", shortLabel: "★ Easy", difficultyLabel: "Easy", weight: "1×" },
  { value: 2, label: "Tier 2", shortLabel: "★★ Medium", difficultyLabel: "Medium", weight: "1.5×" },
  { value: 3, label: "Tier 3", shortLabel: "★★★ Hard", difficultyLabel: "Hard", weight: "2×" },
];

export const RC_PASSAGE_TIERS = [
  { value: 1, label: "Easy passage", shortLabel: "Easy", difficultyLabel: "Easy" },
  { value: 2, label: "Complex passage", shortLabel: "Complex", difficultyLabel: "Complex" },
];

export const RC_QUESTIONS_BANK_MULTIPLIER = 2;

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

export function isDataPassageTest(subject) {
  return subject === "data";
}

export function isRcAdaptiveTest(subject, readingComprehension, adaptive = true) {
  return readingComprehension && subject === "english" && adaptive !== false;
}

export function rcQuestionsBankSize(questionsPerPassage, adaptive = true) {
  const per = Number(questionsPerPassage) || DEFAULT_RC_QUESTIONS_PER_PASSAGE;
  return isFinite(per) && adaptive ? per * RC_QUESTIONS_BANK_MULTIPLIER : per;
}

export function rcQuestionAllowedOnPassage(passageTier, questionTier) {
  const passage = Number(passageTier);
  const question = Number(questionTier);
  if (passage === 1) return question === 1 || question === 2;
  if (passage === 2) return question === 2 || question === 3;
  return false;
}

export function defaultRcQuestionTierForPassage(passageTier) {
  return Number(passageTier) === 1 ? 1 : 2;
}

export function isPassageWindowTest(subject, readingComprehension = false) {
  return readingComprehension || isDataPassageTest(subject);
}

export function passageWindowUnitLabels(subject, readingComprehension = false) {
  if (isDataPassageTest(subject)) {
    return { singular: "data set", plural: "data sets", capitalized: "Data set" };
  }
  return { singular: "passage", plural: "passages", capitalized: "Passage" };
}

export function emptyTestPassage(id = null, tier = 2, { data = false } = {}) {
  return {
    id: id || newTestPassageId(),
    title: "",
    body: "",
    tier: Number(tier) || 2,
    ...(data ? { chart: null, table: null } : {}),
  };
}

export function isTestPassageComplete(passage, passageMode = "rc") {
  const tier = Number(passage?.tier);
  const hasTier =
    passageMode === "rc" ? tier === 1 || tier === 2 : tier >= 1 && tier <= 3;
  if (!passage?.title?.trim() || !hasTier) return false;
  if (passageMode === "data") {
    return Boolean(
      passage?.body?.trim() || passage?.chart?.type || passage?.table?.headers?.length,
    );
  }
  return Boolean(passage?.body?.trim());
}

export function emptyRcTestQuestion(passageId, passageTier = 1) {
  return {
    id: newTestQuestionId(),
    tier: defaultRcQuestionTierForPassage(passageTier),
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    area: "",
    passageId,
  };
}

export function countPassagesByTier(passages, { rcMode = false } = {}) {
  const counts = rcMode ? { 1: 0, 2: 0 } : { 1: 0, 2: 0, 3: 0 };
  for (const passage of passages || []) {
    const tier = Number(passage.tier);
    if (counts[tier] != null) counts[tier] += 1;
  }
  return counts;
}

export function inferPassageTierFromWorksheet(passage, questions) {
  const stored = Number(passage?.tier ?? passage?.stars);
  if (stored === 1 || stored === 2) return stored;
  if (stored === 3) return 2;
  return 1;
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

export function minimumBankSize(sittingCount, adaptive, passageWindow = false, rcMode = false) {
  const sitting = Number(sittingCount) || DEFAULT_SITTING_COUNT;
  if (passageWindow) return minimumRcPassageBankSize(sitting, adaptive, { rcMode });
  return adaptive ? sitting * 3 : sitting;
}

export function minimumRcPassageBankSize(passageCount, adaptive, { rcMode = false } = {}) {
  const count = Number(passageCount) || DEFAULT_RC_PASSAGE_COUNT;
  if (!rcMode) return adaptive ? count * 3 : count;
  return adaptive ? count * 2 : count;
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

export function syncPassageQuestions(
  passages,
  questions,
  questionsPerPassage,
  { rcAdaptive = false, adaptive = true } = {},
) {
  const target = rcAdaptive
    ? rcQuestionsBankSize(questionsPerPassage, adaptive)
    : Math.max(
        MIN_RC_QUESTIONS_PER_PASSAGE,
        Number(questionsPerPassage) || DEFAULT_RC_QUESTIONS_PER_PASSAGE,
      );
  const orphans = unassignedTestQuestions(passages, questions);
  const next = [...orphans];
  for (const passage of passages || []) {
    const linked = (questions || []).filter((question) => question.passageId === passage.id);
    let bucket = [...linked];
    while (bucket.length < target) {
      bucket.push(emptyRcTestQuestion(passage.id, passage.tier));
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
  passageWindow = false,
  passageMode = "rc",
  passages = [],
  questionsPerPassage = DEFAULT_RC_QUESTIONS_PER_PASSAGE,
}) {
  const errors = [];
  const isDataMode = passageMode === "data";
  const unit = isDataMode ? "data set" : "passage";

  if (!title?.trim()) {
    errors.push("Test title is required.");
  }

  const limit = Number(timeLimitMinutes);
  if (!Number.isFinite(limit) || limit <= 0) {
    errors.push("Time limit must be a positive number of minutes.");
  }

  if (passageWindow || readingComprehension) {
    const passageCount = Number(sittingCount);
    const perPassage = Number(questionsPerPassage);
    const rcMode = !isDataMode && readingComprehension;
    const bankSize = rcMode ? rcQuestionsBankSize(perPassage, adaptive) : perPassage;
    if (
      !Number.isFinite(passageCount) ||
      passageCount < MIN_RC_PASSAGE_COUNT ||
      passageCount > MAX_RC_PASSAGE_COUNT
    ) {
      errors.push(
        `${isDataMode ? "Data sets" : "Passages"} per test must be between ${MIN_RC_PASSAGE_COUNT} and ${MAX_RC_PASSAGE_COUNT}.`,
      );
    }
    if (
      !Number.isFinite(perPassage) ||
      perPassage < MIN_RC_QUESTIONS_PER_PASSAGE ||
      perPassage > MAX_RC_QUESTIONS_PER_PASSAGE
    ) {
      errors.push(
        `Questions shown per ${unit} must be between ${MIN_RC_QUESTIONS_PER_PASSAGE} and ${MAX_RC_QUESTIONS_PER_PASSAGE}.`,
      );
    }

    const tierCounts = countPassagesByTier(passages, { rcMode });
    if (adaptive) {
      const requiredTiers = rcMode ? [1, 2] : [1, 2, 3];
      for (const tier of requiredTiers) {
        if ((tierCounts[tier] || 0) < passageCount) {
          const label = rcMode
            ? tier === 1
              ? "easy"
              : "complex"
            : `tier ${tier}`;
          errors.push(
            `${label.charAt(0).toUpperCase() + label.slice(1)} ${unit}s need at least ${passageCount} (has ${tierCounts[tier] || 0}).`,
          );
        }
      }
    } else if (passages.length < passageCount) {
      errors.push(
        `Add at least ${passageCount} ${unit}s for this test (has ${passages.length}).`,
      );
    }

    if (!passages.length) {
      errors.push(
        isDataMode
          ? "Add at least one data set for data analysis."
          : "Add at least one passage for reading comprehension.",
      );
    }
    passages.forEach((passage, index) => {
      if (!passage.title?.trim()) {
        errors.push(`${isDataMode ? "Data set" : "Passage"} ${index + 1} needs a title.`);
      }
      if (isDataMode) {
        const hasVisual =
          passage.body?.trim() || passage.chart?.type || passage.table?.headers?.length;
        if (!hasVisual) {
          errors.push(
            `Data set ${index + 1} needs a caption, chart, or table (use AI or import from bank).`,
          );
        }
      } else if (!passage.body?.trim()) {
        errors.push(`Passage ${index + 1} needs passage text.`);
      }
      const tier = Number(passage.tier);
      if (rcMode) {
        if (tier !== 1 && tier !== 2) {
          errors.push(`Passage ${index + 1} must be easy or complex.`);
        }
      } else if (!Number.isFinite(tier) || tier < 1 || tier > 3) {
        errors.push(`${isDataMode ? "Data set" : "Passage"} ${index + 1} needs a difficulty tier.`);
      }
      const linked = questions.filter((question) => question.passageId === passage.id);
      if (linked.length !== bankSize) {
        errors.push(
          `${isDataMode ? "Data set" : "Passage"} ${index + 1} needs exactly ${bankSize} questions in the bank (has ${linked.length}).`,
        );
      }
      linked.forEach((question, questionIndex) => {
        if (!isTestQuestionComplete(question)) {
          errors.push(
            `${isDataMode ? "Data set" : "Passage"} ${index + 1}, question ${questionIndex + 1} is incomplete.`,
          );
        }
        if (rcMode) {
          const qTier = Number(question.tier);
          if (!Number.isFinite(qTier) || qTier < 1 || qTier > 3) {
            errors.push(
              `Passage ${index + 1}, question ${questionIndex + 1} needs a question tier (1–3).`,
            );
          } else if (!rcQuestionAllowedOnPassage(tier, qTier)) {
            errors.push(
              `Passage ${index + 1}, question ${questionIndex + 1}: tier ${qTier} is not allowed on a ${tier === 1 ? "easy" : "complex"} passage.`,
            );
          }
        }
      });
    });
    const passageIds = new Set(passages.map((passage) => passage.id));
    questions.forEach((question, index) => {
      if (!question.passageId || !passageIds.has(question.passageId)) {
        errors.push(`Question ${index + 1} must be linked to a ${unit}.`);
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

export function draftDataToTestBuilderState(draft) {
  const passages = (draft?.passages || []).map((passage, index) => ({
    id: passage.id || newTestPassageId(),
    title: passage.title || "",
    body: passage.body || "",
    chart: passage.chart ?? null,
    table: passage.table ?? null,
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
        tier: Number(question.stars ?? question.tier) || (Number(passage.tier) === 1 ? 1 : 2),
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
    dataPassageTestEnabled:
      worksheet.subject === "data" && (worksheet.passages || []).length > 0,
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

export function testPassageToBankPayload(passage) {
  const payload = {
    title: String(passage?.title || "").trim(),
    body: String(passage?.body || "").trim(),
  };
  if (passage?.chart) payload.chart = passage.chart;
  if (passage?.table) payload.table = passage.table;
  return payload;
}

export function testQuestionToContextBankPayload(question, passage) {
  const choices = (question.choices || []).map((c) => String(c || "").trim());
  const idx = Number(question.correctIndex);
  const stars =
    Number(question.tier ?? question.bankTier) || Number(passage?.tier) || 2;
  return {
    prompt: String(question.prompt || "").trim(),
    choices,
    answer: choices[idx] || "",
    area: String(question.area || "").trim(),
    stars,
  };
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
  passageWindow = false,
  passageMode = "rc",
  questionsPerPassage = DEFAULT_RC_QUESTIONS_PER_PASSAGE,
}) {
  const usesPassageTiers = passageWindow && passageMode === "data";
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
          usesPassageTiers && question.passageId
            ? passageTierById(passages)[question.passageId] || 2
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
  }
  if (usesPassageTiers || (passageWindow && readingComprehension)) {
    payload.test_rc_questions_per_passage =
      Number(questionsPerPassage) || DEFAULT_RC_QUESTIONS_PER_PASSAGE;
  }
  return payload;
}
