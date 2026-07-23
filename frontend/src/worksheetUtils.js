import { isWorksheetDone, normalizeSubjectKey } from "./subjectUtils";

/** Keep in sync with backend LATEST_WINDOW_MS (14 days). Used only if API omits is_latest. */
export const LATEST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const LATEST_WINDOW_LABEL = "14 days";

export function isLatestWorksheet(ws, now = Date.now()) {
  if (typeof ws?.is_latest === "boolean") {
    return ws.is_latest;
  }
  const ts = ws?.sort_ts;
  if (typeof ts !== "number" || Number.isNaN(ts) || ts <= 0) return false;
  return now - ts <= LATEST_WINDOW_MS;
}

export function filterLatestWorksheets(worksheets, now = Date.now()) {
  return worksheets.filter((ws) => isLatestWorksheet(ws, now));
}

/** Latest practice (non-timed) worksheets the student has not submitted yet. */
export function filterLatestUndoneWorksheets(worksheets, now = Date.now()) {
  return worksheets.filter(
    (ws) =>
      isLatestWorksheet(ws, now) &&
      !isWorksheetDone(ws) &&
      !ws.timed &&
      !ws.is_test &&
      !ws.math_enrichment &&
      !ws.gifted_track,
  );
}

/** Quest number from content_badge (e.g. "Quest 3" → 3). */
export function questTrackOrder(ws) {
  const badge = String(ws?.content_badge || "").trim();
  const match = /^Quest\s*(\d+)/i.exec(badge);
  if (match) return parseInt(match[1], 10);
  const idMatch = /^questions_(\d+)$/.exec(String(ws?.id || ""));
  if (idMatch) return parseInt(idMatch[1], 10);
  return Number.MAX_SAFE_INTEGER;
}

const GIFTED_TRACK_WEEK_MIN = 1;
const GIFTED_TRACK_WEEK_MAX = 12;

/** Program week for a Thinking Quest worksheet (API field or Quest-badge fallback). */
export function giftedTrackWeek(ws) {
  const raw = ws?.gifted_track_week;
  if (typeof raw === "number" && raw >= GIFTED_TRACK_WEEK_MIN && raw <= GIFTED_TRACK_WEEK_MAX) {
    return raw;
  }
  const quest = questTrackOrder(ws);
  if (quest >= 1 && quest <= 6) return quest * 2 - 1;
  if (quest === 7) return GIFTED_TRACK_WEEK_MAX;
  return GIFTED_TRACK_WEEK_MAX + 1;
}

/** Thinking Quest path order within a week: Quest badge, then id. */
export function sortGiftedTrackWorksheets(worksheets) {
  return [...worksheets].sort(
    (a, b) =>
      questTrackOrder(a) - questTrackOrder(b) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

/** Group gifted-track worksheets by week (ascending); empty weeks omitted. */
export function groupGiftedTrackByWeek(worksheets) {
  const byWeek = new Map();
  for (const ws of worksheets) {
    const week = giftedTrackWeek(ws);
    if (week > GIFTED_TRACK_WEEK_MAX) continue;
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week).push(ws);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, items]) => [week, sortGiftedTrackWorksheets(items)]);
}

export function worksheetPublishedQuestionToBankPayload(question) {
  const choices = (question.choices || []).map((c) => String(c || "").trim());
  return {
    prompt: String(question.prompt || "").trim(),
    choices,
    answer: String(question.answer || "").trim(),
    area: String(question.area || "").trim(),
  };
}

/** Max words in a CR stimulus passage (reading passages are usually longer). */
export const CR_STIMULUS_MAX_WORDS = 150;

function passageBodyWordCount(passage) {
  const body = String(passage?.body || passage?.text || "").trim();
  if (!body) return 0;
  return body.split(/\s+/).filter(Boolean).length;
}

/** Merge a short CR stimulus with its question into one standalone prompt. */
export function mergeCrStimulusAndPrompt(passage, question) {
  const stimulus = String(passage?.body || passage?.text || "").trim();
  const prompt =
    typeof question === "string"
      ? question.trim()
      : String(question?.prompt || "").trim();
  if (!stimulus) return prompt;
  if (!prompt) return stimulus;
  return `${stimulus} ${prompt}`;
}

/**
 * English worksheets with one short stimulus passage per question (critical reasoning),
 * not reading comprehension (multi-question long passages) or data sets.
 */
export function isCriticalReasoningWorksheetLayout(worksheet) {
  const passages = worksheet?.passages || [];
  const questions = worksheet?.questions || [];
  if (normalizeSubjectKey(worksheet?.subject) !== "english" || passages.length === 0) {
    return false;
  }
  if (questions.length === 0 || questions.length !== passages.length) {
    return false;
  }
  if (questions.some((q) => !q.passage_id)) {
    return false;
  }

  return passages.every((passage, index) => {
    const passageId = passage.id || `p${index + 1}`;
    const linked = questions.filter((q) => q.passage_id === passageId);
    if (linked.length !== 1) return false;
    if (passage.chart?.type || passage.table?.headers?.length) return false;
    return passageBodyWordCount(passage) <= CR_STIMULUS_MAX_WORDS;
  });
}

/** Questions with stimulus merged into the prompt for CR worksheet display. */
export function criticalReasoningDisplayQuestions(worksheet) {
  const passages = worksheet.passages || [];
  const questions = worksheet.questions || [];
  return passages
    .map((passage, index) => {
      const passageId = passage.id || `p${index + 1}`;
      const question = questions.find((q) => q.passage_id === passageId);
      if (!question) return null;
      return {
        ...question,
        prompt: mergeCrStimulusAndPrompt(passage, question),
      };
    })
    .filter(Boolean);
}

export function isWorksheetPassageBankReady(passage) {
  const title = String(passage?.title || "").trim();
  const body = String(passage?.body || passage?.text || "").trim();
  const hasChart = passage?.chart?.type && passage?.chart?.labels?.length;
  const hasTable = passage?.table?.headers?.length;
  return Boolean(title && (body || hasChart || hasTable));
}

export function worksheetPassageToBankPayload(passage) {
  const payload = {
    title: String(passage?.title || "").trim(),
    body: String(passage?.body || passage?.text || "").trim(),
  };
  if (passage?.chart) payload.chart = passage.chart;
  if (passage?.table) payload.table = passage.table;
  return payload;
}

/** Format seconds as M:SS or H:MM:SS for timed completion badges. */
export function formatDurationSeconds(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}
