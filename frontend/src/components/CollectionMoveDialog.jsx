import { useEffect, useId, useMemo, useState } from "react";
import { createAdminWorksheetSection } from "../api";
import DriveStyleMoveBrowser, {
  browseIdToSectionParentId,
  sectionMoveHereAllowed,
} from "./DriveStyleMoveBrowser";
import { descendantSectionIds, isRootSection } from "../worksheetCollectionTree";

export default function CollectionMoveDialog({
  open,
  collection,
  bulkCount = 0,
  sections,
  onCancel,
  onConfirm,
  saving = false,
  blockedIds: blockedIdsProp = null,
}) {
  const titleId = useId();
  const [browseId, setBrowseId] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [mergedSections, setMergedSections] = useState([]);

  const isBulk = bulkCount > 0;

  const blockedIds = useMemo(() => {
    if (blockedIdsProp) return blockedIdsProp;
    if (!collection?.id) return new Set();
    const desc = descendantSectionIds(sections, collection.id);
    desc.add(collection.id);
    return desc;
  }, [sections, collection?.id, blockedIdsProp]);

  useEffect(() => {
    if (!open) return;
    if (!collection && !isBulk) return;
    setMergedSections([]);
    if (isBulk) {
      setBrowseId(null);
    } else if (!isRootSection(collection) && collection.parent_id) {
      setBrowseId(collection.parent_id);
    } else {
      setBrowseId(null);
    }
  }, [open, collection, isBulk]);

  if (!open || (!collection && !isBulk)) return null;

  const moveHereOk = sectionMoveHereAllowed(browseId, blockedIds);
  const movingToTopLevel = browseId == null;
  const willHoldWorksheets = !movingToTopLevel;

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
    if (isBulk && browseId == null) return;
    await onConfirm({ parentId: browseIdToSectionParentId(browseId) });
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close move section dialog"
        onClick={saving ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-slate-200 bg-white px-6 py-[22px] shadow-lg max-h-[min(90vh,34rem)] overflow-y-auto"
      >
        <h2 id={titleId} className="font-semibold text-[15px] text-slate-950 m-0 mb-1">
          {isBulk ? (
            <>Move {bulkCount} sections</>
          ) : (
            <>Move &ldquo;{collection.title}&rdquo;</>
          )}
        </h2>
        <p className="text-[13px] text-slate-600 m-0 mb-4 leading-relaxed">
          {isBulk ? (
            <>
              Choose a new parent for all selected sections. Open a folder, then
              choose <span className="font-medium">Move here</span>.
            </>
          ) : (
            <>
              Open a folder, then choose <span className="font-medium">Move here</span>.
              Use <span className="font-medium">New folder</span> to add one in the
              current location.
            </>
          )}
        </p>

        <DriveStyleMoveBrowser
          sections={sections}
          browseId={browseId}
          onBrowseIdChange={setBrowseId}
          blockedIds={blockedIds}
          rootLabel="Top level"
          disabled={saving}
          onCreateFolder={handleCreateFolder}
          creatingFolder={creatingFolder}
          onLocalSectionsChange={setMergedSections}
        />

        {isBulk ? (
          movingToTopLevel ? (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0 mt-3">
              Moving to top level is only for top-level sections. Pick a folder
              under Practice, Timed, or another root.
            </p>
          ) : null
        ) : willHoldWorksheets ? (
          <p className="text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 m-0 mt-3">
            After this move, &ldquo;{collection.title}&rdquo; can contain worksheets.
          </p>
        ) : (
          <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0 mt-3">
            At top level, sections hold folders only. Worksheets in &ldquo;
            {collection.title}&rdquo; will become unassigned.
          </p>
        )}

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
            disabled={saving || !moveHereOk || (isBulk && browseId == null)}
            className="rounded-xl border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? "Moving…" : "Move here"}
          </button>
        </div>
      </div>
    </>
  );
}
