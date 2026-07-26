import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  deleteWorksheet,
  getWorksheet,
  getWorksheets,
  logout,
  getAdminWorksheetSections,
  createAdminWorksheetSection,
  assignWorksheetSection,
  moveWorksheetCollection,
  organizeUnassignedWorksheets,
  deleteWorksheetCollection,
  restoreWorksheet,
  restoreWorksheetSections,
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
import { useAutoDismissToast, TOAST_AUTO_DISMISS_MS } from "../useAutoDismissToast";
import { WS_EYEBROW, WS_PAGE_HEADING, WS_BODY, WS_CARD_TITLE } from "../worksheetAdminTypography";

const TOAST_UNDO_MS = 8000;

function collectSectionDeleteSnapshot(rootIds, sections, worksheets) {
  const idSet = new Set();
  for (const id of rootIds) {
    idSet.add(id);
    for (const descId of descendantSectionIds(sections, id)) {
      idSet.add(descId);
    }
  }
  const sectionRows = sections.filter((s) => idSet.has(s.id));
  const assignments = worksheets
    .filter((ws) => ws.admin_section_id && idSet.has(ws.admin_section_id))
    .map((ws) => ({
      worksheet_id: ws.id,
      section_id: ws.admin_section_id,
    }));
  return { sections: sectionRows, assignments };
}

function sectionIdsRemovedByDelete(rootIds, sections) {
  const removeIds = new Set();
  for (const id of rootIds) {
    removeIds.add(id);
    for (const descId of descendantSectionIds(sections, id)) {
      removeIds.add(descId);
    }
  }
  return removeIds;
}

function localStateAfterSectionDeletes(rootIds, sections, worksheets) {
  const removeIds = sectionIdsRemovedByDelete(rootIds, sections);
  return {
    sections: sections.filter((s) => !removeIds.has(s.id)),
    worksheets: worksheets.map((ws) =>
      ws.admin_section_id && removeIds.has(ws.admin_section_id)
        ? { ...ws, admin_section_id: null }
        : ws,
    ),
  };
}

async function snapshotWorksheetsForRestore(ids, worksheets) {
  const snapshots = [];
  for (const id of ids) {
    const row = worksheets.find((w) => w.id === id);
    const data = await getWorksheet(id);
    const { unlock_schedule: _unlockSchedule, ...worksheetData } = data;
    snapshots.push({
      id,
      data: worksheetData,
      sortTs: row?.sort_ts ?? null,
      sectionId: row?.admin_section_id ?? null,
    });
  }
  return snapshots;
}

export default function AdminWorksheets() {
  const navigate = useNavigate();
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedSectionIds, setSelectedSectionIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingSections, setDeletingSections] = useState(false);
  const [worksheetSections, setWorksheetSections] = useState({ sections: [] });
  const [moveTarget, setMoveTarget] = useState(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveCollectionTarget, setMoveCollectionTarget] = useState(null);
  const [bulkSectionMoveOpen, setBulkSectionMoveOpen] = useState(false);
  const [moveCollectionSaving, setMoveCollectionSaving] = useState(false);
  const [addCollection, setAddCollection] = useState(null);
  const [addCollectionSaving, setAddCollectionSaving] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [sectionDeleteAck, setSectionDeleteAck] = useState(null);

  useAutoDismissToast(
    toast?.message ?? "",
    () => setToast(null),
    toast?.onUndo ? TOAST_UNDO_MS : TOAST_AUTO_DISMISS_MS,
  );

  function showToast(message, { onUndo = null } = {}) {
    setToast(onUndo ? { message, onUndo } : { message });
  }

  async function runToastUndo() {
    if (!toast?.onUndo || undoing) return;
    setUndoing(true);
    setError("");
    try {
      await toast.onUndo();
      setToast(null);
      await refreshWorksheetsQuietly();
      showToast("Restored.");
    } catch (err) {
      setError(err.message || "Could not undo.");
    } finally {
      setUndoing(false);
    }
  }

  async function runSectionDeleteUndo() {
    if (!sectionDeleteAck?.onUndo || undoing) return;
    setUndoing(true);
    setError("");
    try {
      await sectionDeleteAck.onUndo();
      setSectionDeleteAck(null);
      await refreshWorksheetsQuietly();
      showToast("Section restored.");
    } catch (err) {
      setError(err.message || "Could not undo.");
    } finally {
      setUndoing(false);
    }
  }

  function refreshWorksheetsQuietly() {
    return Promise.all([getWorksheets(), getAdminWorksheetSections()])
      .then(([data, sectionPayload]) => {
        setWorksheets(data);
        setWorksheetSections(sectionPayload);
      })
      .catch(() => {
        setError("Could not refresh worksheets.");
        throw new Error("Could not refresh worksheets.");
      });
  }

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

  function toggleSectionSelected(id) {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedSectionIds(new Set());
    setBulkMoveOpen(false);
    setBulkSectionMoveOpen(false);
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
    let restoreSnapshots = [];

    try {
      try {
        restoreSnapshots = await snapshotWorksheetsForRestore(list, worksheets);
      } catch {
        restoreSnapshots = [];
      }

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
        const undoSnapshots = restoreSnapshots.filter((s) =>
          removed.includes(s.id),
        );
        const previewTitle =
          removed.length === 1
            ? worksheets.find((w) => w.id === removed[0])?.title || removed[0]
            : null;
        showToast(
          removed.length === 1
            ? `Deleted “${previewTitle}”.`
            : `Deleted ${removed.length} worksheets.`,
          {
            onUndo:
              undoSnapshots.length > 0
                ? async () => {
                    for (const snap of undoSnapshots) {
                      await restoreWorksheet(snap.id, {
                        data: snap.data,
                        sortTs: snap.sortTs,
                        sectionId: snap.sectionId,
                      });
                    }
                  }
                : null,
          },
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
  const selectedSectionCount = selectedSectionIds.size;
  const anySelected = selectedCount > 0 || selectedSectionCount > 0;

  const bulkSectionBlockedIds = useMemo(() => {
    const blocked = new Set();
    for (const id of selectedSectionIds) {
      blocked.add(id);
      for (const descId of descendantSectionIds(
        worksheetSections.sections,
        id,
      )) {
        blocked.add(descId);
      }
    }
    return blocked;
  }, [selectedSectionIds, worksheetSections.sections]);

  const selectionBusy =
    deleting || deletingSections || moveSaving || moveCollectionSaving;

  async function handleAddCollection({ title, parentId }) {
    setAddCollectionSaving(true);
    setError("");
    try {
      const created = await createAdminWorksheetSection({ title, parentId });
      const parent_id = created.parent_id ?? parentId ?? null;
      const sectionRow = {
        ...created,
        parent_id,
        is_top_level: parent_id == null || String(parent_id).trim() === "",
      };
      setWorksheetSections((prev) => ({
        ...prev,
        sections: [...prev.sections, sectionRow],
      }));
      setAddCollection(null);
      showToast(`Added section “${title}”.`);
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
    const sectionSnapshot = collectSectionDeleteSnapshot(
      [section.id],
      worksheetSections.sections,
      worksheets,
    );
    try {
      await deleteWorksheetCollection(section.id);
      const next = localStateAfterSectionDeletes(
        [section.id],
        worksheetSections.sections,
        worksheets,
      );
      setWorksheetSections({ sections: next.sections });
      setWorksheets(next.worksheets);
      setSectionDeleteAck({
        title: section.title,
        onUndo: async () => {
          await restoreWorksheetSections(sectionSnapshot);
        },
      });
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
      showToast(
        `Organized ${result.assigned_count} worksheet(s) into ${result.sections_created} new sub-section(s).`,
      );
      loadWorksheets({ preserveError: true });
    } catch (err) {
      setError(err.message || "Could not organize worksheets.");
    } finally {
      setOrganizing(false);
    }
  }

  async function handleDeleteSelectedSections() {
    const list = [...selectedSectionIds];
    if (list.length === 0) return;

    const ok = window.confirm(
      list.length === 1
        ? "Delete the selected section? Worksheets inside will become unassigned."
        : `Delete ${list.length} selected sections? Worksheets inside will become unassigned.`,
    );
    if (!ok) return;

    const sectionSnapshot = collectSectionDeleteSnapshot(
      list,
      worksheetSections.sections,
      worksheets,
    );

    setDeletingSections(true);
    setError("");
    const removed = [];
    const failed = [];

    try {
      for (const id of list) {
        try {
          await deleteWorksheetCollection(id);
          removed.push(id);
        } catch {
          const row = worksheetSections.sections.find((s) => s.id === id);
          failed.push(row?.title || id);
        }
      }

      if (removed.length > 0) {
        const next = localStateAfterSectionDeletes(
          removed,
          worksheetSections.sections,
          worksheets,
        );
        setWorksheetSections({ sections: next.sections });
        setWorksheets(next.worksheets);
        setSelectedSectionIds((prev) => {
          const nextSel = new Set(prev);
          for (const id of removed) nextSel.delete(id);
          return nextSel;
        });
        showToast(
          removed.length === 1
            ? "Deleted 1 section."
            : `Deleted ${removed.length} sections.`,
          {
            onUndo: async () => {
              await restoreWorksheetSections(sectionSnapshot);
            },
          },
        );
      }

      if (failed.length > 0) {
        setError(`Could not delete sections: ${failed.join(", ")}.`);
      }
    } finally {
      setDeletingSections(false);
    }
  }

  async function handleMoveCollectionConfirm(payload) {
    const ids = bulkSectionMoveOpen
      ? [...selectedSectionIds]
      : moveCollectionTarget
        ? [moveCollectionTarget.id]
        : [];
    if (ids.length === 0) return;

    const parentId = payload.parentId ?? null;

    setMoveCollectionSaving(true);
    setError("");
    const moved = [];
    const failed = [];

    try {
      for (const id of ids) {
        try {
          await moveWorksheetCollection(id, parentId);
          moved.push(id);
        } catch {
          const row = worksheetSections.sections.find((s) => s.id === id);
          failed.push(row?.title || id);
        }
      }

      if (moved.length > 0) {
        const movedSet = new Set(moved);
        setSelectedSectionIds((prev) => {
          const next = new Set(prev);
          for (const id of moved) next.delete(id);
          return next;
        });
        setWorksheetSections((prev) => ({
          sections: prev.sections.map((s) =>
            movedSet.has(s.id) ? { ...s, parent_id: parentId } : s,
          ),
        }));
        if (parentId === null) {
          setWorksheets((prev) =>
            prev.map((ws) =>
              ws.admin_section_id && movedSet.has(ws.admin_section_id)
                ? { ...ws, admin_section_id: null }
                : ws,
            ),
          );
        }
        if (ids.length === 1) {
          const row = worksheetSections.sections.find((s) => s.id === ids[0]);
          showToast(`Moved section “${row?.title ?? "section"}”.`);
        } else {
          showToast(`Moved ${moved.length} sections.`);
        }
        setMoveCollectionTarget(null);
        setBulkSectionMoveOpen(false);
      }

      if (failed.length > 0) {
        setError(`Could not move sections: ${failed.join(", ")}.`);
      }
    } finally {
      setMoveCollectionSaving(false);
    }
  }

  function openMoveCollection(section) {
    setBulkSectionMoveOpen(false);
    setMoveCollectionTarget(section);
  }

  function openBulkSectionMove() {
    setMoveCollectionTarget(null);
    setBulkSectionMoveOpen(true);
  }

  function closeSectionMoveDialog() {
    if (moveCollectionSaving) return;
    setMoveCollectionTarget(null);
    setBulkSectionMoveOpen(false);
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
          const result = await assignWorksheetSection(id, payload);
          moved.push({
            id,
            sectionId: result.admin_section_id ?? null,
          });
        } catch {
          const ws = worksheets.find((w) => w.id === id);
          failed.push(ws?.title || id);
        }
      }

      if (moved.length > 0) {
        const byId = new Map(moved.map((row) => [row.id, row.sectionId]));
        setWorksheets((prev) =>
          prev.map((ws) =>
            byId.has(ws.id)
              ? { ...ws, admin_section_id: byId.get(ws.id) }
              : ws,
          ),
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const { id } of moved) next.delete(id);
          return next;
        });
        if (ids.length === 1) {
          const ws = worksheets.find((w) => w.id === ids[0]);
          showToast(`Moved “${ws?.title ?? "worksheet"}”.`);
        } else {
          showToast(`Moved ${moved.length} worksheets.`);
        }
        setMoveTarget(null);
        setBulkMoveOpen(false);
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
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer hover:bg-slate-100/80 transition shrink-0"
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
        <h1 className={`${WS_PAGE_HEADING} mb-4`}>Worksheets</h1>

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
          <p className={WS_BODY}>No worksheets.</p>
        )}

        {!loading && !error && (worksheets.length > 0 || worksheetSections.sections?.length > 0) && (
          <>
            {anySelected ? (
              <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-md">
                <span className={`${WS_CARD_TITLE} text-slate-800 tabular-nums`}>
                  {selectedCount > 0 && selectedSectionCount > 0
                    ? `${selectedCount} worksheet${selectedCount === 1 ? "" : "s"}, ${selectedSectionCount} section${selectedSectionCount === 1 ? "" : "s"}`
                    : selectedCount > 0
                      ? `${selectedCount} worksheet${selectedCount === 1 ? "" : "s"}`
                      : `${selectedSectionCount} section${selectedSectionCount === 1 ? "" : "s"}`}
                </span>
                {selectedCount > 0 ? (
                  <>
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
                      label={
                        deleting
                          ? "Deleting selected worksheets…"
                          : "Delete selected worksheets"
                      }
                      disabled={selectionBusy}
                      onClick={handleDeleteSelected}
                    />
                  </>
                ) : null}
                {selectedSectionCount > 0 ? (
                  <>
                    <MoveActionButton
                      label={
                        moveCollectionSaving
                          ? "Moving selected sections…"
                          : "Move selected sections"
                      }
                      disabled={selectionBusy}
                      onClick={openBulkSectionMove}
                    />
                    <RecycleBinButton
                      label={
                        deletingSections
                          ? "Deleting selected sections…"
                          : "Delete selected sections"
                      }
                      disabled={selectionBusy}
                      onClick={handleDeleteSelectedSections}
                    />
                  </>
                ) : null}
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
              onMoveCollection={openMoveCollection}
              onDeleteCollection={handleDeleteCollection}
              selectedSectionIds={selectedSectionIds}
              onToggleSectionSelected={toggleSectionSelected}
              sectionSelectionDisabled={selectionBusy}
            />

            {worksheetsNotInCollections.length > 0 ? (
              <div className="mt-2">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h2 className={WS_EYEBROW}>Unassigned</h2>
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
                  <div className="mb-4 rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden py-2 sm:py-2.5 bg-slate-50/40">
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

      <StatusToast
        message={toast?.message}
        onUndo={toast?.onUndo ? runToastUndo : null}
        undoDisabled={undoing}
      />

      <CollectionMoveDialog
        open={Boolean(moveCollectionTarget) || bulkSectionMoveOpen}
        collection={moveCollectionTarget}
        bulkCount={bulkSectionMoveOpen ? selectedSectionCount : 0}
        sections={worksheetSections.sections}
        blockedIds={bulkSectionMoveOpen ? bulkSectionBlockedIds : null}
        saving={moveCollectionSaving}
        onCancel={closeSectionMoveDialog}
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
            ? `Section “${sectionDeleteAck.title}” was deleted.`
            : ""
        }
        onClose={() => setSectionDeleteAck(null)}
        onUndo={sectionDeleteAck?.onUndo ? runSectionDeleteUndo : null}
        undoDisabled={undoing}
      />
    </AppShell>
  );
}
