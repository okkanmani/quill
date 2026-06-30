/** Consistent subject ordering across worksheets and results. */
export const SUBJECT_ORDER = [
  "math",
  "english",
  "science",
  "data",
  "social studies",
  "general",
];

/** Display labels for worksheet subject keys. */
export const SUBJECT_LABELS = {
  data: "Data analysis",
};

export function formatSubjectLabel(subject) {
  const key = normalizeSubjectKey(subject);
  if (SUBJECT_LABELS[key]) return SUBJECT_LABELS[key];
  if (!key) return "General";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function subjectSortKey(key) {
  const i = SUBJECT_ORDER.indexOf(key);
  return i === -1 ? 1000 + key.charCodeAt(0) : i;
}

export function normalizeSubjectKey(subject) {
  return (subject || "general").trim().toLowerCase() || "general";
}

/** Worksheet list rows from the API use `done` as boolean or 0/1. */
export function isWorksheetDone(ws) {
  return ws.done === true || ws.done === 1;
}

/**
 * Mean of (score/total)*100 over worksheets that are done and have last_score/last_total.
 * Returns null if none qualify.
 */
export function averagePercentAcrossDoneWorksheets(worksheets) {
  const scored = worksheets.filter(
    (ws) =>
      isWorksheetDone(ws) &&
      ws.last_status !== "pending" &&
      typeof ws.last_score === "number" &&
      typeof ws.last_total === "number" &&
      ws.last_total > 0,
  );
  if (scored.length === 0) return null;
  const sumPct = scored.reduce(
    (s, ws) => s + (ws.last_score / ws.last_total) * 100,
    0,
  );
  return {
    avgPct: Math.round(sumPct / scored.length),
    count: scored.length,
  };
}
