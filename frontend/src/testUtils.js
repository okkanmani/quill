/** Format tier-weighted test score for display. */
export function formatWeightedTestScore(weighted, maxWeighted) {
  if (maxWeighted == null || maxWeighted <= 0) return "—";
  const w = Number(weighted);
  const m = Number(maxWeighted);
  if (Number.isNaN(w) || Number.isNaN(m)) return "—";
  const pct = Math.round((w / m) * 100);
  return `${w.toFixed(1)} / ${m.toFixed(1)} (${pct}%)`;
}

export function formatTestTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
