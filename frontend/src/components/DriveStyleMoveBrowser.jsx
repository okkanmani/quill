import { useEffect, useMemo, useState } from "react";
import { isRootSection } from "../worksheetCollectionTree";

export const MOVE_BROWSE_UNASSIGNED = "__move_unassigned__";

function FolderIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-amber-500 ${className}`}
      aria-hidden
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function byIdMap(sections) {
  return new Map((sections || []).map((row) => [row.id, row]));
}

function sortSections(list) {
  return [...list].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (a.title || "").localeCompare(b.title || ""),
  );
}

function breadcrumbTrail(sections, browseId, rootLabel) {
  if (browseId === MOVE_BROWSE_UNASSIGNED) {
    return [
      { id: null, title: rootLabel },
      { id: MOVE_BROWSE_UNASSIGNED, title: "Unassigned" },
    ];
  }
  if (browseId == null) {
    return [{ id: null, title: rootLabel }];
  }
  const byId = byIdMap(sections);
  const path = [];
  let current = byId.get(browseId);
  const guard = new Set();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    path.unshift({ id: current.id, title: current.title });
    const pid = current.parent_id;
    current = pid ? byId.get(pid) : null;
  }
  return [{ id: null, title: rootLabel }, ...path];
}

/**
 * Google Drive–style move destination: breadcrumbs, folder list, new folder.
 */
export default function DriveStyleMoveBrowser({
  sections: sectionsProp,
  browseId,
  onBrowseIdChange,
  blockedIds = null,
  showUnassigned = false,
  rootLabel = "All sections",
  disabled = false,
  onCreateFolder,
  creatingFolder = false,
  onLocalSectionsChange,
}) {
  const blocked = useMemo(
    () => (blockedIds ? new Set(blockedIds) : new Set()),
    [blockedIds],
  );

  const [localSections, setLocalSections] = useState([]);

  const sections = useMemo(
    () => [...(sectionsProp || []), ...localSections],
    [sectionsProp, localSections],
  );

  useEffect(() => {
    onLocalSectionsChange?.(localSections);
  }, [localSections, onLocalSectionsChange]);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (sectionsProp) {
      setLocalSections((prev) =>
        prev.filter((local) => !sectionsProp.some((s) => s.id === local.id)),
      );
    }
  }, [sectionsProp]);

  const crumbs = useMemo(
    () => breadcrumbTrail(sections, browseId, rootLabel),
    [sections, browseId, rootLabel],
  );

  const folderRows = useMemo(() => {
    if (browseId === MOVE_BROWSE_UNASSIGNED) return [];
    if (browseId == null) {
      return sortSections(
        sections.filter((s) => isRootSection(s) && !blocked.has(s.id)),
      );
    }
    return sortSections(
      sections.filter(
        (s) => s.parent_id === browseId && !blocked.has(s.id),
      ),
    );
  }, [sections, browseId, blocked]);

  const currentFolderTitle = useMemo(() => {
    if (browseId === MOVE_BROWSE_UNASSIGNED) return "Unassigned";
    if (browseId == null) return rootLabel;
    const row = sections.find((s) => s.id === browseId);
    return row?.title || rootLabel;
  }, [browseId, sections, rootLabel]);

  async function handleCreateFolder(event) {
    event.preventDefault();
    const title = newFolderName.trim();
    if (!title || !onCreateFolder) return;
    setCreateError("");
    try {
      const parentId =
        browseId === MOVE_BROWSE_UNASSIGNED ? null : browseId;
      const created = await onCreateFolder(title, parentId);
      if (created?.id) {
        setLocalSections((prev) => [...prev, created]);
        onBrowseIdChange(created.id);
        setShowNewFolder(false);
        setNewFolderName("");
      }
    } catch (err) {
      setCreateError(err.message || "Could not create folder.");
    }
  }

  function enterFolder(id) {
    if (blocked.has(id)) return;
    onBrowseIdChange(id);
    setShowNewFolder(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Current location"
        className="flex flex-wrap items-center gap-1 text-[13px] text-slate-600 min-h-[1.25rem]"
      >
        {crumbs.map((crumb, index) => (
          <span key={String(crumb.id)} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <span className="text-slate-400 select-none" aria-hidden>
                ›
              </span>
            ) : null}
            <button
              type="button"
              disabled={disabled || index === crumbs.length - 1}
              onClick={() => onBrowseIdChange(crumb.id)}
              className={`font-medium truncate max-w-[10rem] sm:max-w-[12rem] ${
                index === crumbs.length - 1
                  ? "text-slate-950 cursor-default"
                  : "text-indigo-700 hover:text-indigo-900 hover:underline"
              } disabled:opacity-100`}
            >
              {crumb.title}
            </button>
          </span>
        ))}
      </nav>

      {showUnassigned && browseId !== MOVE_BROWSE_UNASSIGNED ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onBrowseIdChange(MOVE_BROWSE_UNASSIGNED)}
          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 transition text-[13px] text-slate-800"
        >
          <FolderIcon className="w-5 h-5 text-slate-400" />
          <span>Unassigned</span>
        </button>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/90 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-white">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Folders
          </span>
          {onCreateFolder && browseId !== MOVE_BROWSE_UNASSIGNED ? (
            <button
              type="button"
              disabled={disabled || creatingFolder}
              onClick={() => {
                setShowNewFolder((v) => !v);
                setCreateError("");
              }}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
            >
              {showNewFolder ? "Cancel" : "New folder"}
            </button>
          ) : null}
        </div>

        {showNewFolder ? (
          <form
            onSubmit={handleCreateFolder}
            className="flex gap-2 px-3 py-2.5 border-b border-slate-200 bg-white"
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              disabled={disabled || creatingFolder}
              placeholder="Folder name"
              className="flex-1 min-w-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoFocus
            />
            <button
              type="submit"
              disabled={disabled || creatingFolder || !newFolderName.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creatingFolder ? "…" : "Create"}
            </button>
          </form>
        ) : null}
        {createError ? (
          <p className="text-red-600 text-xs px-3 py-2 m-0 bg-white border-b border-slate-200">
            {createError}
          </p>
        ) : null}

        <ul
          className="max-h-52 overflow-y-auto m-0 p-1.5 list-none flex flex-col gap-0.5"
          aria-label="Folders in this location"
        >
          {folderRows.length === 0 ? (
            <li className="text-[13px] text-slate-500 text-center py-6 px-2">
              {browseId === MOVE_BROWSE_UNASSIGNED
                ? "Not in any folder."
                : "No folders here. Use New folder or open another location."}
            </li>
          ) : (
            folderRows.map((folder) => (
              <li key={folder.id}>
                <div className="flex items-stretch gap-0.5 rounded-lg hover:bg-white">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => enterFolder(folder.id)}
                    className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-2.5 text-left text-[13px] text-slate-800"
                  >
                    <FolderIcon />
                    <span className="font-medium truncate">{folder.title}</span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Open ${folder.title}`}
                    onClick={() => enterFolder(folder.id)}
                    className="shrink-0 w-10 flex items-center justify-center text-slate-500 hover:bg-slate-200/80 rounded-lg text-lg leading-none"
                  >
                    ›
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="text-[12px] text-slate-600 m-0">
        Location:{" "}
        <span className="font-semibold text-slate-800">{currentFolderTitle}</span>
      </p>
    </div>
  );
}

export function worksheetMoveHereAllowed(browseId, sections) {
  if (browseId === MOVE_BROWSE_UNASSIGNED) return true;
  if (browseId == null) return false;
  const row = sections.find((s) => s.id === browseId);
  if (!row) return false;
  return !isRootSection(row);
}

export function sectionMoveHereAllowed(browseId, blockedIds) {
  if (browseId === MOVE_BROWSE_UNASSIGNED) return false;
  const blocked = blockedIds ? new Set(blockedIds) : new Set();
  if (browseId != null && blocked.has(browseId)) return false;
  return true;
}

export function browseIdToWorksheetSectionId(browseId) {
  if (browseId === MOVE_BROWSE_UNASSIGNED) return null;
  return browseId;
}

export function browseIdToSectionParentId(browseId) {
  if (browseId === MOVE_BROWSE_UNASSIGNED) return null;
  return browseId;
}
