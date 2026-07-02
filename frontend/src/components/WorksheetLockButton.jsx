import PadlockIcon from "./PadlockIcon";

/**
 * Admin toggle: open padlock = unlocked, closed padlock = locked.
 * variant: "access" (violet) | "timed" (amber) | "neutral"
 */
export default function WorksheetLockButton({
  locked,
  onClick,
  label,
  disabled = false,
  variant = "neutral",
}) {
  const lockedStyles =
    variant === "timed"
      ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
      : variant === "access"
        ? "bg-violet-100 border-violet-200 text-violet-800 hover:bg-violet-200"
        : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={locked}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 transition disabled:opacity-40 disabled:pointer-events-none ${
        locked ? lockedStyles : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
      }`}
    >
      <PadlockIcon open={!locked} />
    </button>
  );
}
