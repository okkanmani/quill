import { letterGradeFromPercent } from "./gradeUtils";
import {
  formatSubjectLabel,
  normalizeSubjectKey,
  subjectSortKey,
} from "./subjectUtils";

export function formatAreaLabel(areaSlug) {
  if (!areaSlug) return "";
  return String(areaSlug).replace(/-/g, " ");
}

function topRankedSkills(buckets, { limit = 3, order = "best" } = {}) {
  const ranked = (buckets || [])
    .filter((b) => b.total > 0 && b.avgPct != null)
    .sort((a, b) =>
      order === "best" ? b.avgPct - a.avgPct : a.avgPct - b.avgPct,
    );
  return ranked.slice(0, limit);
}

/**
 * Per subject: top skill areas from graded question-level results (answer.area).
 */
export function subjectSkillAnalysis(results) {
  const bySubject = new Map();

  for (const result of results || []) {
    if (result.status === "pending") continue;

    const subjectKey = normalizeSubjectKey(result.subject);
    for (const ans of result.answers || []) {
      if (typeof ans?.correct !== "boolean") continue;
      const area = ans.area;
      if (!area) continue;

      if (!bySubject.has(subjectKey)) bySubject.set(subjectKey, new Map());
      const areas = bySubject.get(subjectKey);
      if (!areas.has(area)) {
        areas.set(area, {
          key: area,
          label: formatAreaLabel(area),
          correct: 0,
          total: 0,
        });
      }
      const bucket = areas.get(area);
      bucket.total += 1;
      if (ans.correct) bucket.correct += 1;
    }
  }

  return [...bySubject.entries()]
    .map(([subjectKey, areaMap]) => {
      const skills = [...areaMap.values()].map((b) => ({
        key: b.key,
        label: b.label,
        total: b.total,
        avgPct: b.total ? Math.round((b.correct / b.total) * 100) : null,
        letter:
          b.total > 0
            ? letterGradeFromPercent(Math.round((b.correct / b.total) * 100))
            : null,
      }));

      const best = topRankedSkills(skills, { limit: 3, order: "best" });
      const bestKeys = new Set(best.map((s) => s.key));
      const worst = topRankedSkills(skills, { limit: 3, order: "worst" }).filter(
        (s) => !bestKeys.has(s.key),
      );

      return {
        subjectKey,
        subjectLabel: formatSubjectLabel(subjectKey),
        strengths: best.map((s) => s.label),
        weaknesses: worst.map((s) => s.label),
        questionCount: skills.reduce((n, s) => n + s.total, 0),
      };
    })
    .filter((s) => s.questionCount > 0)
    .sort(
      (a, b) =>
        subjectSortKey(a.subjectKey) - subjectSortKey(b.subjectKey) ||
        a.subjectLabel.localeCompare(b.subjectLabel),
    );
}

export function formatSkillList(labels) {
  if (!labels?.length) return "—";
  return labels.join(", ");
}
