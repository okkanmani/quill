import { useEffect, useId, useState } from "react";
import WorksheetCollectionParentPicker from "./WorksheetCollectionParentPicker";

/**
 * @param {'root' | 'nested'} variant
 * @param {string | null} fixedParentId — when set (nested from tree), parent is fixed
 */
export default function AddWorksheetCollectionDialog({
  open,
  sections,
  variant = "root",
  fixedParentId = null,
  onCancel,
  onConfirm,
  saving = false,
}) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState(null);

  const isRoot = variant === "root";
  const isNested = !isRoot;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setParentId(fixedParentId ?? null);
  }, [open, fixedParentId, variant]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    if (isNested && !fixedParentId && !parentId) return;
    await onConfirm({
      title: trimmed,
      parentId: isRoot ? null : fixedParentId ?? parentId,
    });
  }

  const heading = isRoot ? "Add top-level section" : "Add sub-section";
  const blurb = isRoot
    ? "Examples: Practice, Timed, Contest prep. Worksheets never go here—only folders like Math or English underneath."
    : fixedParentId
      ? "Nested folders can hold worksheets and more folders (e.g. Calculus inside Math)."
      : "Pick a parent (e.g. Practice for Math, or Math for Calculus). Worksheets can live in any folder below the top level.";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close add section dialog"
        onClick={saving ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-slate-200 bg-white px-6 py-[22px] shadow-lg max-h-[min(90vh,32rem)] overflow-y-auto"
      >
        <h2 id={titleId} className="font-semibold text-[15px] text-slate-950 m-0 mb-1">
          {heading}
        </h2>
        <p className="text-[13px] text-slate-600 m-0 mb-4 leading-relaxed">{blurb}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block text-[13px] text-slate-700">
            <span className="font-medium text-slate-800">Name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              placeholder={isRoot ? "e.g. Contest prep" : "e.g. Math"}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoFocus
            />
          </label>

          {isNested && !fixedParentId ? (
            <div>
              <p className="text-[13px] font-medium text-slate-800 mb-2">
                Inside which section?
              </p>
              <WorksheetCollectionParentPicker
                sections={sections}
                value={parentId}
                onChange={setParentId}
                disabled={saving}
                open={open}
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                !title.trim() ||
                (isNested && !fixedParentId && !parentId)
              }
              className="rounded-xl border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
