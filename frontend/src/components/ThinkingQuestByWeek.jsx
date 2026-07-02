import { useMemo, useState } from "react";
import WorksheetsBySubject from "./WorksheetsBySubject";
import {
  averagePercentAcrossDoneWorksheets,
  isWorksheetDone,
} from "../subjectUtils";
import { groupGiftedTrackByWeek } from "../worksheetUtils";
import PadlockIcon from "./PadlockIcon";

/**
 * Thinking Quest sub-accordions: Week 1, Week 2, … each with one or more worksheets.
 */
export default function ThinkingQuestByWeek({
  worksheets,
  onOpenWorksheet,
  renderSideAction,
  renderWeekAction,
  giftedTrackUnlockedThroughWeek,
}) {
  const weeks = useMemo(
    () => groupGiftedTrackByWeek(worksheets),
    [worksheets],
  );
  const [openWeeks, setOpenWeeks] = useState(() => new Set());

  function toggle(week) {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }

  if (weeks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {weeks.map(([week, items]) => {
        const isOpen = openWeeks.has(week);
        const total = items.length;
        const done = items.filter(isWorksheetDone).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const avgScore = averagePercentAcrossDoneWorksheets(items);
        const pendingItems = items.filter((ws) => !isWorksheetDone(ws));
        const weekGated =
          typeof giftedTrackUnlockedThroughWeek === "number" &&
          week > giftedTrackUnlockedThroughWeek;
        const weekExplicitlyLocked = items.some((ws) => ws.week_explicitly_locked);
        const weekLocked =
          (weekGated || weekExplicitlyLocked) &&
          pendingItems.length > 0 &&
          pendingItems.every((ws) => ws.access_locked);
        const weekAction = renderWeekAction
          ? renderWeekAction(week, items, {
              weekGated,
              weekExplicitlyLocked,
              weekLockedForAdmin: weekGated || weekExplicitlyLocked,
              weekLockedForStudent: weekLocked,
            })
          : null;
        return (
          <div
            key={week}
            className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
              weekLocked ? "border-violet-300/90" : "border-violet-200/90"
            }`}
          >
            <div className="flex items-stretch gap-2 bg-violet-50/90 border-b border-violet-200/70">
              <button
                type="button"
                onClick={() => toggle(week)}
                aria-expanded={isOpen}
                className="flex-1 flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-violet-50 transition"
              >
                <span className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                  <span className="font-bold text-violet-950 text-base inline-flex items-center gap-2">
                    Week {week}
                    {weekLocked ? (
                      <span
                        className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-violet-700 w-7 h-7"
                        title="This week is locked for the student"
                        aria-label="Week locked"
                      >
                        <PadlockIcon className="w-3.5 h-3.5" />
                      </span>
                    ) : null}
                  </span>
                <span className="font-semibold text-violet-900/90 text-sm tabular-nums">
                  {done}/{total} done
                  {total > 0 ? (
                    <span className="text-violet-800/85 font-medium">
                      {" "}
                      · {pct}%
                    </span>
                  ) : null}
                  {avgScore ? (
                    <span className="text-violet-900 font-semibold">
                      {" "}
                      · avg {avgScore.avgPct}%
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="text-violet-950 text-sm font-bold shrink-0 tabular-nums">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {weekAction ? (
              <div className="shrink-0 flex items-center px-2 sm:px-3 border-l border-violet-200/70">
                {weekAction}
              </div>
            ) : null}
            </div>
            {isOpen ? (
              <div className="p-3 flex flex-col gap-4 bg-violet-50/20">
                <WorksheetsBySubject
                  worksheets={items}
                  onOpenWorksheet={onOpenWorksheet}
                  renderSideAction={renderSideAction}
                  ungrouped
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
