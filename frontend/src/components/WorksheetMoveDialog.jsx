import { useEffect, useId, useState } from "react";
import { createAdminWorksheetSection } from "../api";
import DriveStyleMoveBrowser, {
  MOVE_BROWSE_UNASSIGNED,
  browseIdToWorksheetSectionId,
  worksheetMoveHereAllowed,
} from "./DriveStyleMoveBrowser";

export default function WorksheetMoveDialog({
  open,
  worksheet,
  sections,
  onCancel,
  onConfirm,
  saving = false,
}) {
  const titleId = useId();
  const [browseId, setBrowseId] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [mergedSections, setMergedSections] = useState([]);

  const currentSectionId = worksheet?.admin_section_id || null;

  useEffect(() => {
    if (!open) return;
    setMergedSections([]);
    if (currentSectionId) {
      setBrowseId(currentSectionId);
    } else {
      setBrowseId(MOVE_BROWSE_UNASSIGNED);
    }
  }, [open, worksheet?.id, currentSectionId]);

  if (!open || !worksheet) return null;

  const moveHereOk = worksheetMoveHereAllowed(browseId, [
    ...(sections || []),
    ...mergedSections,
  ]);

  async function handleCreateFolder(title, parentId) {
    setCreatingFolder(true);
    try {
      return await createAdminWorksheetSection({ title, parentId });
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleMoveHere() {
    if (!moveHereOk || saving) return;
    await onConfirm({
      sectionId: browseIdToWorksheetSectionId(browseId),
    });
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close move worksheet dialog"
        onClick={saving ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-slate-200 bg-white px-6 py-[22px] shadow-lg max-h-[min(90vh,34rem)] overflow-y-auto"
      >
        <h2 id={titleId} className="font-semibold text-[15px] text-slate-950 m-0 mb-1">
          Move &ldquo;{worksheet.title}&rdquo;
        </h2>
        <p className="text-[13px] text-slate-600 m-0 mb-4 leading-relaxed">
          Open a folder, then choose <span className="font-medium">Move here</span>.
          You can create a new folder in the location you are viewing.
        </p>

        <DriveStyleMoveBrowser
          sections={sections}
          browseId={browseId}
          onBrowseIdChange={setBrowseId}
          showUnassigned
          rootLabel="All sections"
          disabled={saving}
          onCreateFolder={handleCreateFolder}
          creatingFolder={creatingFolder}
          onLocalSectionsChange={setMergedSections}
        />

        <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMoveHere}
            disabled={saving || !moveHereOk}
            className="rounded-xl border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? "Moving…" : "Move here"}
          </button>
        </div>
      </div>
    </>
  );
}
