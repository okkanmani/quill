import PadlockIcon from "./PadlockIcon";
import { LOCK_STATUS_BADGE_CLASS } from "./rowActionButtonStyles";
import { formatScheduledUnlockLabel } from "../testSchedulingUtils";
import { formatWeightedTestScore } from "../testUtils";
import { formatDurationSeconds } from "../worksheetUtils";

function compositeStatusLabel(item) {
  if (item.completed_at) return "Submitted";
  if (item.attempt_id && !item.all_complete) return "In progress";
  if (item.attempt_id && item.all_complete && item.can_submit) return "Ready to submit";
  return null;
}

function CompositeRow({ item, onOpen }) {
  const locked = Boolean(item.locked);
  const status = compositeStatusLabel(item);

  return (
    <button
      type="button"
      onClick={() => !locked && onOpen(item.id)}
      disabled={locked}
      className={`w-full text-left flex flex-col bg-white border rounded-2xl shadow-sm transition overflow-hidden ${
        locked
          ? "border-slate-200 opacity-90 cursor-not-allowed"
          : "border-slate-200 hover:shadow-md hover:border-teal-400"
      }`}
    >
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-slate-900 font-semibold text-lg">{item.title}</p>
          <span className="shrink-0 flex items-center gap-2">
            {locked ? (
              <span
                className={`${LOCK_STATUS_BADGE_CLASS} bg-violet-100 border-violet-200 text-violet-700`}
                title="Locked — ask your teacher to unlock"
              >
                <PadlockIcon />
              </span>
            ) : null}
            {status ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  item.completed_at
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : item.can_submit
                      ? "bg-amber-100 text-amber-900 border-amber-200"
                      : "bg-sky-100 text-sky-900 border-sky-200"
                }`}
              >
                {status}
              </span>
            ) : null}
          </span>
        </div>
        {item.completed_at && item.overall?.weighted_score != null ? (
          <p className="text-sm font-bold text-teal-900 mt-2 tabular-nums">
            Score:{" "}
            {formatWeightedTestScore(
              item.overall.weighted_score,
              item.overall.max_weighted_score,
            )}
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 pt-3">
        <span className="text-teal-700 text-sm font-medium">
          {item.section_count} subject section{item.section_count === 1 ? "" : "s"}
        </span>
        {item.scheduled_unlock_at ? (
          <span className="text-violet-700 text-sm font-medium">
            Unlocks {formatScheduledUnlockLabel(item.scheduled_unlock_at)}
          </span>
        ) : null}
        {item.completed_at && item.overall?.duration_seconds != null ? (
          <span className="text-slate-500 text-sm">
            {formatDurationSeconds(item.overall.duration_seconds)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function CompositesList({ composites, onOpenComposite }) {
  if (!composites?.length) {
    return (
      <p className="text-sm text-slate-600">
        No composite assessments are available yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {composites.map((item) => (
        <CompositeRow key={item.id} item={item} onOpen={onOpenComposite} />
      ))}
    </div>
  );
}
