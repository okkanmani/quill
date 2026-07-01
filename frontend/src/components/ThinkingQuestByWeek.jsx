import { useMemo, useState } from "react";
import WorksheetsBySubject from "./WorksheetsBySubject";
import {
  averagePercentAcrossDoneWorksheets,
  isWorksheetDone,
} from "../subjectUtils";
import { groupGiftedTrackByWeek } from "../worksheetUtils";

/**
 * Thinking Quest sub-accordions: Week 1, Week 2, … each with one or more worksheets.
 */
export default function ThinkingQuestByWeek({
  worksheets,
  onOpenWorksheet,
  renderSideAction,
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
        return (
          <div
            key={week}
            className="rounded-xl border border-violet-200/90 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(week)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-violet-50/90 hover:bg-violet-50 border-b border-violet-200/70 transition"
            >
              <span className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                <span className="font-bold text-violet-950 text-base">
                  Week {week}
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
