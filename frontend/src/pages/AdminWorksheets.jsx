import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { deleteWorksheet, getWorksheets, logout, unlockTimedWorksheet, uploadWorksheet } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import WorksheetsByMode from "../components/WorksheetsByMode";

export default function AdminWorksheets() {
  const navigate = useNavigate();
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  function loadWorksheets({ preserveError = false } = {}) {
    setLoading(true);
    getWorksheets()
      .then((data) => {
        if (!preserveError) setError("");
        setWorksheets(data);
      })
      .catch(() => setError("Could not load worksheets."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadWorksheets();
  }, [location.key]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleUnlock(ws) {
    const ok = window.confirm(
      `Unlock “${ws.title}”? The student will be able to start this timed worksheet again from scratch.`,
    );
    if (!ok) return;
    try {
      await unlockTimedWorksheet(ws.id);
      setUploadMessage(`Unlocked ${ws.id} — “${ws.title}”.`);
      loadWorksheets();
    } catch (err) {
      setError(err.message || "Could not unlock worksheet.");
    }
  }

  async function handleDelete(ws) {
    const ok = window.confirm(
      `Delete “${ws.title}”? This removes it from the database. It will not come back unless you import it again from JSON.`,
    );
    if (!ok) return;
    try {
      await deleteWorksheet(ws.id);
      setError("");
      setWorksheets((prev) => prev.filter((w) => w.id !== ws.id));
    } catch {
      setError("Could not delete worksheet.");
    }
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setUploadMessage("");
    setError("");

    const uploaded = [];
    const failed = [];

    try {
      for (const file of files) {
        try {
          const result = await uploadWorksheet(file);
          uploaded.push(result);
        } catch (err) {
          failed.push({
            name: file.name,
            message: err.message || "Upload failed",
          });
        }
      }

      if (uploaded.length > 0) {
        if (uploaded.length === 1) {
          const r = uploaded[0];
          setUploadMessage(
            `Uploaded ${r.id} — “${r.title}” (${r.question_count} questions).`,
          );
        } else {
          setUploadMessage(
            `Uploaded ${uploaded.length} worksheets: ${uploaded.map((r) => r.id).join(", ")}.`,
          );
        }
        loadWorksheets({ preserveError: failed.length > 0 });
      }

      if (failed.length > 0) {
        setError(
          failed.map((f) => `${f.name}: ${f.message}`).join(" "),
        );
      } else {
        setUploadPanelOpen(false);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader
        navLinks={ADMIN_MAIN_NAV}
        trailing={
          <>
            <span className="text-slate-800 text-sm font-medium">
              Admin · {formatAdminHeaderTrail()}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUploadPanelOpen((open) => !open);
                  if (uploadPanelOpen) setUploadMessage("");
                }}
                aria-expanded={uploadPanelOpen}
                aria-controls="add-worksheet-panel"
                className={`text-sm font-semibold px-1 py-1 ${
                  uploadPanelOpen
                    ? "text-indigo-900 underline"
                    : "text-indigo-700 hover:text-indigo-900 hover:underline"
                }`}
              >
                Add worksheet
              </button>
              {uploadPanelOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close add worksheet menu"
                    tabIndex={-1}
                    onClick={() => !uploading && setUploadPanelOpen(false)}
                  />
                  <div
                    id="add-worksheet-panel"
                    className="absolute top-full right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg flex flex-col gap-2"
                  >
                    <Link
                      to="/admin/worksheets/builder"
                      onClick={() => setUploadPanelOpen(false)}
                      className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl px-4 py-2 transition"
                    >
                      Build worksheet
                    </Link>
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <span className="w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold rounded-xl px-4 py-2 transition whitespace-nowrap">
                        {uploading ? "Uploading…" : "Upload JSON"}
                      </span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        multiple
                        className="sr-only"
                        disabled={uploading}
                        onChange={handleUpload}
                      />
                    </label>
                  </div>
                </>
              ) : null}
            </div>
          </>
        }
        onLogout={handleLogout}
      />

      <div className="max-w-3xl">
        <AdminStudentSwitcher />

        {uploadMessage && (
          <p className="text-green-700 text-sm mb-4">{uploadMessage}</p>
        )}

        {loading && <p className="text-slate-600">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && worksheets.length === 0 && (
          <p className="text-slate-600">No worksheets.</p>
        )}

        {!loading && !error && worksheets.length > 0 && (
          <WorksheetsByMode
            worksheets={worksheets}
            onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
            renderSideAction={(ws) => (
              <div className="flex flex-col sm:w-32 shrink-0 gap-2 self-stretch">
                {ws.timed_locked ? (
                  <button
                    type="button"
                    onClick={() => handleUnlock(ws)}
                    className="flex-1 flex items-center justify-center bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-sm font-semibold rounded-2xl px-3 py-3 transition"
                  >
                    Unlock
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDelete(ws)}
                  className="flex-1 flex items-center justify-center bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-sm font-semibold rounded-2xl px-3 py-3 transition"
                >
                  Delete
                </button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
