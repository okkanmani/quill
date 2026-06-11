/** Difficulty: 1 = easy, 2 = medium, 3 = hard. */
const LABELS = { 1: "Easy", 2: "Medium", 3: "Hard" };

export function DifficultyStars({ min, max, size = "sm", className = "" }) {
  const lo = typeof min === "number" ? min : null;
  const hi = typeof max === "number" ? max : lo;
  if (lo === null || hi === null || lo < 1 || hi > 3) return null;

  const filled = lo === hi ? lo : null;
  const aria =
    lo === hi
      ? `${LABELS[lo]} difficulty, ${lo} star${lo === 1 ? "" : "s"}`
      : `${LABELS[lo]} to ${LABELS[hi]} difficulty`;

  const starClass =
    size === "lg"
      ? "text-amber-500 text-base leading-none"
      : "text-amber-500 text-sm leading-none";

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`.trim()}
      title={aria}
      aria-label={aria}
    >
      <span className={`inline-flex gap-0.5 ${starClass}`} aria-hidden>
        {filled !== null ? (
          Array.from({ length: filled }, (_, i) => (
            <span key={i}>★</span>
          ))
        ) : (
          <>
            {Array.from({ length: lo }, (_, i) => (
              <span key={`a-${i}`}>★</span>
            ))}
            <span className="text-slate-400 font-medium px-0.5">–</span>
            {Array.from({ length: hi }, (_, i) => (
              <span key={`b-${i}`}>★</span>
            ))}
          </>
        )}
      </span>
      {size === "lg" ? (
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {lo === hi ? LABELS[lo] : `${LABELS[lo]}–${LABELS[hi]}`}
        </span>
      ) : null}
    </span>
  );
}

export function QuestionDifficultyStars({ stars }) {
  const n = typeof stars === "number" ? stars : null;
  if (n === null || n < 1 || n > 3) return null;
  return (
    <DifficultyStars min={n} max={n} size="sm" className="shrink-0" />
  );
}
