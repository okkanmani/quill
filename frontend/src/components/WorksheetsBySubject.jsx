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
import { formatDurationSeconds } from "../worksheetUtils";
import PadlockIcon from "./PadlockIcon";

function worksheetLockState(ws) {
  if (isWorksheetDone(ws)) return null;
  if (ws.access_locked) {
    return { kind: "access", reason: ws.lock_reason || "admin" };
  }
  if (ws.timed && ws.timed_locked) {
    return { kind: "timed", reason: "abandoned" };
  }
  if (ws.timed && ws.timed_started) {
    return { kind: "timed", reason: "active" };
  }
  return null;
}

function lockBadgeLabel(state) {
  if (!state) return "";
  if (state.kind === "access") {
    return state.reason === "week"
      ? "This week is locked — complete earlier weeks or ask your teacher"
      : "Locked — ask your teacher to unlock";
  }
  if (state.reason === "abandoned") {
    return "Locked — ask your teacher to unlock";
  }
  return "Timed worksheet in progress";
}

function LockedPadlockBadge({ state }) {
  const label = lockBadgeLabel(state);
  const accessStyle = state.kind === "access";
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-full border w-9 h-9 ${
        accessStyle
          ? "bg-violet-100 border-violet-200 text-violet-700"
          : "bg-amber-100 border-amber-200 text-amber-800"
      }`}
      title={label}
      aria-label={label}
    >
      <PadlockIcon className="w-[18px] h-[18px]" />
    </span>
  );
}

function WorksheetRow({ ws, onOpenWorksheet, renderSideAction }) {
  const lockState = worksheetLockState(ws);
  const accessLocked = Boolean(ws.access_locked) && !isWorksheetDone(ws);
  const timedBlocked = Boolean(ws.timed && ws.timed_locked && !isWorksheetDone(ws));

  function handleOpen() {
    if (accessLocked || timedBlocked) return;
    onOpenWorksheet(ws.id);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4">
      <div
        className={`flex-1 flex flex-col bg-white border rounded-2xl shadow-sm transition overflow-hidden ${
          accessLocked
            ? "border-violet-300 opacity-90"
            : timedBlocked
              ? "border-amber-300 opacity-90"
              : lockState?.kind === "timed"
                ? "border-amber-200"
                : "border-slate-200 hover:shadow-md hover:border-indigo-400"
        }`}
      >
        <button
          type="button"
          onClick={handleOpen}
          disabled={accessLocked || timedBlocked}
          className={`flex-1 p-5 text-left pb-3 ${
            accessLocked || timedBlocked ? "cursor-not-allowed" : ""
          }`}
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
            ) : lockState ? (
              <LockedPadlockBadge state={lockState} />
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
          {ws.timed && ws.last_duration_seconds != null ? (
            <span className="text-sky-800 text-xs font-semibold rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 tabular-nums">
              Completed in {formatDurationSeconds(ws.last_duration_seconds)}
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
