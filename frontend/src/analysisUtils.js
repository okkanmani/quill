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

const MAX_EXAMPLES_PER_AREA = 3;

function exampleKey(question) {
  return String(question || "").trim().toLowerCase();
}

function addWrongExample(entry, question) {
  if (question?.correct !== false) return;
  const text = question.question || "";
  if (!text.trim()) return;

  const key = exampleKey(text);
  if (entry.exampleKeys.has(key)) return;
  if (entry.examples.length >= MAX_EXAMPLES_PER_AREA) return;

  entry.exampleKeys.add(key);
  entry.examples.push({
    question: text,
    answer: question.answer ?? "",
  });
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
        });
      }
      addWrongExample(areas.get(key), q);
    }
  }

  return [...bySubject.entries()]
    .map(([subjectKey, areaMap]) => {
      const focusAreas = [...areaMap.values()]
        .map(({ area, examples }) => ({ area, examples }))
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

export function formatFocusAreaList(areas) {
  if (!areas?.length) return "—";
  return areas.join(", ");
}
