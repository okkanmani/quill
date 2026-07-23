import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  deleteResult,
  deleteWritingSubmission,
  getAdminTestResults,
  getPracticeResults,
  getResults,
  getWritingSubmissions,
  gradeWritingSubmission,
  logout,
} from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import { resultIdsMatch } from "../adminHomeUtils";
import AppShell from "../components/AppShell";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentGate from "../components/AdminStudentGate";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";
import ResultsPageCategory from "../components/ResultsPageCategory";
import PracticeResultsSection from "../components/PracticeResultsSection";
import TestResultsSection from "../components/TestResultsSection";
import WritingResultsSection from "../components/WritingResultsSection";
import { normalizeSubjectKey } from "../subjectUtils";

function ResultsViewTabs({ activeView }) {
  const worksheetClass =
    activeView === "worksheets"
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50";
  const testClass =
    activeView === "tests"
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link
        to="/admin/results"
        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${worksheetClass}`}
      >
        Worksheet results
      </Link>
      <Link
        to="/admin/results?view=tests"
        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${testClass}`}
      >
        Test results
      </Link>
    </div>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resultsView = searchParams.get("view") === "tests" ? "tests" : "worksheets";
  const deepLinkResultId = searchParams.get("result");
  const deepLinkAttemptId = searchParams.get("attempt");
  const [results, setResults] = useState([]);
  const [practiceResults, setPracticeResults] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [writing, setWriting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [openPracticeIds, setOpenPracticeIds] = useState(() => new Set());
  const [openTestIds, setOpenTestIds] = useState(() => new Set());
  const [openWritingIds, setOpenWritingIds] = useState(() => new Set());
  const [expandResultSubjectKeys, setExpandResultSubjectKeys] = useState([]);
  const [deletingResultId, setDeletingResultId] = useState(null);
  const [deletingWritingId, setDeletingWritingId] = useState(null);
  const [gradingWritingId, setGradingWritingId] = useState(null);
  const [savingWritingFeedbackId, setSavingWritingFeedbackId] = useState(null);
  const [message, setMessage] = useState("");
  const selectedStudent = localStorage.getItem("studentName") || "";

  useEffect(() => {
    if (!selectedStudent) {
      setLoading(false);
      return;
    }
    Promise.all([getResults(), getPracticeResults(), getAdminTestResults(), getWritingSubmissions()])
      .then(([resultData, practiceData, testData, writingData]) => {
        setResults(resultData);
        setPracticeResults(Array.isArray(practiceData) ? practiceData : []);
        setTestResults(Array.isArray(testData) ? testData : []);
        setWriting(writingData);
      })
      .catch(() => setError("Could not load results."))
      .finally(() => setLoading(false));
  }, [selectedStudent]);

  useEffect(() => {
    if (!deepLinkResultId) return;

    const mainMatch = results.find((result) =>
      resultIdsMatch(result.id, deepLinkResultId),
    );
    if (mainMatch) {
      setOpenIds(new Set([mainMatch.id]));
      setExpandResultSubjectKeys([normalizeSubjectKey(mainMatch.subject)]);
      return;
    }

    const practiceMatch = practiceResults.find((result) =>
      resultIdsMatch(result.id, deepLinkResultId),
    );
    if (practiceMatch) {
      setOpenPracticeIds(new Set([practiceMatch.id]));
      setExpandResultSubjectKeys([]);
    }
  }, [deepLinkResultId, results, practiceResults]);

  useEffect(() => {
    if (!deepLinkAttemptId || testResults.length === 0) return;
    const target = testResults.find((result) =>
      resultIdsMatch(result.id, deepLinkAttemptId),
    );
    if (!target) return;
    setOpenTestIds(new Set([target.id]));
  }, [deepLinkAttemptId, testResults]);

  function toggleAnswers(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWriting(id) {
    setOpenWritingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePractice(id) {
    setOpenPracticeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTest(id) {
    setOpenTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleDeleteResult(result) {
    const label = result.title || result.worksheet_id;
    const ok = window.confirm(
      `Delete this submission for “${label}”? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingResultId(result.id);
    setError("");
    try {
      await deleteResult(result.id);
      setResults((prev) => prev.filter((r) => r.id !== result.id));
      setOpenIds((prev) => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
      setMessage(`Deleted submission for “${label}”.`);
    } catch (err) {
      setError(err.message || "Could not delete result.");
    } finally {
      setDeletingResultId(null);
    }
  }

  async function handleDeleteWriting(item) {
    const ok = window.confirm(
      `Delete writing “${item.title}”? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingWritingId(item.id);
    setError("");
    try {
      await deleteWritingSubmission(item.id);
      setWriting((prev) => prev.filter((w) => w.id !== item.id));
      setOpenWritingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setMessage(`Deleted writing “${item.title}”.`);
    } catch (err) {
      setError(err.message || "Could not delete writing.");
    } finally {
      setDeletingWritingId(null);
    }
  }

  async function handleGradeWriting(item, grade, feedback = "", options = {}) {
    if (!grade) return;
    const { feedbackOnly = false } = options;
    if (feedbackOnly) {
      setSavingWritingFeedbackId(item.id);
    } else {
      setGradingWritingId(item.id);
    }
    setError("");
    try {
      const updated = await gradeWritingSubmission(item.id, { grade, feedback });
      setWriting((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w)),
      );
      setMessage(
        feedbackOnly
          ? `Saved feedback for “${updated.title}”.`
          : `Graded “${updated.title}” — ${updated.grade}.`,
      );
      if (feedbackOnly) {
        setOpenWritingIds((prev) => {
          const next = new Set(prev);
          next.delete(updated.id);
          return next;
        });
      }
    } catch (err) {
      setError(err.message || "Could not save evaluation.");
    } finally {
      setGradingWritingId(null);
      setSavingWritingFeedbackId(null);
    }
  }

  const hasMainWorksheets = results.length > 0 || writing.length > 0;
  const hasRevision = practiceResults.length > 0;
  const hasTests = testResults.length > 0;
  const hasWorksheetResults = hasMainWorksheets || hasRevision;

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
    >
      <AdminStudentGate context="results">
      <div className="max-w-3xl">
        <AdminStudentSwitcher />

        <h1 className="text-2xl font-bold text-slate-950 mb-1">Results</h1>
        <ResultsViewTabs activeView={resultsView} />
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {resultsView === "tests"
            ? "Adaptive test sittings for the selected student — weighted scores and answer review."
            : "Main worksheet, writing, and revision practice results for the selected student."}
        </p>

        {message && (
          <p className="text-green-700 text-sm mb-4">{message}</p>
        )}

        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && resultsView === "worksheets" && !hasWorksheetResults ? (
          <p className="text-slate-600">No worksheet or revision results yet.</p>
        ) : null}

        {!loading && !error && resultsView === "tests" && !hasTests ? (
          <p className="text-slate-600">No test results yet.</p>
        ) : null}

        {!loading && !error && resultsView === "worksheets" && hasWorksheetResults ? (
          <div className="flex flex-col gap-8">
            {hasMainWorksheets ? (
              <ResultsPageCategory title="Main Worksheets">
                {results.length > 0 ? (
                  <ResultsBySubject
                    results={results}
                    openIds={openIds}
                    expandSubjectKeys={expandResultSubjectKeys}
                    scrollToOpenResult
                    toggleAnswers={toggleAnswers}
                    onDeleteResult={handleDeleteResult}
                    deletingResultId={deletingResultId}
                    onResultEvaluated={(updated) =>
                      setResults((prev) =>
                        prev.map((r) => (r.id === updated.id ? updated : r)),
                      )
                    }
                    onAnalysisError={setError}
                  />
                ) : null}
                {writing.length > 0 ? (
                  <WritingResultsSection
                    submissions={writing}
                    openIds={openWritingIds}
                    toggleOpen={toggleWriting}
                    onDelete={handleDeleteWriting}
                    onGrade={handleGradeWriting}
                    deletingId={deletingWritingId}
                    gradingId={gradingWritingId}
                    savingFeedbackId={savingWritingFeedbackId}
                  />
                ) : null}
              </ResultsPageCategory>
            ) : null}
            {hasRevision ? (
              <ResultsPageCategory title="Revision">
                <PracticeResultsSection
                  results={practiceResults}
                  openIds={openPracticeIds}
                  toggleOpen={togglePractice}
                  scrollToOpenResult
                />
              </ResultsPageCategory>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && resultsView === "tests" && hasTests ? (
          <TestResultsSection
            results={testResults}
            openIds={openTestIds}
            toggleOpen={toggleTest}
            embedded
          />
        ) : null}
      </div>
      </AdminStudentGate>
    </AppShell>
  );
}
