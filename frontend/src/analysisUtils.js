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

  const key = exampleKey(example);
  if (entry.exampleKeys.has(key)) return;
  if (entry.examples.length >= MAX_EXAMPLES_PER_AREA) return;

  entry.exampleKeys.add(key);
  entry.examples.push(example);
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
        .map(({ area, examples, latestAnalysisAt }) => ({
          area,
          examples,
          latestAnalysisAt,
        }))
        .sort((a, b) => a.area.localeCompare(b.area));
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
    const { needsDiscussion, alreadyDiscussed } = splitFocusAreasByDiscussion(
      subject.focusAreas,
      subject.subjectKey,
      discussedMap,
    );
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
