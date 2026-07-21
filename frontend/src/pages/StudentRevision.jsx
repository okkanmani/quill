import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import RevisionBySubject from "../components/RevisionBySubject";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentRevision() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { revisions, navLinks, loading, error } = useStudentNavLinks();

  useEffect(() => {
    if (!loading && revisions.length === 0) {
      navigate("/student", { replace: true });
    }
  }, [loading, revisions.length, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell
      navLinks={navLinks}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Revision</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Short practice worksheets from skills your teacher discussed with you.
          Open one to practice and check your answers.
        </p>

        {loading && <QuillLoading label="Loading revision worksheets…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && revisions.length > 0 && (
          <RevisionBySubject
            revisions={revisions}
            onOpenRevision={(id) => navigate(`/student/revision/${id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
