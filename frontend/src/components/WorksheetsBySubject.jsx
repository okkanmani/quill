import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SubjectBadge, { formatSubjectLabel } from "./SubjectBadge";
import {
  averagePercentAcrossDoneWorksheets,
  isWorksheetDone,
  normalizeSubjectKey,
  subjectSortKey,
} from "../subjectUtils";

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
        const total = items.length;
        const done = items.filter(isWorksheetDone).length;
        const pct =
          total > 0 ? Math.round((done / total) * 100) : 0;
        const avgScore = averagePercentAcrossDoneWorksheets(items);
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
              <span className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                <span className="font-bold text-amber-950 text-base">
                  {formatSubjectLabel(subjectKey)}
                </span>
                <span className="font-semibold text-amber-800/90 text-sm tabular-nums">
                  {done}/{total} done
                  {total > 0 ? (
                    <span className="text-amber-700/85 font-medium">
                      {" "}
                      · {pct}%
                    </span>
                  ) : null}
                  {avgScore ? (
                    <span className="text-amber-800 font-semibold">
                      {" "}
                      · avg {avgScore.avgPct}%
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="text-amber-900 text-sm font-bold shrink-0 tabular-nums">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {isOpen ? (
              <div className="p-3 flex flex-col gap-4 bg-amber-50/40">
                {items.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4"
                  >
                    <div className="flex-1 flex flex-col bg-white border border-amber-200 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-400 transition overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onOpenWorksheet(ws.id)}
                        className="flex-1 p-5 text-left pb-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-amber-900 font-semibold text-lg">
                            {ws.title}
                          </p>
                          {isWorksheetDone(ws) ? (
                            <span className="shrink-0 inline-flex items-center gap-2 flex-wrap justify-end">
                              {typeof ws.last_score === "number" &&
                              typeof ws.last_total === "number" &&
                              ws.last_total > 0 ? (
                                <span className="inline-flex items-baseline gap-x-4 text-sm font-bold text-emerald-950 tabular-nums">
                                  <span className="shrink-0">Score:</span>
                                  <span>
                                    {ws.last_score}/{ws.last_total}
                                  </span>
                                  <span>
                                    {Math.round(
                                      (ws.last_score / ws.last_total) * 100,
                                    )}
                                    %
                                  </span>
                                </span>
                              ) : null}
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                                Done
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </button>
                      <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-amber-100 bg-amber-50/50 pt-3">
                        <SubjectBadge subject={ws.subject} />
                        <span className="text-amber-500 text-sm">
                          {ws.question_count} questions
                        </span>
                        {ws.learn_subject ? (
                          <Link
                            to={`/student/learn/${encodeURIComponent(ws.learn_subject)}${
                              ws.learn_section
                                ? `#${encodeURIComponent(ws.learn_section)}`
                                : ""
                            }`}
                            className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200 hover:bg-amber-200/80 transition"
                          >
                            Open Resource
                          </Link>
                        ) : null}
                      </div>
                    </div>
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
