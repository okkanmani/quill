import {
  formatSubjectLabel,
  normalizeSubjectKey,
  subjectSortKey,
} from "./subjectUtils";

export function formatAreaLabel(areaSlug) {
  if (!areaSlug) return "";
  return String(areaSlug).replace(/-/g, " ");
}

function areaKey(area) {
  return String(area || "").trim().toLowerCase();
}

export function focusDiscussionKey(subjectKey, area) {
  return `${subjectKey}::${areaKey(area)}`;
}

function analysisTimestamp(result, evaluation) {
  const uploaded = evaluation?.uploaded_at;
  if (uploaded) return String(uploaded);
  if (result?.evaluated_at) return String(result.evaluated_at);
  if (result?.submitted_at) return String(result.submitted_at);
  return "";
}

function needsDiscussionForArea(focusArea, subjectKey, discussedMap) {
  const key = focusDiscussionKey(subjectKey, focusArea.area);
  const discussedAt = discussedMap[key];
  if (!discussedAt) return true;
  const latestAnalysisAt = focusArea.latestAnalysisAt || "";
  if (!latestAnalysisAt) return false;
  return latestAnalysisAt > discussedAt;
}

/**
 * Split focus areas into needs-discussion vs already-discussed buckets.
 * Newer analysis after a prior discussion moves an area back to needs discussion.
 */
export function splitFocusAreasByDiscussion(focusAreas, subjectKey, discussedMap) {
  const needsDiscussion = [];
  const alreadyDiscussed = [];

  for (const focus of focusAreas || []) {
    if (needsDiscussionForArea(focus, subjectKey, discussedMap)) {
      needsDiscussion.push({ ...focus, needsDiscussion: true });
    } else {
      alreadyDiscussed.push({ ...focus, needsDiscussion: false });
    }
  }

  return { needsDiscussion, alreadyDiscussed };
}

function sortDiscussionBuckets({ needsDiscussion, alreadyDiscussed }) {
  return {
    needsDiscussion: sortFocusAreasByUrgency(needsDiscussion),
    alreadyDiscussed: sortFocusAreasByUrgency(alreadyDiscussed),
  };
}

export function buildDiscussedMap(discussedRecords) {
  const map = {};
  for (const row of discussedRecords || []) {
    const subjectKey = normalizeSubjectKey(row.subject);
    map[focusDiscussionKey(subjectKey, row.area)] = row.discussed_at;
  }
  return map;
}

const MAX_EXAMPLES_PER_AREA = 3;

function exampleKey(example) {
  const qid = example?.question_id;
  if (qid) return `id:${qid}`;
  return `q:${String(example?.question || "").trim().toLowerCase()}`;
}

function answerRowForQuestion(result, question) {
  const qid = question?.question_id;
  if (qid) {
    return (result?.answers || []).find((a) => a?.question_id === qid);
  }
  const prompt = String(question?.question || "").trim();
  if (!prompt) return null;
  return (result?.answers || []).find((a) => String(a?.prompt || "").trim() === prompt);
}

function enrichEvaluationQuestion(question, result) {
  const answerRow = answerRowForQuestion(result, question);
  const choices = Array.isArray(question?.choices)
    ? question.choices
    : [];
  const expected =
    question?.expected ??
    answerRow?.expected ??
    "";
  return {
    question_id: question?.question_id ?? answerRow?.question_id ?? null,
    question: question?.question || answerRow?.prompt || "",
    answer: question?.answer ?? answerRow?.given ?? "",
    expected: expected != null ? String(expected) : "",
    choices,
    correct: question?.correct,
  };
}

function addWrongExample(entry, question, result) {
  const example = enrichEvaluationQuestion(question, result);
  if (example.correct !== false) return;
  if (!example.question.trim()) return;

  const countKey = wrongCountKey(result, question, example);
  if (!entry.wrongCountKeys.has(countKey)) {
    entry.wrongCountKeys.add(countKey);
    entry.wrongCount += 1;
  }

  const key = exampleKey(example);
  if (entry.exampleKeys.has(key)) return;
  if (entry.examples.length >= MAX_EXAMPLES_PER_AREA) return;

  entry.exampleKeys.add(key);
  entry.examples.push(example);
}

function wrongCountKey(result, question, example) {
  const resultId = result?.id ?? result?.focus_evaluation?.result_id ?? "unknown";
  if (question?.question_id) {
    return `${resultId}:${question.question_id}`;
  }
  return `${resultId}:${exampleKey(example)}`;
}

/** Use share-of-total when a subject has at least this many wrong answers overall. */
const MIN_TOTAL_FOR_RELATIVE_URGENCY = 3;
/** Absolute fallback tiers when relative scoring is not meaningful. */
const ABSOLUTE_URGENCY_HIGH = 5;
const ABSOLUTE_URGENCY_MEDIUM = 3;

export function getFocusAreaUrgencyTierForArea(
  wrongCount,
  { totalWrong = 0, maxWrong = 0 } = {},
) {
  const count = Number(wrongCount) || 0;
  if (count <= 0) return "low";

  const total = Number(totalWrong) || 0;
  if (total < MIN_TOTAL_FOR_RELATIVE_URGENCY) {
    if (count >= ABSOLUTE_URGENCY_HIGH) return "high";
    if (count >= ABSOLUTE_URGENCY_MEDIUM) return "medium";
    return "low";
  }

  const share = count / total;
  const isClearLeader = count === maxWrong && count >= 2 && share >= 0.4;

  if (share >= 0.5 || isClearLeader) return "high";
  if (share >= 0.25 || count >= ABSOLUTE_URGENCY_MEDIUM) return "medium";
  return "low";
}

/**
 * Relative urgency within one subject's focus-area list.
 * Example: 4 algebra + 1 geometry → algebra high, geometry low.
 */
export function buildFocusAreaUrgencyMap(areas) {
  const list = areas || [];
  const totalWrong = list.reduce((sum, area) => sum + (area.wrongCount || 0), 0);
  const maxWrong = Math.max(0, ...list.map((area) => area.wrongCount || 0));
  const context = { totalWrong, maxWrong };

  const map = {};
  for (const focus of list) {
    map[focus.area] = getFocusAreaUrgencyTierForArea(focus.wrongCount, context);
  }
  return map;
}

export function getFocusAreaUrgencyTier(wrongCount) {
  return getFocusAreaUrgencyTierForArea(wrongCount);
}

export function focusAreaUrgencyChipClass(
  tier,
  { selected = false, muted = false } = {},
) {
  if (selected) {
    return muted
      ? "bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400 ring-offset-1 shadow-sm"
      : "bg-indigo-800 text-white border-indigo-900 ring-2 ring-indigo-400 ring-offset-1 shadow-sm";
  }

  if (muted) {
    return "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800";
  }

  if (tier === "high") {
    return "bg-rose-100 text-rose-950 border-rose-300 hover:bg-rose-200";
  }
  if (tier === "medium") {
    return "bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200";
  }
  return "bg-lime-50 text-lime-950 border-lime-300 hover:bg-lime-100";
}

export function sortFocusAreasByUrgency(focusAreas) {
  return [...(focusAreas || [])].sort(
    (a, b) =>
      (b.wrongCount || 0) - (a.wrongCount || 0) ||
      String(a.area).localeCompare(String(b.area)),
  );
}

/**
 * Per subject: focus areas from uploaded per-worksheet evaluations (`focus_evaluation`),
 * each with up to 3 sample incorrect questions when available.
 */
export function focusAreasAnalysis(results) {
  /** subjectKey → Map(areaKey → focus area entry) */
  const bySubject = new Map();

  for (const result of results || []) {
    const evaluation = result?.focus_evaluation;
    const questions = evaluation?.questions;
    if (!Array.isArray(questions) || questions.length === 0) continue;

    const subjectKey = normalizeSubjectKey(
      evaluation?.subject || result?.subject,
    );
    if (!bySubject.has(subjectKey)) bySubject.set(subjectKey, new Map());
    const areas = bySubject.get(subjectKey);

    for (const q of questions) {
      const area = typeof q?.area === "string" ? q.area.trim() : "";
      if (!area) continue;

      const key = areaKey(area);
      if (!areas.has(key)) {
        areas.set(key, {
          area,
          examples: [],
          exampleKeys: new Set(),
          wrongCountKeys: new Set(),
          wrongCount: 0,
          latestAnalysisAt: "",
        });
      }
      const entry = areas.get(key);
      const ts = analysisTimestamp(result, evaluation);
      if (ts && ts > entry.latestAnalysisAt) {
        entry.latestAnalysisAt = ts;
      }
      addWrongExample(entry, q, result);
    }
  }

  return [...bySubject.entries()]
    .map(([subjectKey, areaMap]) => {
      const focusAreas = [...areaMap.values()]
        .map(({ area, examples, latestAnalysisAt, wrongCount }) => ({
          area,
          examples,
          latestAnalysisAt,
          wrongCount,
        }))
        .sort(
          (a, b) =>
            (b.wrongCount || 0) - (a.wrongCount || 0) ||
            a.area.localeCompare(b.area),
        );
      return {
        subjectKey,
        subjectLabel: formatSubjectLabel(subjectKey),
        areasToFocus: focusAreas.map((f) => f.area),
        focusAreas,
      };
    })
    .filter((s) => s.focusAreas.length > 0)
    .sort(
      (a, b) =>
        subjectSortKey(a.subjectKey) - subjectSortKey(b.subjectKey) ||
        a.subjectLabel.localeCompare(b.subjectLabel),
    );
}

/**
 * Aggregate focus areas and split by discussion status for the Analysis page.
 */
export function focusAreasAnalysisWithDiscussion(results, discussedRecords) {
  const discussedMap = buildDiscussedMap(discussedRecords);
  return focusAreasAnalysis(results).map((subject) => {
    const buckets = splitFocusAreasByDiscussion(
      subject.focusAreas,
      subject.subjectKey,
      discussedMap,
    );
    const { needsDiscussion, alreadyDiscussed } = sortDiscussionBuckets(buckets);
    return {
      ...subject,
      needsDiscussion,
      alreadyDiscussed,
    };
  });
}

export function formatFocusAreaList(areas) {
  if (!areas?.length) return "—";
  return areas.join(", ");
}

export function formatFocusExampleChoices(choices) {
  if (!Array.isArray(choices) || choices.length === 0) return "";
  return choices.map((c) => String(c)).join(" · ");
}

export function formatFocusExampleAnswer(answer) {
  if (answer == null || String(answer).trim() === "") {
    return "Did not answer";
  }
  return String(answer);
}

export function isMissingFocusExampleAnswer(answer) {
  return answer == null || String(answer).trim() === "";
}
