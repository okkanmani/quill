import { useMemo, useState } from "react";
import SubjectBadge, { formatSubjectLabel } from "./SubjectBadge";
import { normalizeSubjectKey, subjectSortKey } from "../subjectUtils";

function groupWorksheets(worksheets) {
  const m = new Map();
  for (const ws of worksheets) {
    const k = normalizeSubjectKey(ws.subject);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(ws);
  }
  return [...m.entries()].sort(
    (a, b) =>
      subjectSortKey(a[0]) - subjectSortKey(b[0]) ||
      a[0].localeCompare(b[0]),
  );
}

/**
 * Accordion by subject. renderSideAction(ws) optional (e.g. admin Delete).
 */
export default function WorksheetsBySubject({
  worksheets,
  onOpenWorksheet,
  renderSideAction,
}) {
  const groups = useMemo(() => groupWorksheets(worksheets), [worksheets]);
  /** Subject keys that are expanded; default is all collapsed. */
  const [open, setOpen] = useState(() => new Set());

  function toggle(subjectKey) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([subjectKey, items]) => {
        const isOpen = open.has(subjectKey);
        return (
          <div
            key={subjectKey}
            className="rounded-2xl border border-amber-300 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(subjectKey)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-amber-200/90 hover:bg-amber-200 border-b border-amber-300/80 transition"
            >
              <span className="font-bold text-amber-950 text-base">
                {formatSubjectLabel(subjectKey)}
                <span className="font-semibold text-amber-800/90 text-sm ml-2">
                  ({items.length})
                </span>
              </span>
              <span className="text-amber-900 text-sm font-bold shrink-0 tabular-nums">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {isOpen ? (
              <div className="p-3 flex flex-col gap-3 bg-amber-50/40">
                {items.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex flex-col sm:flex-row gap-3 sm:items-stretch"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenWorksheet(ws.id)}
                      className="flex-1 bg-white border border-amber-200 rounded-2xl p-5 text-left shadow-sm hover:shadow-md hover:border-amber-400 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-amber-900 font-semibold text-lg">
                          {ws.title}
                        </p>
                        {ws.done === true || ws.done === 1 ? (
                          <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                            Done
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <SubjectBadge subject={ws.subject} />
                        <span className="text-amber-500 text-sm">
                          {ws.question_count} questions
                        </span>
                      </div>
                    </button>
                    {renderSideAction ? renderSideAction(ws) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
