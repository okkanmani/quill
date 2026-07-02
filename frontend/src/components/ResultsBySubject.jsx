import { useMemo, useState } from "react";
import AdminResultGrader from "./AdminResultGrader";
import RecycleBinButton from "./RecycleBinButton";
import { formatSubjectLabel } from "../subjectUtils";
import { normalizeSubjectKey, subjectSortKey } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";

function sortResultsInGroup(a, b) {
  const pendingA = a.status === "pending" ? 1 : 0;
  const pendingB = b.status === "pending" ? 1 : 0;
  if (pendingA !== pendingB) return pendingB - pendingA;
  return (b.submitted_at || "").localeCompare(a.submitted_at || "");
}

function groupResults(results) {
  const m = new Map();
  for (const r of results) {
    const k = normalizeSubjectKey(r.subject);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  for (const items of m.values()) {
    items.sort(sortResultsInGroup);
  }
  return [...m.entries()].sort(
    (a, b) =>
      subjectSortKey(a[0]) - subjectSortKey(b[0]) || a[0].localeCompare(b[0]),
  );
}

function scoreBadgeClass(r) {
  if (r.status === "pending") {
    return "bg-amber-100 text-amber-900";
  }
  if (r.score === r.total) return "bg-green-100 text-green-700";
  if (typeof r.score === "number" && r.score >= r.total / 2) {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-red-100 text-red-700";
}

/**
 * Admin results: accordion by subject, collapsed by default.
 * Within each subject: pending first, then newest submission.
 */
export default function ResultsBySubject({
  results,
  openIds,
  toggleAnswers,
  onResultEvaluated,
  onDeleteResult,
  deletingResultId,
}) {
  const groups = useMemo(() => groupResults(results), [results]);
  const [openSubjects, setOpenSubjects] = useState(() => new Set());
  const pendingCount = results.filter((r) => r.status === "pending").length;

  function toggleSubject(subjectKey) {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {pendingCount > 0 ? (
        <p className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          {pendingCount} submission{pendingCount === 1 ? "" : "s"} awaiting your
          review
        </p>
      ) : null}
      {groups.map(([subjectKey, items]) => {
        const isOpen = openSubjects.has(subjectKey);
        return (
          <div
            key={subjectKey}
            className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSubject(subjectKey)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-slate-200/90 hover:bg-slate-200 border-b border-slate-300/80 transition"
            >
              <span className="font-bold text-slate-950 text-base">
                {formatSubjectLabel(subjectKey)}
                <span className="font-semibold text-slate-800/90 text-sm ml-2">
                  ({items.length})
                </span>
              </span>
              <span className="text-slate-900 text-sm font-bold shrink-0 tabular-nums">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {isOpen ? (
              <div className="p-3 flex flex-col gap-4 bg-slate-50/40">
                {items.map((r) => {
                  const expanded = openIds.has(r.id);
                  const isPending = r.status === "pending";
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4"
                    >
                      <div
                        className={`flex-1 bg-white border rounded-2xl shadow-sm overflow-hidden ${
                          isPending ? "border-amber-300" : "border-slate-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAnswers(r.id)}
                          aria-expanded={expanded}
                          className="w-full text-left p-5 hover:bg-slate-50/60 transition flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4"
                        >
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-900 font-semibold text-lg">
                            {r.title || r.worksheet_id}
                          </p>
                          {r.student ? (
                            <p className="text-slate-600 text-sm mt-1">
                              {r.student}
                            </p>
                          ) : null}
                          <p className="text-slate-400 text-xs mt-2">
                            Submitted:{" "}
                            {new Date(r.submitted_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                          {r.timed && r.duration_seconds != null ? (
                            <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-900 border border-sky-200 tabular-nums">
                              Completed in {formatDurationSeconds(r.duration_seconds)}
                            </span>
                          ) : null}
                          <span
                            className={`inline-flex text-sm font-semibold px-3 py-1 rounded-full ${scoreBadgeClass(r)}`}
                          >
                            {isPending
                              ? "Pending review"
                              : `${r.score} / ${r.total}`}
                          </span>
                          <span className="text-slate-600 text-xs font-semibold underline underline-offset-2">
                            {expanded
                              ? isPending
                                ? "Hide"
                                : "Hide answers"
                              : isPending
                                ? "Mark answers"
                                : "Show answers"}
                          </span>
                        </div>
                      </button>

                      {expanded && isPending ? (
                        <AdminResultGrader
                          result={r}
                          onEvaluated={onResultEvaluated}
                        />
                      ) : null}

                      {expanded && !isPending ? (
                        <div className="border-t border-slate-100 px-5 pb-5 pt-4 bg-slate-50/30">
                          <ul className="flex flex-col gap-4">
                            {r.answers.map((a, index) => (
                              <li
                                key={a.question_id}
                                className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm"
                              >
                                <p className="text-slate-800 text-sm font-medium leading-snug">
                                  <span className="text-indigo-500 font-normal">
                                    {index + 1}.{" "}
                                  </span>
                                  {a.prompt}
                                </p>
                                <div className="mt-3 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                                  <span className="text-slate-600 shrink-0">
                                    Response:
                                  </span>
                                  <span className="text-slate-900 font-medium break-words min-w-0">
                                    {a.given === "" || a.given == null
                                      ? "(empty)"
                                      : `"${a.given}"`}
                                  </span>
                                  <span
                                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                                      a.correct
                                        ? "bg-green-50 text-green-800 border-green-200"
                                        : "bg-red-50 text-red-800 border-red-200"
                                    }`}
                                  >
                                    {a.correct ? "Correct" : "Incorrect"}
                                  </span>
                                </div>
                                {!a.correct &&
                                a.expected != null &&
                                a.expected !== "" ? (
                                  <p className="mt-2 text-sm text-slate-900">
                                    <span className="text-red-700 font-semibold">
                                      Expected answer:{" "}
                                    </span>
                                    {a.expected}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      </div>
                      {onDeleteResult ? (
                        <div className="flex shrink-0 self-center sm:self-stretch sm:items-stretch sm:w-11">
                          <RecycleBinButton
                            onClick={() => onDeleteResult(r)}
                            label={`Delete result for ${r.title || r.worksheet_id}`}
                            disabled={deletingResultId === r.id}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
