/** Star difficulty → weight for overall grade (1★ easy … 3★ hard). */
const STAR_WEIGHT = { 1: 1, 2: 2, 3: 3 };

export function isResultGraded(result) {
  return (
    result?.status !== "pending" &&
    typeof result?.score === "number" &&
    typeof result?.total === "number" &&
    result.total > 0 &&
    result.score >= 0
  );
}

/** Average star difficulty for a result (from worksheet difficulty_min/max). */
export function resultStarLevel(result) {
  const min = result?.difficulty_min;
  const max = result?.difficulty_max;
  if (typeof min === "number" && typeof max === "number") {
    return Math.min(3, Math.max(1, Math.round((min + max) / 2)));
  }
  if (typeof min === "number") return min;
  if (typeof max === "number") return max;
  return 2;
}

export function resultStarWeight(result) {
  return STAR_WEIGHT[resultStarLevel(result)] ?? 2;
}

export function resultPercent(result) {
  if (!isResultGraded(result)) return null;
  return Math.round((result.score / result.total) * 100);
}

/**
 * Letter grade from percentage (weighted average).
 * A+ 90+, then 5-point bands; F below 35.
 */
export function letterGradeFromPercent(pct) {
  if (pct == null || Number.isNaN(pct)) return null;
  const p = Math.round(pct);
  if (p >= 90) return "A+";
  if (p >= 85) return "A";
  if (p >= 80) return "A−";
  if (p >= 75) return "B+";
  if (p >= 70) return "B";
  if (p >= 65) return "B−";
  if (p >= 60) return "C+";
  if (p >= 55) return "C";
  if (p >= 50) return "C−";
  if (p >= 45) return "D+";
  if (p >= 40) return "D";
  if (p >= 35) return "D−";
  return "F";
}

/** Weighted average % and letter over evaluated results only. */
export function weightedGradeSummary(results) {
  const graded = (results || []).filter(isResultGraded);
  if (graded.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of graded) {
    const pct = resultPercent(r);
    const w = resultStarWeight(r);
    weightedSum += pct * w;
    weightTotal += w;
  }
  if (weightTotal <= 0) return null;

  const weightedPct = Math.round(weightedSum / weightTotal);
  return {
    weightedPct,
    letter: letterGradeFromPercent(weightedPct),
    count: graded.length,
  };
}

export function formatGradeSummary(summary) {
  if (!summary) return null;
  return `Score: ${summary.weightedPct}%, Grade: ${summary.letter}`;
}

export function formatResultScoreLine(result) {
  if (!isResultGraded(result)) return null;
  const pct = resultPercent(result);
  const letter = letterGradeFromPercent(pct);
  return `Score: ${pct}%, Grade: ${letter}`;
}
