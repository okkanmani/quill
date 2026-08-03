import TestResultsSection, { TestAnalyseIconLink } from "./TestResultsSection";
import {
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ITEM_TOGGLE,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SCORE_BADGE,
  RESULTS_BODY_MUTED,
  RESULTS_SUBTITLE_TEAL,
} from "../resultsTypography";
import { HUB_TOP_BODY } from "../hubSectionStyles";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";

function sectionResults(composite) {
  return (composite.sections || [])
    .map((section) => section.result)
    .filter(Boolean);
}

function compositeAnalyseTarget(composite) {
  const adaptiveSections = sectionResults(composite).filter(
    (section) => section.test_adaptive !== false,
  );
  if (adaptiveSections.length === 0) return null;
  const target =
    adaptiveSections.find((section) => !section.analyzed_at) || adaptiveSections[0];
  return {
    href: `/admin/analysis?view=composites&composite=${composite.id}`,
    analyzed: adaptiveSections.every((section) => section.analyzed_at),
    title: composite.title || "Composite test",
  };
}

/**
 * Completed composite test results for admin Results → Composite tests.
 */
export default function CompositeResultsSection({
  results,
  openCompositeIds,
  toggleComposite,
  openSectionIds,
  toggleSection,
  embedded = false,
}) {
  if (results.length === 0) return null;

  const listContent = (
    <div className={embedded ? "flex flex-col gap-3" : `${HUB_TOP_BODY} gap-3`}>
      {results.map((composite) => {
        const expanded = openCompositeIds.has(composite.id);
        const sections = sectionResults(composite);
        const analyseTarget = compositeAnalyseTarget(composite);
        return (
          <div
            key={composite.id}
            className="flex flex-col sm:flex-row gap-2 sm:items-stretch sm:gap-1.5"
          >
            <div
              className={`min-w-0 flex-1 ${RESULTS_ITEM_SHELL} ${
                expanded ? "ring-2 ring-violet-200" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => toggleComposite(composite.id)}
                aria-expanded={expanded}
                className={RESULTS_ITEM_HEADER}
              >
                <div className="min-w-0 flex-1">
                  <p className={RESULTS_ROW_TITLE}>{composite.title}</p>
                  <p className={RESULTS_SUBTITLE_TEAL}>
                    Composite · {sections.length} section{sections.length === 1 ? "" : "s"}
                  </p>
                  {composite.completed_at ? (
                    <p className={`${RESULTS_ROW_DETAIL} mt-1`}>
                      {new Date(composite.completed_at).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                  <span
                    className={`${RESULTS_SCORE_BADGE} px-2.5 bg-violet-100 text-violet-900 border border-violet-200 font-bold`}
                  >
                    {formatWeightedTestScore(
                      composite.weighted_score,
                      composite.max_weighted_score,
                    )}
                  </span>
                  {composite.duration_seconds != null ? (
                    <p className={`${RESULTS_ROW_DETAIL} tabular-nums`}>
                      {formatDurationSeconds(composite.duration_seconds)}
                    </p>
                  ) : null}
                  <span className={RESULTS_ITEM_TOGGLE}>
                    {expanded ? "Hide sections" : "Show sections"}
                  </span>
                </div>
              </button>
              {expanded && sections.length > 0 ? (
                <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                  <TestResultsSection
                    results={sections}
                    openIds={openSectionIds}
                    toggleOpen={toggleSection}
                    embedded
                    hideSort
                    analyseHrefForAttempt={(attempt) =>
                      `/admin/analysis?view=composites&composite=${composite.id}&attempt=${attempt.id}`
                    }
                  />
                </div>
              ) : null}
            </div>
            {analyseTarget ? (
              <div className="flex shrink-0 self-start sm:w-7 pt-3">
                <TestAnalyseIconLink
                  attemptId={0}
                  analyzed={analyseTarget.analyzed}
                  title={analyseTarget.title}
                  to={analyseTarget.href}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  if (embedded) return listContent;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-4">
      <p className="text-sm font-bold text-slate-900">Composite tests</p>
      <p className={`${RESULTS_BODY_MUTED} mt-0.5`}>
        Multi-subject assessments with per-section scores and answer review.
      </p>
      <p className={`${RESULTS_ROW_DETAIL} font-semibold mt-1 tabular-nums`}>
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3">{listContent}</div>
    </div>
  );
}
