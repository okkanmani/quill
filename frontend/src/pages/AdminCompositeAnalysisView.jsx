import { useEffect, useMemo, useState } from "react";
import { getAdminCompositeTestResults, markTestAttemptAnalyzed } from "../api";
import QuillLoading from "../components/QuillLoading";
import {
  CompositeAttemptTile,
  TestAnalysisDetail,
} from "../components/TestAnalysisPanels";
import { formatSubjectLabel } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";
import { analyzeTestAttempt } from "../testAnalysisUtils";

function adaptiveSectionAttempts(composite) {
  return (composite.sections || [])
    .map((section) => section.result)
    .filter((result) => result && result.test_adaptive !== false);
}

function compositesWithAdaptiveSections(composites) {
  return (composites || []).filter(
    (composite) => adaptiveSectionAttempts(composite).length > 0,
  );
}

function findCompositeForAttempt(composites, attemptId) {
  if (!attemptId) return null;
  const numericId = Number(attemptId);
  return (
    composites.find((composite) =>
      adaptiveSectionAttempts(composite).some((attempt) => attempt.id === numericId),
    ) || null
  );
}

export default function AdminCompositeAnalysisView({
  initialCompositeId = null,
  initialAttemptId = null,
}) {
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCompositeId, setSelectedCompositeId] = useState(
    initialCompositeId ? Number(initialCompositeId) : null,
  );

  const visibleComposites = useMemo(
    () => compositesWithAdaptiveSections(composites),
    [composites],
  );

  useEffect(() => {
    setLoading(true);
    getAdminCompositeTestResults()
      .then((data) => {
        setError("");
        setComposites(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Could not load composite test results."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialCompositeId) {
      setSelectedCompositeId(Number(initialCompositeId));
      return;
    }
    if (!initialAttemptId || visibleComposites.length === 0) return;
    const match = findCompositeForAttempt(visibleComposites, initialAttemptId);
    if (match) {
      setSelectedCompositeId(match.id);
    }
  }, [initialCompositeId, initialAttemptId, visibleComposites]);

  const selectedComposite = useMemo(
    () =>
      visibleComposites.find((composite) => composite.id === selectedCompositeId) ||
      null,
    [visibleComposites, selectedCompositeId],
  );

  const sectionAttempts = useMemo(
    () => (selectedComposite ? adaptiveSectionAttempts(selectedComposite) : []),
    [selectedComposite],
  );

  useEffect(() => {
    if (!selectedComposite) return;
    for (const attempt of sectionAttempts) {
      if (attempt.analyzed_at) continue;
      markTestAttemptAnalyzed(attempt.id)
        .then(({ analyzed_at: analyzedAt }) => {
          setComposites((prev) =>
            prev.map((composite) => {
              if (composite.id !== selectedComposite.id) return composite;
              return {
                ...composite,
                sections: (composite.sections || []).map((section) => {
                  if (!section.result || section.result.id !== attempt.id) {
                    return section;
                  }
                  return {
                    ...section,
                    result: { ...section.result, analyzed_at: analyzedAt },
                  };
                }),
              };
            }),
          );
        })
        .catch(() => {});
    }
  }, [selectedComposite, sectionAttempts]);

  useEffect(() => {
    if (!initialAttemptId || !selectedComposite) return;
    const element = document.getElementById(
      `composite-section-analysis-${initialAttemptId}`,
    );
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialAttemptId, selectedComposite, sectionAttempts]);

  if (loading) return <QuillLoading page label="Loading composite analysis…" />;

  return (
    <div>
      <p className="text-slate-700 text-sm leading-relaxed mb-6">
        Multi-subject composite assessments — review each adaptive section within a
        composite sitting, with the same tier and topic analysis as standalone tests.
      </p>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      {visibleComposites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
          No completed adaptive composite tests yet. Use <strong>Analyse</strong> on the
          Composite results page after a student submits a composite assessment.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
          <div className="w-full lg:w-44 xl:w-48 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Composites
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {visibleComposites.map((composite) => (
                <CompositeAttemptTile
                  key={composite.id}
                  composite={composite}
                  selected={composite.id === selectedCompositeId}
                  onSelect={() => setSelectedCompositeId(composite.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {selectedComposite ? (
              <div className="rounded-2xl border border-violet-200 bg-white shadow-sm px-5 py-5 min-w-0">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <p className="text-lg font-bold text-slate-950">
                    {selectedComposite.title}
                  </p>
                  <p className="text-sm text-violet-800 mt-1">
                    Composite · {sectionAttempts.length} adaptive section
                    {sectionAttempts.length === 1 ? "" : "s"}
                  </p>
                  {selectedComposite.completed_at ? (
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(selectedComposite.completed_at).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-100 px-3 py-1 font-bold text-violet-900 tabular-nums">
                      {formatWeightedTestScore(
                        selectedComposite.weighted_score,
                        selectedComposite.max_weighted_score,
                      )}
                    </span>
                    {selectedComposite.duration_seconds != null ? (
                      <span className="text-slate-600 tabular-nums">
                        {formatDurationSeconds(selectedComposite.duration_seconds)} total
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-8">
                  {sectionAttempts.map((attempt, index) => {
                    const analysis = analyzeTestAttempt(attempt);
                    return (
                      <section
                        key={attempt.id}
                        id={`composite-section-analysis-${attempt.id}`}
                        className={index > 0 ? "pt-8 border-t border-slate-100" : ""}
                      >
                        <div className="mb-4">
                          <h2 className="text-base font-bold text-slate-950">
                            {attempt.title}
                          </h2>
                          <p className="text-sm text-teal-800 mt-0.5 capitalize">
                            {formatSubjectLabel(attempt.subject)} · Section{" "}
                            {index + 1} of {sectionAttempts.length}
                          </p>
                          <p className="text-xs font-semibold text-teal-900 mt-2 tabular-nums">
                            {formatWeightedTestScore(
                              attempt.weighted_score,
                              attempt.max_weighted_score,
                            )}
                          </p>
                        </div>
                        <TestAnalysisDetail
                          attempt={attempt}
                          analysis={analysis}
                          nested
                        />
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 min-h-[20rem] flex items-center justify-center text-sm text-slate-500">
                Select a composite to view section analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
