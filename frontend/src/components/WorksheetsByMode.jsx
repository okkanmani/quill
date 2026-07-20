import { useMemo, useState } from "react";
import WorksheetsBySubject from "./WorksheetsBySubject";
import ThinkingQuestByWeek from "./ThinkingQuestByWeek";

const SECTION_STYLES = {
  practice:
    "bg-indigo-100/90 hover:bg-indigo-100 border-indigo-200/80",
  timed: "bg-rose-100/90 hover:bg-rose-100 border-rose-200/80",
  enrichment:
    "bg-amber-100/90 hover:bg-amber-100 border-amber-200/80",
  gifted:
    "bg-violet-100/90 hover:bg-violet-100 border-violet-200/80",
  tests:
    "bg-teal-100/90 hover:bg-teal-100 border-teal-200/80",
};

function isSpecialTrack(ws) {
  return Boolean(ws.math_enrichment || ws.gifted_track);
}

/**
 * Practice, Timed, Math Enrichment, Thinking Quest, and Tests.
 */
export default function WorksheetsByMode({
  worksheets,
  onOpenWorksheet,
  renderSideAction,
  renderWeekAction,
  giftedTrackUnlockedThroughWeek,
}) {
  const practice = useMemo(
    () => worksheets.filter((ws) => !ws.timed && !isSpecialTrack(ws) && !ws.is_test),
    [worksheets],
  );
  const timed = useMemo(
    () => worksheets.filter((ws) => ws.timed && !isSpecialTrack(ws) && !ws.is_test),
    [worksheets],
  );
  const mathEnrichment = useMemo(
    () => worksheets.filter((ws) => ws.math_enrichment && !ws.gifted_track),
    [worksheets],
  );
  const thinkingQuest = useMemo(
    () => worksheets.filter((ws) => ws.gifted_track),
    [worksheets],
  );
  const tests = useMemo(
    () => worksheets.filter((ws) => ws.is_test),
    [worksheets],
  );
  const [openModes, setOpenModes] = useState(() => new Set());

  function toggleMode(key) {
    setOpenModes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const sections = [
    {
      key: "practice",
      title: "Practice",
      description: "Work at your own pace. You can save progress and finish later.",
      items: practice,
    },
    {
      key: "timed",
      title: "Timed",
      description: "Complete within the time limit. Progress cannot be saved.",
      items: timed,
    },
    {
      key: "enrichment",
      title: "Math Enrichment",
      description:
        "Extra-challenging math puzzles — great prep for contests like Gauss and Pascal.",
      items: mathEnrichment,
    },
    {
      key: "gifted",
      title: "Thinking Quest",
      description:
        "A 12-week brain-building path — patterns, logic, and problem-solving for special-program style challenges.",
      items: thinkingQuest,
    },
    {
      key: "tests",
      title: "Tests",
      description:
        "Adaptive assessments — unlock access or reset an in-progress sitting.",
      items: tests,
    },
  ];

  if (
    practice.length === 0 &&
    timed.length === 0 &&
    mathEnrichment.length === 0 &&
    thinkingQuest.length === 0 &&
    tests.length === 0
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ key, title, description, items }) => {
        if (items.length === 0) return null;
        const isOpen = openModes.has(key);
        const flatList = key === "enrichment";
        const isThinkingQuest = key === "gifted";
        return (
          <div
            key={key}
            className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleMode(key)}
              aria-expanded={isOpen}
              className={`w-full text-left px-4 py-4 border-b transition ${
                SECTION_STYLES[key] || SECTION_STYLES.practice
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950 text-lg">{title}</p>
                  <p className="text-slate-700 text-sm mt-0.5">{description}</p>
                  <p className="text-slate-600 text-xs font-semibold mt-1 tabular-nums">
                    {items.length} {key === "tests" ? "test" : "worksheet"}
                    {items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-slate-900 text-sm font-bold shrink-0 pt-1">
                  {isOpen ? "▼" : "▶"}
                </span>
              </div>
            </button>
            {isOpen ? (
              <div className="p-3 bg-slate-50/40">
                {isThinkingQuest ? (
                  <ThinkingQuestByWeek
                    worksheets={items}
                    onOpenWorksheet={onOpenWorksheet}
                    renderSideAction={renderSideAction}
                    renderWeekAction={renderWeekAction}
                    giftedTrackUnlockedThroughWeek={giftedTrackUnlockedThroughWeek}
                  />
                ) : (
                  <WorksheetsBySubject
                    worksheets={items}
                    onOpenWorksheet={onOpenWorksheet}
                    renderSideAction={renderSideAction}
                    ungrouped={flatList}
                  />
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
