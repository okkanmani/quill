import { resultPercent } from "./gradeUtils";

export const SECTION_SORT_TIME = "time";
export const SECTION_SORT_GRADE_ASC = "grade_asc";
export const SECTION_SORT_GRADE_DESC = "grade_desc";

export const SECTION_SORT_OPTIONS = [
  { value: SECTION_SORT_TIME, label: "Time" },
  { value: SECTION_SORT_GRADE_ASC, label: "Grade — low to high" },
  { value: SECTION_SORT_GRADE_DESC, label: "Grade — high to low" },
];

function pendingRank(result) {
  return result?.status === "pending" ? 0 : 1;
}

/** Results within a subject section. Pending stays first for review. */
export function sortResultItems(items, mode = SECTION_SORT_TIME) {
  return [...(items || [])].sort((a, b) => {
    const pendingDiff = pendingRank(a) - pendingRank(b);
    if (pendingDiff !== 0) return pendingDiff;

    if (mode === SECTION_SORT_GRADE_ASC || mode === SECTION_SORT_GRADE_DESC) {
      const pctA = resultPercent(a);
      const pctB = resultPercent(b);
      const missing = mode === SECTION_SORT_GRADE_ASC ? Infinity : -Infinity;
      const va = pctA ?? missing;
      const vb = pctB ?? missing;
      if (va !== vb) {
        return mode === SECTION_SORT_GRADE_ASC ? va - vb : vb - va;
      }
    }

    return (b.submitted_at || "").localeCompare(a.submitted_at || "");
  });
}

export function worksheetGradePercent(ws) {
  if (
    typeof ws?.last_score === "number" &&
    typeof ws?.last_total === "number" &&
    ws.last_total > 0
  ) {
    return Math.round((ws.last_score / ws.last_total) * 100);
  }
  return null;
}

/** Worksheets within a subject section. Undone items sort after graded when by grade. */
export function sortWorksheetItems(items, mode = SECTION_SORT_TIME) {
  return [...(items || [])].sort((a, b) => {
    if (mode === SECTION_SORT_GRADE_ASC || mode === SECTION_SORT_GRADE_DESC) {
      const pctA = worksheetGradePercent(a);
      const pctB = worksheetGradePercent(b);
      const aGraded = pctA != null;
      const bGraded = pctB != null;
      if (aGraded !== bGraded) return aGraded ? -1 : 1;
      if (aGraded && bGraded && pctA !== pctB) {
        return mode === SECTION_SORT_GRADE_ASC ? pctA - pctB : pctB - pctA;
      }
    }

    const tsA = a.sort_ts || 0;
    const tsB = b.sort_ts || 0;
    if (tsB !== tsA) return tsB - tsA;
    return (b.id || "").localeCompare(a.id || "");
  });
}
