import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import TestsBySubject from "../components/TestsBySubject";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentTests() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { tests, navLinks, loading, error } = useStudentNavLinks();

  useEffect(() => {
    if (!loading && !error && tests.length === 0) {
      navigate("/student", { replace: true });
    }
  }, [loading, error, tests.length, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell navLinks={navLinks} trailing={`Hi, ${name}!`} onLogout={handleLogout}>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Tests</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Timed, adaptive assessments — one sitting each. Difficulty adjusts as you
          answer. After submitting, review any questions you missed with notes for
          follow-up discussion.
        </p>

        {loading && <QuillLoading label="Loading tests…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && tests.length > 0 ? (
          <TestsBySubject
            tests={tests}
            onOpenTest={(id) => navigate(`/student/tests/${id}`)}
            onOpenReview={(reviewId) => navigate(`/student/tests/review/${reviewId}`)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
