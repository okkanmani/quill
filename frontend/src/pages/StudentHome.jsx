import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import WorksheetsByMode from "../components/WorksheetsByMode";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentHome() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { worksheets, navLinks, loading, error } = useStudentNavLinks();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell
      navLinks={navLinks}
      trailing={`Hi, ${name}!`}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Your worksheets</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Pick a worksheet to start. Finished ones move to Your Results.
        </p>

        {loading && <QuillLoading label="Loading worksheets…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && worksheets.length === 0 && (
          <p className="text-slate-600">No worksheets yet. Check back soon!</p>
        )}

        {!loading && !error && worksheets.length > 0 && (
          <WorksheetsByMode
            worksheets={worksheets}
            onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
