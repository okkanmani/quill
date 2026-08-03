import { useState } from "react";
import WorksheetPassageContent from "./WorksheetPassageContent";

function ContextToggleButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="shrink-0 text-xs font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
    >
      {open ? "Hide context" : "Show context"}
    </button>
  );
}

export default function CollapsiblePassageContext({ passage, centered = false }) {
  const [open, setOpen] = useState(false);
  if (!passage) return null;

  const title = String(passage.title || "").trim();

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-start justify-between gap-3">
        {title ? (
          <p className="min-w-0 text-sm font-semibold text-slate-800">{title}</p>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Context
          </span>
        )}
        <ContextToggleButton open={open} onToggle={() => setOpen((value) => !value)} />
      </div>
      {open ? (
        <div className="mt-3">
          <WorksheetPassageContent
            passage={passage}
            embedded
            hideTitle={Boolean(title)}
            centered={centered}
          />
        </div>
      ) : null}
    </div>
  );
}
