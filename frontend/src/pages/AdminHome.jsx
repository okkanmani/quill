import { useEffect, useRef, useState } from "react";
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
import StatusToast from "../components/StatusToast";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentGate from "../components/AdminStudentGate";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";
import ResultsAnswerAside from "../components/ResultsAnswerAside";
import ResultsPageCategory from "../components/ResultsPageCategory";
import PracticeResultsSection from "../components/PracticeResultsSection";
import TestResultsSection from "../components/TestResultsSection";
import WritingResultsSection from "../components/WritingResultsSection";
import { normalizeSubjectKey } from "../subjectUtils";
import { useAutoDismissToast } from "../useAutoDismissToast";
import {
  RESULTS_EMPTY,
  RESULTS_ERROR,
  RESULTS_PAGE_HEADING,
  RESULTS_PAGE_INTRO,
  RESULTS_VIEW_TAB,
  RESULTS_VIEW_TAB_ACTIVE,
  RESULTS_VIEW_TAB_IDLE,
} from "../resultsTypography";
import {
  RESULTS_LIST_WIDTH_CLASS,
  RESULTS_SPLIT_GRID_CLASS,
  RESULTS_SPLIT_WIDTH_CLASS,
} from "../resultsLayout";

function ResultsViewTabs({ activeView }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Link
        to="/admin/results"
        className={`${RESULTS_VIEW_TAB} ${
          activeView === "worksheets" ? RESULTS_VIEW_TAB_ACTIVE : RESULTS_VIEW_TAB_IDLE
        }`}
      >
        Worksheet results
      </Link>
      <Link
        to="/admin/results?view=tests"
        className={`${RESULTS_VIEW_TAB} ${
          activeView === "tests" ? RESULTS_VIEW_TAB_ACTIVE : RESULTS_VIEW_TAB_IDLE
        }`}
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
  useAutoDismissToast(message, setMessage);
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
      setOpenPracticeIds(new Set());
      setOpenIds(new Set([mainMatch.id]));
      setExpandResultSubjectKeys([normalizeSubjectKey(mainMatch.subject)]);
      return;
    }

    const practiceMatch = practiceResults.find((result) =>
      resultIdsMatch(result.id, deepLinkResultId),
    );
    if (practiceMatch) {
      setOpenIds(new Set());
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

  const prevResultsViewRef = useRef(resultsView);
  useEffect(() => {
    if (prevResultsViewRef.current === resultsView) return;
    prevResultsViewRef.current = resultsView;
    setOpenIds(new Set());
    setOpenPracticeIds(new Set());
    setOpenTestIds(new Set());
  }, [resultsView]);

  function toggleAnswers(id) {
    setOpenPracticeIds(new Set());
    setOpenIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
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
    setOpenIds(new Set());
    setOpenPracticeIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
  }

  function toggleTest(id) {
    setOpenTestIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
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
  const openWorksheetId = openIds.size > 0 ? [...openIds][0] : null;
  const openPracticeId = openPracticeIds.size > 0 ? [...openPracticeIds][0] : null;
  const selectedWorksheetResult = openWorksheetId
    ? results.find((result) => result.id === openWorksheetId) ?? null
    : null;
  const selectedPracticeResult = openPracticeId
    ? practiceResults.find((result) => result.id === openPracticeId) ?? null
    : null;
  const openTestId = openTestIds.size > 0 ? [...openTestIds][0] : null;
  const selectedTestResult = openTestId
    ? testResults.find((result) => result.id === openTestId) ?? null
    : null;
  const hasAnswerSelection = Boolean(
    selectedWorksheetResult || selectedPracticeResult,
  );
  const hasTestAnswerSelection = Boolean(selectedTestResult);
  const useSplitLayout =
    (resultsView === "worksheets" && hasAnswerSelection) ||
    (resultsView === "tests" && hasTestAnswerSelection);

  function closeAnswerPanel() {
    setOpenIds(new Set());
    setOpenPracticeIds(new Set());
  }

  function closeTestAnswerPanel() {
    setOpenTestIds(new Set());
  }

  function handleWorksheetSubjectCollapse(subjectKey) {
    const openId = openIds.size > 0 ? [...openIds][0] : null;
    if (!openId) return;
    const match = results.find((result) => result.id === openId);
    if (match && normalizeSubjectKey(match.subject) === subjectKey) {
      setOpenIds(new Set());
    }
  }

  function handlePracticeSectionCollapse() {
    setOpenPracticeIds(new Set());
  }

  function handleResultEvaluated(updated) {
    setResults((prev) =>
      prev.map((result) => (result.id === updated.id ? updated : result)),
    );
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
    >
      <AdminStudentGate context="results">
      <div
        className={useSplitLayout ? RESULTS_SPLIT_WIDTH_CLASS : RESULTS_LIST_WIDTH_CLASS}
      >
        <AdminStudentSwitcher />

        <h1 className={`${RESULTS_PAGE_HEADING} mb-1`}>Results</h1>
        <ResultsViewTabs activeView={resultsView} />
        <p className={`${RESULTS_PAGE_INTRO} mb-6`}>
          {resultsView === "tests"
            ? "Adaptive test sittings for the selected student — weighted scores and answer review."
            : "Main worksheet, writing, and revision practice results for the selected student."}
        </p>

        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className={RESULTS_ERROR}>{error}</p>}

        {!loading && !error && resultsView === "worksheets" && !hasWorksheetResults ? (
          <p className={RESULTS_EMPTY}>No worksheet or revision results yet.</p>
        ) : null}

        {!loading && !error && resultsView === "tests" && !hasTests ? (
          <p className={RESULTS_EMPTY}>No test results yet.</p>
        ) : null}

        {!loading && !error && resultsView === "worksheets" && hasWorksheetResults ? (
          <div
            className={
              hasAnswerSelection
                ? RESULTS_SPLIT_GRID_CLASS
                : "lg:grid lg:grid-cols-1 lg:gap-6 lg:items-start"
            }
          >
            <div className="min-w-0 flex flex-col gap-6">
              {hasMainWorksheets ? (
                <ResultsPageCategory title="Main Worksheets">
                  {results.length > 0 ? (
                    <ResultsBySubject
                      results={results}
                      openIds={openIds}
                      expandSubjectKeys={expandResultSubjectKeys}
                      toggleAnswers={toggleAnswers}
                      onDeleteResult={handleDeleteResult}
                      deletingResultId={deletingResultId}
                      onResultEvaluated={handleResultEvaluated}
                      onAnalysisError={setError}
                      onSubjectCollapse={handleWorksheetSubjectCollapse}
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
                    onSectionCollapse={handlePracticeSectionCollapse}
                  />
                </ResultsPageCategory>
              ) : null}
              <ResultsAnswerAside
                className="lg:hidden"
                worksheetResult={selectedWorksheetResult}
                practiceItem={selectedPracticeResult}
                onResultEvaluated={handleResultEvaluated}
                onClose={closeAnswerPanel}
              />
            </div>
            <ResultsAnswerAside
              className="hidden lg:block"
              worksheetResult={selectedWorksheetResult}
              practiceItem={selectedPracticeResult}
              onResultEvaluated={handleResultEvaluated}
              onClose={closeAnswerPanel}
            />
          </div>
        ) : null}

        {!loading && !error && resultsView === "tests" && hasTests ? (
          <div
            className={
              hasTestAnswerSelection
                ? RESULTS_SPLIT_GRID_CLASS
                : "lg:grid lg:grid-cols-1 lg:gap-6 lg:items-start"
            }
          >
            <div className="min-w-0">
              <TestResultsSection
                results={testResults}
                openIds={openTestIds}
                toggleOpen={toggleTest}
                embedded
              />
              <ResultsAnswerAside
                className="lg:hidden mt-4"
                testResult={selectedTestResult}
                onClose={closeTestAnswerPanel}
              />
            </div>
            <ResultsAnswerAside
              className="hidden lg:block"
              testResult={selectedTestResult}
              onClose={closeTestAnswerPanel}
            />
          </div>
        ) : null}
      </div>
      </AdminStudentGate>

      <StatusToast message={message} />
    </AppShell>
  );
}
