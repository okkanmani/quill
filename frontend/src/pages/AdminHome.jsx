import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteResult,
  deleteWritingSubmission,
  getResults,
  getWritingSubmissions,
  gradeWritingSubmission,
  logout,
} from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentBanner from "../components/AdminStudentBanner";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";
import WritingResultsSection from "../components/WritingResultsSection";

export default function AdminHome() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [writing, setWriting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [openWritingIds, setOpenWritingIds] = useState(() => new Set());
  const [deletingResultId, setDeletingResultId] = useState(null);
  const [deletingWritingId, setDeletingWritingId] = useState(null);
  const [gradingWritingId, setGradingWritingId] = useState(null);
  const [savingWritingFeedbackId, setSavingWritingFeedbackId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getResults(), getWritingSubmissions()])
      .then(([resultData, writingData]) => {
        setResults(resultData);
        setWriting(writingData);
      })
      .catch(() => setError("Could not load results."))
      .finally(() => setLoading(false));
  }, []);

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

  const hasAny = results.length > 0 || writing.length > 0;

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <AdminStudentBanner />
        <AdminStudentSwitcher />

        <h1 className="text-2xl font-bold text-slate-950 mb-1">Results</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Graded worksheets and writing submissions for the selected student.
        </p>

        {message && (
          <p className="text-green-700 text-sm mb-4">{message}</p>
        )}

        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && !hasAny && (
          <p className="text-slate-600">No results yet.</p>
        )}

        {!loading && !error && hasAny ? (
          <div className="flex flex-col gap-3">
            {results.length > 0 ? (
              <ResultsBySubject
                results={results}
                openIds={openIds}
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
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
