import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { completeRevisionWorksheet, getRevisionWorksheet, logout } from "../api";
import AppShell from "../components/AppShell";
import FocusPracticeWorksheet from "../components/FocusPracticeWorksheet";
import QuillLoading from "../components/QuillLoading";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentRevisionWorksheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { navLinks } = useStudentNavLinks();
  const [worksheet, setWorksheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getRevisionWorksheet(id)
      .then((data) => {
        setError("");
        setWorksheet(data);
      })
      .catch(() => setError("Could not load this revision worksheet."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleComplete({ score, total, answers }) {
    try {
      await completeRevisionWorksheet(id, { score, total, answers });
      setWorksheet((prev) =>
        prev
          ? {
              ...prev,
              last_score: score,
              last_total: total,
              completed_at: new Date().toISOString(),
            }
          : prev,
      );
    } catch {
      // Self-check still works even if save fails.
    }
  }

  return (
    <AppShell
      navLinks={navLinks}
      trailing={`Hi, ${name}!`}
      onLogout={handleLogout}
    >
      <div className="max-w-6xl">
        <Link
          to="/student/revision"
          className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 mb-4"
        >
          ← Back to Revision
        </Link>

        {loading && <QuillLoading label="Loading worksheet…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && worksheet ? (
          <FocusPracticeWorksheet
            worksheet={worksheet}
            variant="revision"
            onComplete={handleComplete}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
