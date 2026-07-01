import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { deleteWorksheet, getWorksheets, logout, unlockTimedWorksheet, uploadWorksheet } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import RecycleBinButton from "../components/RecycleBinButton";
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);

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

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function deleteWorksheets(ids) {
    const list = [...ids];
    if (list.length === 0) return;

    const preview =
      list.length === 1
        ? worksheets.find((w) => w.id === list[0])?.title || list[0]
        : `${list.length} worksheets`;

    const ok = window.confirm(
      list.length === 1
        ? `Delete “${preview}”? This removes it from the database. It will not come back unless you import it again from JSON.`
        : `Delete ${list.length} worksheets? They will not come back unless you import them again from JSON.`,
    );
    if (!ok) return;

    setDeleting(true);
    setError("");
    const removed = [];
    const failed = [];

    try {
      for (const id of list) {
        try {
          await deleteWorksheet(id);
          removed.push(id);
        } catch {
          const ws = worksheets.find((w) => w.id === id);
          failed.push(ws?.title || id);
        }
      }

      if (removed.length > 0) {
        setWorksheets((prev) => prev.filter((w) => !removed.includes(w.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of removed) next.delete(id);
          return next;
        });
        setUploadMessage(
          removed.length === 1
            ? `Deleted ${removed[0]}.`
            : `Deleted ${removed.length} worksheets.`,
        );
      }

      if (failed.length > 0) {
        setError(`Could not delete: ${failed.join(", ")}.`);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleDelete(ws) {
    await deleteWorksheets([ws.id]);
  }

  async function handleDeleteSelected() {
    await deleteWorksheets(selectedIds);
  }

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

  const selectedCount = selectedIds.size;

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
          <>
            {selectedCount > 0 ? (
              <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-md">
                <span className="text-sm font-semibold text-slate-800 tabular-nums">
                  {selectedCount} selected
                </span>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                    aria-hidden
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  {deleting ? "Deleting…" : "Delete selected"}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={deleting}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            ) : null}

            <WorksheetsByMode
              worksheets={worksheets}
              onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
              renderSideAction={(ws) => (
                <div className="flex flex-row sm:flex-col shrink-0 gap-2 self-center sm:self-stretch items-center sm:items-stretch sm:w-11">
                  <label
                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition"
                    title={`Select ${ws.title}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ws.id)}
                      onChange={() => toggleSelected(ws.id)}
                      disabled={deleting}
                      aria-label={`Select ${ws.title}`}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                  {ws.timed_locked ? (
                    <button
                      type="button"
                      onClick={() => handleUnlock(ws)}
                      className="inline-flex items-center justify-center bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-semibold rounded-xl px-2 py-1.5 sm:py-2 transition whitespace-nowrap"
                    >
                      Unlock
                    </button>
                  ) : null}
                  <RecycleBinButton
                    onClick={() => handleDelete(ws)}
                    label={`Delete ${ws.title}`}
                    disabled={deleting}
                  />
                </div>
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
