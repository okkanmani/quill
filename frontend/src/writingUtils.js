/** Count words in prose (whitespace-separated tokens). */
export function countWords(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function formatWordCount(n) {
  const count = Number(n) || 0;
  return `${count} word${count === 1 ? "" : "s"}`;
}

export const WRITING_GRADE_OPTIONS = [
  "A+",
  "A",
  "A−",
  "B+",
  "B",
  "B−",
  "C+",
  "C",
  "C−",
  "D+",
  "D",
  "D−",
  "F",
];

const GRADE_SORT_INDEX = Object.fromEntries(
  WRITING_GRADE_OPTIONS.map((g, i) => [g, i]),
);

export function writingGradeSortIndex(grade) {
  if (!grade) return WRITING_GRADE_OPTIONS.length;
  return GRADE_SORT_INDEX[grade] ?? WRITING_GRADE_OPTIONS.length;
}

export function formatWritingGradeLine(item) {
  if (!item?.grade) return null;
  return `Grade: ${item.grade}`;
}

export function isWritingGraded(item) {
  return Boolean(item?.grade);
}
