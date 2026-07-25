import { useEffect, useMemo, useState } from "react";
import {
  buildSectionTree,
  isRootSection,
  sectionPathLabel,
} from "../worksheetCollectionTree";

function listRowClass(selected, disabled, dimmed) {
  return `flex-1 min-w-0 text-left px-3 py-2.5 text-[13px] rounded-lg border transition ${
    disabled || dimmed ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
  } ${
    selected
      ? "border-indigo-500 bg-indigo-50 text-indigo-950 font-medium shadow-sm"
      : "border-transparent bg-white text-slate-800 hover:bg-white hover:border-slate-200"
  }`;
}

function PickerNode({
  node,
  depth,
  sections,
  blockedIds,
  excludeSectionId,
  expanded,
  onToggleExpand,
  value,
  onChange,
  isSelectable,
  disabled,
}) {
  if (blockedIds.has(node.id)) return null;

  if (excludeSectionId && node.id === excludeSectionId) {
    const promoted = (node.children || []).filter((c) => !blockedIds.has(c.id));
    return promoted.map((child) => (
      <PickerNode
        key={child.id}
        node={child}
        depth={depth}
        sections={sections}
        blockedIds={blockedIds}
        excludeSectionId={excludeSectionId}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        value={value}
        onChange={onChange}
        isSelectable={isSelectable}
        disabled={disabled}
      />
    ));
  }

  const isRoot = isRootSection(node);
  const selectable = isSelectable(node);
  const selected = value === node.id;
  const visibleChildren = (node.children || []).filter(
    (c) => !blockedIds.has(c.id),
  );
  const showChevron = visibleChildren.length > 0;
  const isOpen = expanded.has(node.id);

  const label = isRoot ? (
    <span className="font-semibold">{node.title}</span>
  ) : depth > 0 ? (
    node.title
  ) : (
    sectionPathLabel(sections, node.id)
  );

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className="flex items-stretch gap-0.5"
        style={{ paddingLeft: `${4 + depth * 10}px` }}
      >
        {showChevron ? (
          <button
            type="button"
            aria-label={isOpen ? "Collapse" : "Expand"}
            aria-expanded={isOpen}
            disabled={disabled}
            className="shrink-0 w-7 h-[38px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/80 text-[11px] disabled:opacity-50"
            onClick={() => onToggleExpand(node.id)}
          >
            {isOpen ? "▼" : "▶"}
          </button>
        ) : (
          <span className="shrink-0 w-7" aria-hidden />
        )}
        {selectable ? (
          <button
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            className={listRowClass(selected, disabled, false)}
            onClick={() => {
              if (!disabled) onChange(node.id);
            }}
          >
            {label}
            {isRoot ? (
              <span className="text-slate-500 font-normal"> — use this folder</span>
            ) : null}
          </button>
        ) : (
          <span className="flex-1 min-w-0 px-3 py-2.5 text-[13px] font-semibold text-slate-800">
            {label}
            <span className="text-slate-500 font-normal text-xs block mt-0.5">
              Expand to choose a sub-folder
            </span>
          </span>
        )}
      </div>
      {isOpen
        ? visibleChildren.map((child) => (
            <PickerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              sections={sections}
              blockedIds={blockedIds}
              excludeSectionId={excludeSectionId}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              value={value}
              onChange={onChange}
              isSelectable={isSelectable}
              disabled={disabled}
            />
          ))
        : null}
    </div>
  );
}

/**
 * Expandable tree: top-level collections first; expand to pick nested parents.
 * @param {null} value — selected section id; use showTopLevel + onChange(null) for roots-only row
 */
export default function ExpandableCollectionPicker({
  sections,
  value,
  onChange,
  blockedIds = null,
  excludeSectionId = null,
  isSelectable = () => true,
  showTopLevel = false,
  disabled = false,
  ariaLabel = "Choose section",
  open = true,
}) {
  const blocked = useMemo(() => {
    const set = blockedIds ? new Set(blockedIds) : new Set();
    return set;
  }, [blockedIds]);

  const tree = useMemo(() => buildSectionTree(sections), [sections]);

  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    setExpanded(new Set());
  }, [open]);

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const roots = tree.filter((node) => !blocked.has(node.id));

  return (
    <div
      role="listbox"
      aria-label={ariaLabel}
      className="flex flex-col gap-0.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/90 p-1.5"
    >
      {showTopLevel ? (
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          disabled={disabled}
          className={listRowClass(value === null, disabled, false)}
          onClick={() => onChange(null)}
        >
          Top level{" "}
          <span className="text-slate-500 font-normal">(folders only—no worksheets)</span>
        </button>
      ) : null}

      {roots.map((node) => (
        <PickerNode
          key={node.id}
          node={node}
          depth={0}
          sections={sections}
          blockedIds={blocked}
          excludeSectionId={excludeSectionId}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          value={value}
          onChange={onChange}
          isSelectable={isSelectable}
          disabled={disabled}
        />
      ))}

      {roots.length === 0 && !showTopLevel ? (
        <p className="text-[13px] text-slate-600 m-0 px-2 py-2">No destinations available.</p>
      ) : null}
    </div>
  );
}
