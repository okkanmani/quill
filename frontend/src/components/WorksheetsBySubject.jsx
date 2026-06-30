import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SubjectBadge from "./SubjectBadge";
import { formatSubjectLabel } from "../subjectUtils";
import ContentBadge from "./ContentBadge";
import { DifficultyStars } from "./DifficultyStars";
import {
  averagePercentAcrossDoneWorksheets,
  isWorksheetDone,
  normalizeSubjectKey,
  subjectSortKey,
} from "../subjectUtils";

function TimedPadlockStatus({ locked }) {
  const label = locked
    ? "Locked — ask your teacher to unlock"
    : "Ready to start";
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-full border w-9 h-9 ${
        locked
          ? "bg-rose-100 border-rose-200 text-rose-700"
          : "bg-slate-100 border-slate-200 text-slate-600"
      }`}
      title={label}
      aria-label={label}
    >
      {locked ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 7.5-1" />
        </svg>
      )}
    </span>
  );
}

function WorksheetRow({ ws, onOpenWorksheet, renderSideAction }) {
  const showTimedPadlock = ws.timed && !isWorksheetDone(ws);
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4">
      <div
        className={`flex-1 flex flex-col bg-white border rounded-2xl shadow-sm transition overflow-hidden ${
          ws.timed_locked
            ? "border-rose-300 opacity-90"
            : "border-slate-200 hover:shadow-md hover:border-indigo-400"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenWorksheet(ws.id)}
          className="flex-1 p-5 text-left pb-3"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-slate-900 font-semibold text-lg">{ws.title}</p>
            {isWorksheetDone(ws) ? (
              <span className="shrink-0 inline-flex items-center gap-2 flex-wrap justify-end">
                {ws.last_status === "pending" ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200">
                    Awaiting review
                  </span>
                ) : null}
                {typeof ws.last_score === "number" &&
                typeof ws.last_total === "number" &&
                ws.last_total > 0 &&
                ws.last_status !== "pending" ? (
                  <span className="inline-flex items-baseline gap-x-4 text-sm font-bold text-emerald-950 tabular-nums">
                    <span className="shrink-0">Score:</span>
                    <span>
                      {ws.last_score}/{ws.last_total}
                    </span>
                    <span>
                      {Math.round((ws.last_score / ws.last_total) * 100)}%
                    </span>
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  Done
                </span>
              </span>
            ) : showTimedPadlock ? (
              <TimedPadlockStatus locked={Boolean(ws.timed_locked)} />
            ) : ws.has_draft ? (
              <span className="shrink-0 inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900 border border-sky-200">
                Saved progress
              </span>
            ) : null}
          </div>
        </button>
        <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 pt-3">
          <ContentBadge label={ws.content_badge} />
          <SubjectBadge subject={ws.subject} />
          <DifficultyStars min={ws.difficulty_min} max={ws.difficulty_max} />
          {ws.timed && ws.time_limit_minutes ? (
            <span className="text-rose-700 text-xs font-semibold rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5">
              {ws.time_limit_minutes} min limit
            </span>
          ) : null}
          <span className="text-indigo-500 text-sm">
            {ws.question_count} questions
          </span>
          {ws.learn_subject ? (
            <Link
              to={`/student/learn/${encodeURIComponent(ws.learn_subject)}${
                ws.learn_section
                  ? `#${encodeURIComponent(ws.learn_section)}`
                  : ""
              }`}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-900 border border-slate-200 hover:bg-slate-200/80 transition"
            >
              Open Resource
            </Link>
          ) : null}
        </div>
      </div>
      {renderSideAction ? renderSideAction(ws) : null}
    </div>
  );
}

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
 * Accordion by subject, or flat list when ungrouped.
 * renderSideAction(ws) optional (e.g. admin Delete).
 */
export default function WorksheetsBySubject({
  worksheets,
  onOpenWorksheet,
  renderSideAction,
  ungrouped = false,
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

  if (ungrouped) {
    if (worksheets.length === 0) return null;
    return (
      <div className="flex flex-col gap-4">
        {worksheets.map((ws) => (
          <WorksheetRow
            key={ws.id}
            ws={ws}
            onOpenWorksheet={onOpenWorksheet}
            renderSideAction={renderSideAction}
          />
        ))}
      </div>
    );
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
            className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(subjectKey)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-slate-200/90 hover:bg-slate-200 border-b border-slate-300/80 transition"
            >
              <span className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                <span className="font-bold text-slate-950 text-base">
                  {formatSubjectLabel(subjectKey)}
                </span>
                <span className="font-semibold text-slate-800/90 text-sm tabular-nums">
                  {done}/{total} done
                  {total > 0 ? (
                    <span className="text-slate-700/85 font-medium">
                      {" "}
                      · {pct}%
                    </span>
                  ) : null}
                  {avgScore ? (
                    <span className="text-slate-800 font-semibold">
                      {" "}
                      · avg {avgScore.avgPct}%
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="text-slate-900 text-sm font-bold shrink-0 tabular-nums">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {isOpen ? (
              <div className="p-3 flex flex-col gap-4 bg-slate-50/40">
                {items.map((ws) => (
                  <WorksheetRow
                    key={ws.id}
                    ws={ws}
                    onOpenWorksheet={onOpenWorksheet}
                    renderSideAction={renderSideAction}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
