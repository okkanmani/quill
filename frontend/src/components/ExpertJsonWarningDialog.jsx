import { Link } from "react-router-dom";

export default function ExpertJsonWarningDialog({
  open,
  dontShowAgain,
  onDontShowAgainChange,
  onCancel,
  onContinue,
  continuing = false,
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close expert mode warning"
        onClick={continuing ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expert-json-warning-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-slate-200 bg-white px-6 py-[22px] shadow-lg"
      >
        <div className="flex items-center gap-2 mb-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[18px] h-[18px] text-indigo-600 shrink-0"
            aria-hidden
          >
            <path d="m7 15 5-5-5-5" />
            <path d="M13 19h6" />
            <path d="M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          </svg>
          <h2
            id="expert-json-warning-title"
            className="font-semibold text-[15px] text-slate-950 m-0"
          >
            You&apos;re entering Expert mode
          </h2>
        </div>

        <p className="text-[13px] text-slate-600 m-0 mb-3.5 leading-relaxed">
          The JSON tool skips the guided builder&apos;s structural checks. It validates
          schema and required counts, but not everything — like tier distribution within
          a passage, or answer-key correctness. Malformed data here can cause unexpected
          behavior in adaptive tests.
        </p>

        <label className="flex items-start gap-2 text-[13px] text-slate-700 mb-4 leading-snug cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={dontShowAgain}
            onChange={(e) => onDontShowAgainChange(e.target.checked)}
            disabled={continuing}
          />
          <span>
            Don&apos;t show this again — you can re-enable it anytime in{" "}
            <Link
              to="/admin/settings"
              className="text-indigo-700 font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Settings
            </Link>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={continuing}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={continuing}
            className="rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-800 border-0 px-3.5 py-2 text-sm font-semibold transition"
          >
            {continuing ? "Saving…" : "Continue to JSON tool"}
          </button>
        </div>
      </div>
    </>
  );
}
