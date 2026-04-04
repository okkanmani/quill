/** Consistent subject ordering across worksheets and results. */
export const SUBJECT_ORDER = [
  "math",
  "english",
  "science",
  "social studies",
  "general",
];

export function subjectSortKey(key) {
  const i = SUBJECT_ORDER.indexOf(key);
  return i === -1 ? 1000 + key.charCodeAt(0) : i;
}

export function normalizeSubjectKey(subject) {
  return (subject || "general").trim().toLowerCase() || "general";
}
