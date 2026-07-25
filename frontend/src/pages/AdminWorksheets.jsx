import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  deleteWorksheet,
  getWorksheets,
  logout,
  getAdminWorksheetSections,
  createAdminWorksheetSection,
  assignWorksheetSection,
  moveWorksheetCollection,
  organizeUnassignedWorksheets,
  deleteWorksheetCollection,
} from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import EditActionButton from "../components/EditActionButton";
import RecycleBinButton from "../components/RecycleBinButton";
import WorksheetsBySubject from "../components/WorksheetsBySubject";
import ThinkingQuestByWeek from "../components/ThinkingQuestByWeek";
import MoveActionButton from "../components/MoveActionButton";
import OrganizeActionButton from "../components/OrganizeActionButton";
import WorksheetMoveDialog from "../components/WorksheetMoveDialog";
import AddWorksheetCollectionDialog from "../components/AddWorksheetCollectionDialog";
import CollectionMoveDialog from "../components/CollectionMoveDialog";
import TimedAckDialog from "../components/TimedAckDialog";
import StatusToast from "../components/StatusToast";
import AdminWorksheetCollectionTree from "../components/AdminWorksheetCollectionTree";
import { unassignedWorksheets, descendantSectionIds } from "../worksheetCollectionTree";
import { useAutoDismissToast } from "../useAutoDismissToast";

export default function AdminWorksheets() {
  const navigate = useNavigate();
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [worksheetSections, setWorksheetSections] = useState({ sections: [] });
  const [moveTarget, setMoveTarget] = useState(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveCollectionTarget, setMoveCollectionTarget] = useState(null);
  const [moveCollectionSaving, setMoveCollectionSaving] = useState(false);
  const [addCollection, setAddCollection] = useState(null);
  const [addCollectionSaving, setAddCollectionSaving] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [sectionDeleteAck, setSectionDeleteAck] = useState(null);

  useAutoDismissToast(statusMessage, setStatusMessage);

  function loadWorksheets({ preserveError = false } = {}) {
    setLoading(true);
    Promise.all([getWorksheets(), getAdminWorksheetSections()])
      .then(([data, sectionPayload]) => {
        if (!preserveError) setError("");
        setWorksheets(data);
        setWorksheetSections(sectionPayload);
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
    setBulkMoveOpen(false);
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
        setStatusMessage(
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

  const worksheetsNotInCollections = useMemo(
    () => unassignedWorksheets(worksheets),
    [worksheets],
  );

  const unassignedThinkingQuest = useMemo(
    () => worksheetsNotInCollections.filter((ws) => ws.gifted_track),
    [worksheetsNotInCollections],
  );

  const unassignedOther = useMemo(
    () => worksheetsNotInCollections.filter((ws) => !ws.gifted_track),
    [worksheetsNotInCollections],
  );

  const selectedCount = selectedIds.size;

  const selectionBusy = deleting || moveSaving;

  async function handleAddCollection({ title, parentId }) {
    setAddCollectionSaving(true);
    setError("");
    try {
      await createAdminWorksheetSection({ title, parentId });
      setAddCollection(null);
      loadWorksheets({ preserveError: true });
    } catch (err) {
      setError(err.message || "Could not add section.");
    } finally {
      setAddCollectionSaving(false);
    }
  }

  async function handleDeleteCollection(section) {
    const childCount = section.children?.length ?? 0;
    const subtreeIds = new Set([
      section.id,
      ...descendantSectionIds(worksheetSections.sections, section.id),
    ]);
    const worksheetCount = worksheets.filter((ws) =>
      subtreeIds.has(ws.admin_section_id),
    ).length;
    const extra =
      childCount > 0
        ? ` This also removes ${childCount} section(s).`
        : "";
    const wsNote =
      worksheetCount > 0
        ? ` ${worksheetCount} worksheet(s) in this folder will become unassigned.`
        : "";
    const ok = window.confirm(
      `Delete section “${section.title}”?${extra}${wsNote}`,
    );
    if (!ok) return;
    setError("");
    try {
      await deleteWorksheetCollection(section.id);
      setSectionDeleteAck(section.title);
      loadWorksheets({ preserveError: true });
    } catch (err) {
      setError(err.message || "Could not delete section.");
    }
  }

  async function handleOrganizeUnassigned() {
    const count = worksheetsNotInCollections.length;
    if (count === 0) return;
    const ok = window.confirm(
      `Create sub-sections under Practice, Timed, and other top-level folders from ${count} unassigned worksheet(s)?\n\n` +
        "Worksheets are grouped by type and subject (Thinking Quest by week). You can move folders or worksheets afterward.",
    );
    if (!ok) return;
    setOrganizing(true);
    setError("");
    try {
      const result = await organizeUnassignedWorksheets();
      setStatusMessage(
        `Organized ${result.assigned_count} worksheet(s) into ${result.sections_created} new sub-section(s).`,
      );
      loadWorksheets({ preserveError: true });
    } catch (err) {
      setError(err.message || "Could not organize worksheets.");
    } finally {
      setOrganizing(false);
    }
  }

  async function handleMoveCollectionConfirm(payload) {
    if (!moveCollectionTarget) return;
    setMoveCollectionSaving(true);
    setError("");
    try {
      await moveWorksheetCollection(
        moveCollectionTarget.id,
        payload.parentId ?? null,
      );
      setStatusMessage(`Moved section “${moveCollectionTarget.title}”.`);
      setMoveCollectionTarget(null);
      loadWorksheets({ preserveError: true });
    } catch (err) {
      setError(err.message || "Could not move section.");
    } finally {
      setMoveCollectionSaving(false);
    }
  }

  async function handleMoveConfirm(payload) {
    const ids = bulkMoveOpen
      ? [...selectedIds]
      : moveTarget
        ? [moveTarget.id]
        : [];
    if (ids.length === 0) return;

    setMoveSaving(true);
    setError("");
    const moved = [];
    const failed = [];

    try {
      for (const id of ids) {
        try {
          await assignWorksheetSection(id, payload);
          moved.push(id);
        } catch {
          const ws = worksheets.find((w) => w.id === id);
          failed.push(ws?.title || id);
        }
      }

      if (moved.length > 0) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of moved) next.delete(id);
          return next;
        });
        if (ids.length === 1) {
          const ws = worksheets.find((w) => w.id === ids[0]);
          setStatusMessage(`Moved “${ws?.title ?? "worksheet"}”.`);
        } else {
          setStatusMessage(`Moved ${moved.length} worksheets.`);
        }
        setMoveTarget(null);
        setBulkMoveOpen(false);
        loadWorksheets({ preserveError: true });
      }

      if (failed.length > 0) {
        setError(`Could not move: ${failed.join(", ")}.`);
      }
    } finally {
      setMoveSaving(false);
    }
  }

  function openSingleMove(ws) {
    setBulkMoveOpen(false);
    setMoveTarget(ws);
  }

  function openBulkMove() {
    setMoveTarget(null);
    setBulkMoveOpen(true);
  }

  function closeMoveDialog() {
    if (moveSaving) return;
    setMoveTarget(null);
    setBulkMoveOpen(false);
  }

  function renderWorksheetLeadingAction(ws) {
    return (
      <label
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition"
        title={`Select ${ws.title}`}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(ws.id)}
          onChange={() => toggleSelected(ws.id)}
          disabled={selectionBusy}
          aria-label={`Select ${ws.title}`}
          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      </label>
    );
  }

  function renderWorksheetSideAction(ws) {
    return (
      <>
        <MoveActionButton
          label={`Move ${ws.title}`}
          disabled={selectionBusy}
          onClick={() => openSingleMove(ws)}
        />
        <EditActionButton
          to={
            ws.is_test
              ? `/admin/create/test?edit=${encodeURIComponent(ws.id)}`
              : `/admin/create/worksheet?edit=${encodeURIComponent(ws.id)}`
          }
          label={`Edit ${ws.title}`}
          disabled={selectionBusy}
        />
        <RecycleBinButton
          onClick={() => handleDelete(ws)}
          label={`Delete ${ws.title}`}
          disabled={selectionBusy}
        />
      </>
    );
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-4">Worksheets</h1>

        {!loading && !error ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setAddCollection({ variant: "root" })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 transition"
            >
              <span className="text-base leading-none" aria-hidden>
                +
              </span>
              Add section
            </button>
          </div>
        ) : null}

        {loading && <QuillLoading label="Loading worksheets…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && worksheets.length === 0 && !worksheetSections.sections?.length && (
          <p className="text-slate-600">No worksheets.</p>
        )}

        {!loading && !error && (worksheets.length > 0 || worksheetSections.sections?.length > 0) && (
          <>
            {selectedCount > 0 ? (
              <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-md">
                <span className="text-sm font-semibold text-slate-800 tabular-nums">
                  {selectedCount} selected
                </span>
                <MoveActionButton
                  label={
                    moveSaving
                      ? "Moving selected worksheets…"
                      : "Move selected worksheets"
                  }
                  disabled={selectionBusy}
                  onClick={openBulkMove}
                />
                <RecycleBinButton
                  label={deleting ? "Deleting selected worksheets…" : "Delete selected worksheets"}
                  disabled={selectionBusy}
                  onClick={handleDeleteSelected}
                />
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectionBusy}
                  title="Clear selection"
                  aria-label="Clear selection"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border w-7 h-7 bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[14px] h-[14px]"
                    aria-hidden
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            ) : null}

            <AdminWorksheetCollectionTree
              sections={worksheetSections.sections}
              worksheets={worksheets}
              onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
              onOpenTest={(id) => navigate(`/student/tests/${id}`)}
              renderSideAction={renderWorksheetSideAction}
              renderLeadingAction={renderWorksheetLeadingAction}
              onAddSubCollection={(parentId) =>
                setAddCollection({ variant: "nested", fixedParentId: parentId })
              }
              onMoveCollection={(section) => setMoveCollectionTarget(section)}
              onDeleteCollection={handleDeleteCollection}
            />

            {worksheetsNotInCollections.length > 0 ? (
              <div className="mt-2">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Unassigned
                  </h2>
                  <OrganizeActionButton
                    label={
                      organizing
                        ? "Organizing worksheets…"
                        : "Organize unassigned worksheets into sections"
                    }
                    disabled={organizing || selectionBusy}
                    onClick={handleOrganizeUnassigned}
                  />
                </div>
                {unassignedThinkingQuest.length > 0 ? (
                  <div className="mb-4 rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden p-3 bg-slate-50/40">
                    <ThinkingQuestByWeek
                      worksheets={unassignedThinkingQuest}
                      onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
                      renderSideAction={renderWorksheetSideAction}
              renderLeadingAction={renderWorksheetLeadingAction}
                    />
                  </div>
                ) : null}
                {unassignedOther.length > 0 ? (
                  <WorksheetsBySubject
                    worksheets={unassignedOther}
                    onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
                    onOpenTest={(id) => navigate(`/student/tests/${id}`)}
                    renderSideAction={renderWorksheetSideAction}
              renderLeadingAction={renderWorksheetLeadingAction}
                    ungrouped
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <StatusToast message={statusMessage} />

      <CollectionMoveDialog
        open={Boolean(moveCollectionTarget)}
        collection={moveCollectionTarget}
        sections={worksheetSections.sections}
        saving={moveCollectionSaving}
        onCancel={() => {
          if (!moveCollectionSaving) setMoveCollectionTarget(null);
        }}
        onConfirm={handleMoveCollectionConfirm}
      />

      <AddWorksheetCollectionDialog
        open={Boolean(addCollection)}
        sections={worksheetSections.sections}
        variant={addCollection?.variant ?? "root"}
        fixedParentId={addCollection?.fixedParentId ?? null}
        saving={addCollectionSaving}
        onCancel={() => {
          if (!addCollectionSaving) setAddCollection(null);
        }}
        onConfirm={handleAddCollection}
      />

      <WorksheetMoveDialog
        open={Boolean(moveTarget) || bulkMoveOpen}
        worksheet={moveTarget}
        bulkCount={bulkMoveOpen ? selectedCount : 0}
        sections={worksheetSections.sections}
        saving={moveSaving}
        onCancel={closeMoveDialog}
        onConfirm={handleMoveConfirm}
      />

      <TimedAckDialog
        open={Boolean(sectionDeleteAck)}
        message={
          sectionDeleteAck
            ? `Section “${sectionDeleteAck}” was deleted.`
            : ""
        }
        onClose={() => setSectionDeleteAck(null)}
      />
    </AppShell>
  );
}
