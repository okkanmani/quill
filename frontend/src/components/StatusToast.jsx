export default function StatusToast({
  message,
  children,
  onUndo,
  undoLabel = "Undo",
  undoDisabled = false,
}) {
  const content = children ?? message;
  if (!content) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-12 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-emerald-200/90 bg-white px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">{content}</span>
        {onUndo ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={undoDisabled}
            className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          >
            {undoLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
