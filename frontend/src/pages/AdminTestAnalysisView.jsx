import { useEffect, useMemo, useState } from "react";
import { getAdminTestResults, markTestAttemptAnalyzed } from "../api";
import QuillLoading from "../components/QuillLoading";
import { TestAnalysisDetail, TestAttemptTile } from "../components/TestAnalysisPanels";
import { analyzeTestAttempt, filterAdaptiveTestAttempts } from "../testAnalysisUtils";

export default function AdminTestAnalysisView({ initialAttemptId = null }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(
    initialAttemptId ? Number(initialAttemptId) : null,
  );

  useEffect(() => {
    setLoading(true);
    getAdminTestResults()
      .then((data) => {
        setError("");
        setAttempts(filterAdaptiveTestAttempts(data));
      })
      .catch(() => setError("Could not load test results."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialAttemptId) {
      setSelectedId(Number(initialAttemptId));
    }
  }, [initialAttemptId]);

  useEffect(() => {
    if (!selectedId) return;
    const attempt = attempts.find((item) => item.id === selectedId);
    if (!attempt || attempt.analyzed_at) return;
    markTestAttemptAnalyzed(selectedId)
      .then(({ analyzed_at: analyzedAt }) => {
        setAttempts((prev) =>
          prev.map((item) =>
            item.id === selectedId ? { ...item, analyzed_at: analyzedAt } : item,
          ),
        );
      })
      .catch(() => {});
  }, [selectedId, attempts]);

  const selectedAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === selectedId) || null,
    [attempts, selectedId],
  );

  const analysis = useMemo(
    () => (selectedAttempt ? analyzeTestAttempt(selectedAttempt) : null),
    [selectedAttempt],
  );

  if (loading) return <QuillLoading label="Loading test analysis…" />;

  return (
    <div>
      <p className="text-slate-700 text-sm leading-relaxed mb-6">
        Adaptive test performance under timed conditions — tier movement, accuracy by
        difficulty, and topic strengths/weaknesses for one sitting at a time.
      </p>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
          No completed adaptive tests yet. Use <strong>Analyse</strong> on the Results
          page after a student submits an adaptive test.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
          <div className="w-full lg:w-44 xl:w-48 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Tests
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {attempts.map((attempt) => (
                <TestAttemptTile
                  key={attempt.id}
                  attempt={attempt}
                  selected={attempt.id === selectedId}
                  onSelect={() => setSelectedId(attempt.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 lg:sticky lg:top-4">
            {selectedAttempt && analysis ? (
              <TestAnalysisDetail
                key={selectedAttempt.id}
                attempt={selectedAttempt}
                analysis={analysis}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 min-h-[20rem] flex items-center justify-center text-sm text-slate-500">
                Select a test to view analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
