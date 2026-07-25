import { useEffect, useId, useRef, useState } from "react";

const DEFAULT_AUTO_CLOSE_MS = 5000;

export default function TimedAckDialog({
  open,
  message,
  onClose,
  autoCloseMs = DEFAULT_AUTO_CLOSE_MS,
  okLabel = "OK",
  onUndo,
  undoLabel = "Undo",
  undoDisabled = false,
}) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(autoCloseMs / 1000),
  );

  useEffect(() => {
    if (!open) return;
    const totalSec = Math.ceil(autoCloseMs / 1000);
    setSecondsLeft(totalSec);
    const timeout = window.setTimeout(() => onCloseRef.current(), autoCloseMs);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [open, autoCloseMs]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-slate-200 bg-white px-6 py-[22px] shadow-lg"
      >
        <p
          id={titleId}
          className="text-[15px] text-slate-800 m-0 mb-4 leading-relaxed"
        >
          {message}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 m-0 tabular-nums">
            Closes in {secondsLeft}s
          </p>
          <div className="flex items-center gap-2">
            {onUndo ? (
              <button
                type="button"
                onClick={onUndo}
                disabled={undoDisabled}
                className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {undoLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {okLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
