import { resultPercent } from "./gradeUtils";
import { isWorksheetDone } from "./subjectUtils";
import { writingGradeSortIndex } from "./writingUtils";

export const SECTION_SORT_TIME = "time";
export const SECTION_SORT_STATUS = "status";
export const SECTION_SORT_GRADE_ASC = "grade_asc";
export const SECTION_SORT_GRADE_DESC = "grade_desc";

export const SECTION_SORT_OPTIONS = [
  { value: SECTION_SORT_TIME, label: "Time" },
  { value: SECTION_SORT_GRADE_ASC, label: "Grade — low to high" },
  { value: SECTION_SORT_GRADE_DESC, label: "Grade — high to low" },
];

export const WORKSHEET_SORT_OPTIONS = [
  { value: SECTION_SORT_STATUS, label: "Status" },
  ...SECTION_SORT_OPTIONS,
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

/** Writing submissions — pending first; grade sort when all are graded. */
export function sortWritingItems(items, mode = SECTION_SORT_TIME) {
  return [...(items || [])].sort((a, b) => {
    const pendingDiff = pendingRank(a) - pendingRank(b);
    if (pendingDiff !== 0) return pendingDiff;

    if (mode === SECTION_SORT_GRADE_ASC || mode === SECTION_SORT_GRADE_DESC) {
      const va = writingGradeSortIndex(a.grade);
      const vb = writingGradeSortIndex(b.grade);
      if (va !== vb) {
        return mode === SECTION_SORT_GRADE_ASC ? vb - va : va - vb;
      }
    }

    return (b.submitted_at || "").localeCompare(a.submitted_at || "");
  });
}

/** Completed focus practice worksheets on admin Results. */
export function sortPracticeItems(items, mode = SECTION_SORT_TIME) {
  return [...(items || [])].sort((a, b) => {
    if (mode === SECTION_SORT_GRADE_ASC || mode === SECTION_SORT_GRADE_DESC) {
      const pctA =
        typeof a.score === "number" && a.total > 0
          ? (a.score / a.total) * 100
          : null;
      const pctB =
        typeof b.score === "number" && b.total > 0
          ? (b.score / b.total) * 100
          : null;
      const missing = mode === SECTION_SORT_GRADE_ASC ? Infinity : -Infinity;
      const va = pctA ?? missing;
      const vb = pctB ?? missing;
      if (va !== vb) {
        return mode === SECTION_SORT_GRADE_ASC ? va - vb : vb - va;
      }
    }

    return (b.completed_at || "").localeCompare(a.completed_at || "");
  });
}

function testResultGradePercent(item) {
  if (
    typeof item?.weighted_score === "number" &&
    typeof item?.max_weighted_score === "number" &&
    item.max_weighted_score > 0
  ) {
    return (item.weighted_score / item.max_weighted_score) * 100;
  }
  if (
    typeof item?.correct_count === "number" &&
    typeof item?.total_count === "number" &&
    item.total_count > 0
  ) {
    return (item.correct_count / item.total_count) * 100;
  }
  return null;
}

/** Completed adaptive tests on admin Results → Tests. */
export function sortTestResultItems(items, mode = SECTION_SORT_TIME) {
  return [...(items || [])].sort((a, b) => {
    if (mode === SECTION_SORT_GRADE_ASC || mode === SECTION_SORT_GRADE_DESC) {
      const missing = mode === SECTION_SORT_GRADE_ASC ? Infinity : -Infinity;
      const va = testResultGradePercent(a) ?? missing;
      const vb = testResultGradePercent(b) ?? missing;
      if (va !== vb) {
        return mode === SECTION_SORT_GRADE_ASC ? va - vb : vb - va;
      }
    }

    const timeDiff = (b.completed_at || "").localeCompare(a.completed_at || "");
    if (timeDiff !== 0) return timeDiff;
    return String(b.id || "").localeCompare(String(a.id || ""));
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

function worksheetTimeCompare(a, b) {
  const tsA = a.sort_ts || 0;
  const tsB = b.sort_ts || 0;
  if (tsB !== tsA) return tsB - tsA;
  return (b.id || "").localeCompare(a.id || "");
}

/** Not done and actively started — saved draft or timed attempt in flight. */
function isWorksheetInProgress(ws) {
  if (isWorksheetDone(ws)) return false;
  if (ws.has_draft) return true;
  if (ws.timed && ws.timed_started) return true;
  return false;
}

/** Status sort: in progress first, not started next, done last. */
function worksheetStatusRank(ws) {
  if (isWorksheetDone(ws)) return 2;
  if (isWorksheetInProgress(ws)) return 0;
  return 1;
}

function worksheetActivityCompare(a, b) {
  const draftA = a.draft_saved_at || "";
  const draftB = b.draft_saved_at || "";
  if (draftA !== draftB) return draftB.localeCompare(draftA);
  return worksheetTimeCompare(a, b);
}

/** Worksheets within a subject section. Undone items sort after graded when by grade. */
export function sortWorksheetItems(items, mode = SECTION_SORT_STATUS) {
  return [...(items || [])].sort((a, b) => {
    if (mode === SECTION_SORT_STATUS) {
      const rankA = worksheetStatusRank(a);
      const rankB = worksheetStatusRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return worksheetActivityCompare(a, b);
    }

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

    return worksheetTimeCompare(a, b);
  });
}
