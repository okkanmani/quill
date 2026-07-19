import { useMemo } from "react";
import SubjectBadge from "./SubjectBadge";
import ContentBadge from "./ContentBadge";
import PadlockIcon from "./PadlockIcon";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";

function testLockState(item) {
  if (item.done) return null;
  if (item.access_locked) {
    return { kind: "access", reason: item.lock_reason || "admin" };
  }
  if (item.attempt_locked) {
    return { kind: "attempt", reason: "abandoned" };
  }
  if (item.attempt_started && !item.done) {
    return { kind: "attempt", reason: "active" };
  }
  return null;
}

function lockLabel(state) {
  if (!state) return "";
  if (state.kind === "access") {
    return state.reason === "week"
      ? "This week is locked"
      : "Locked — ask your teacher to unlock";
  }
  if (state.reason === "abandoned") {
    return "Test sitting locked — ask your teacher to reset";
  }
  return "Test in progress";
}

function TestRow({ item, onOpenTest, onOpenReview }) {
  const lock = testLockState(item);
  const blocked = Boolean(lock && (lock.kind === "access" || lock.reason === "abandoned"));

  function handleOpen() {
    if (blocked) return;
    if (item.done && item.review_id && !item.review_completed) {
      onOpenReview(item.review_id);
      return;
    }
    onOpenTest(item.id);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
      <button
        type="button"
        onClick={handleOpen}
        disabled={blocked}
        className={`flex-1 text-left flex flex-col bg-white border rounded-2xl shadow-sm transition overflow-hidden ${
          blocked
            ? "border-slate-200 opacity-90 cursor-not-allowed"
            : "border-slate-200 hover:shadow-md hover:border-teal-400"
        }`}
      >
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-slate-900 font-semibold text-lg">{item.title}</p>
            <span className="shrink-0 flex items-center gap-2">
              {lock ? (
                <span
                  className="inline-flex items-center justify-center rounded-full border w-9 h-9 bg-violet-100 border-violet-200 text-violet-700"
                  title={lockLabel(lock)}
                >
                  <PadlockIcon className="w-[18px] h-[18px]" />
                </span>
              ) : null}
              {item.done ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  Submitted
                </span>
              ) : null}
            </span>
          </div>
          {item.done && item.weighted_score != null ? (
            <p className="text-sm font-bold text-teal-900 mt-2 tabular-nums">
              Score: {formatWeightedTestScore(item.weighted_score, item.max_weighted_score)}
            </p>
          ) : null}
        </div>
        <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 pt-3">
          <ContentBadge label={item.content_badge || "Test"} />
          <SubjectBadge subject={item.subject} />
          <span className="text-teal-700 text-sm font-medium">
            {item.test_sitting_count || 20} questions · adaptive
          </span>
          {item.time_limit_minutes ? (
            <span className="text-slate-500 text-sm">{item.time_limit_minutes} min</span>
          ) : null}
        </div>
      </button>
      {item.done && item.review_id ? (
        <button
          type="button"
          onClick={() => onOpenReview(item.review_id)}
          className="shrink-0 self-start sm:self-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition"
        >
          {item.review_completed ? "Review done" : "Review misses"}
        </button>
      ) : null}
    </div>
  );
}

export default function TestsBySubject({ tests, onOpenTest, onOpenReview }) {
  const items = useMemo(
    () =>
      [...tests].sort(
        (a, b) => (b.sort_ts || 0) - (a.sort_ts || 0) || String(b.id).localeCompare(String(a.id)),
      ),
    [tests],
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <TestRow
          key={item.id}
          item={item}
          onOpenTest={onOpenTest}
          onOpenReview={onOpenReview}
        />
      ))}
    </div>
  );
}
