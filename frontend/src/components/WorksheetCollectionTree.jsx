import { useMemo, useState } from "react";
import WorksheetsBySubject from "./WorksheetsBySubject";
import SectionSortSelect from "./SectionSortSelect";
import MoveActionButton from "./MoveActionButton";
import RecycleBinButton from "./RecycleBinButton";
import AddSectionButton from "./AddSectionButton";
import { formatSubjectLabel } from "../subjectUtils";
import {
  SECTION_SORT_STATUS,
  sortWorksheetItems,
  WORKSHEET_SORT_OPTIONS,
} from "../sectionSortUtils";
import {
  buildSectionTree,
  isRootSection,
  rootCollectionStyle,
  ROOT_COLLECTION_STYLES,
  sectionCanHoldWorksheets,
  worksheetsInSection,
} from "../worksheetCollectionTree";

function collectionDeletable(node) {
  if (!isRootSection(node)) return true;
  const key = (node.mode_key || "").trim();
  return !(key && ROOT_COLLECTION_STYLES[key]);
}

function collectionDisplayTitle(node) {
  if (isRootSection(node)) return node.title;
  if (/^week\s+\d+$/i.test((node.title || "").trim())) {
    return node.title.trim().replace(/^week/i, "Week");
  }
  return formatSubjectLabel(node.title);
}

function ExpandChevron({ open, className = "" }) {
  return (
    <span
      className={`text-slate-800 text-sm font-bold shrink-0 tabular-nums ${className}`}
      aria-hidden
    >
      {open ? "▼" : "▶"}
    </span>
  );
}

function CollectionAdminToolbar({
  node,
  displayTitle,
  items,
  sortMode,
  onSortChange,
  onDeleteCollection,
  onMoveCollection,
  onAddSubCollection,
  variant = "outside",
}) {
  if (variant === "inline") {
    return (
      <div
        className="flex shrink-0 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MoveActionButton
          label={`Move section ${displayTitle}`}
          onClick={() => onMoveCollection(node)}
        />
        <AddSectionButton
          label={`Add section inside ${displayTitle}`}
          onClick={() => onAddSubCollection(node.id)}
        />
        {collectionDeletable(node) ? (
          <RecycleBinButton
            label={`Delete section ${displayTitle}`}
            onClick={() => onDeleteCollection(node)}
          />
        ) : null}
      </div>
    );
  }

  const col1 = [];
  const col2 = [];

  col1.push(
    <MoveActionButton
      key="move"
      label={`Move section ${displayTitle}`}
      onClick={() => onMoveCollection(node)}
    />,
  );

  if (collectionDeletable(node)) {
    col2.push(
      <RecycleBinButton
        key="delete"
        label={`Delete section ${displayTitle}`}
        onClick={() => onDeleteCollection(node)}
      />,
    );
  }

  col1.push(
    <AddSectionButton
      key="add"
      label={`Add section inside ${displayTitle}`}
      onClick={() => onAddSubCollection(node.id)}
    />,
  );

  if (items.length > 0) {
    col2.push(
      <div key="sort" className="flex flex-col items-center">
        <label htmlFor={`worksheets-sort-${node.id}`} className="sr-only">
          Sort worksheets in {displayTitle}
        </label>
        <SectionSortSelect
          id={`worksheets-sort-${node.id}`}
          value={sortMode}
          options={WORKSHEET_SORT_OPTIONS}
          onChange={onSortChange}
        />
      </div>,
    );
  }

  /** r1c1/r2c1: move + add; r1c2 (+ r2c2): delete, sort. Always two slots for width parity. */
  const columns = [col1, col2];

  return (
    <div
      className="flex shrink-0 items-start gap-1.5 py-0.5 min-w-[3.875rem]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {columns.map((colItems, colIndex) => (
        <div
          key={colIndex}
          className="flex w-7 flex-col items-center justify-start gap-1.5"
        >
          {colItems}
        </div>
      ))}
    </div>
  );
}

function nestedSectionMeta(itemCount, childCount) {
  const parts = [];
  if (itemCount > 0) {
    parts.push(`${itemCount} worksheet${itemCount === 1 ? "" : "s"}`);
  }
  if (childCount > 0) {
    parts.push(`${childCount} section${childCount === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

function CollectionRowHeader({
  displayTitle,
  meta,
  open,
  onToggle,
  adminInlineActions = null,
  titleClassName = "text-base",
  disableHoverHighlight = false,
  smallChevron = false,
}) {
  const titleBtnClass = disableHoverHighlight
    ? "flex-1 flex items-center gap-3 min-w-0 text-left rounded-lg px-1 py-1.5 -ml-1"
    : "flex-1 flex items-center gap-3 min-w-0 text-left rounded-lg hover:bg-slate-100/70 transition px-1 py-1.5 -ml-1";
  const chevronBtnClass = disableHoverHighlight
    ? `shrink-0 inline-flex items-center justify-center rounded-lg ${smallChevron ? "w-5 h-5" : "w-7 h-7"}`
    : `shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100/80 transition ${smallChevron ? "w-5 h-5" : "w-7 h-7"}`;

  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={titleBtnClass}
      >
        <span className={`font-bold text-slate-950 truncate ${titleClassName}`}>
          {displayTitle}
        </span>
        <span className="flex-1 min-w-[0.75rem]" aria-hidden />
        {meta ? (
          <span className="text-xs font-semibold text-slate-700 shrink-0 tabular-nums whitespace-nowrap">
            {meta}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? `Collapse ${displayTitle}` : `Expand ${displayTitle}`}
        className={chevronBtnClass}
      >
        <ExpandChevron
          open={open}
          className={smallChevron ? "text-[10px]" : ""}
        />
      </button>
      {adminInlineActions}
    </div>
  );
}

/** Visual nesting for sections below top-level (Practice, Timed, …). */
function nestedCollectionNestClass(depth) {
  if (depth < 1) return "";
  if (depth === 1) {
    return "ml-2 sm:ml-3 pl-3 sm:pl-4";
  }
  return "ml-1 sm:ml-1.5 pl-2 sm:pl-2.5";
}

function nestedExpandedBodyClass(depth) {
  return depth <= 1
    ? "flex flex-col gap-3 pb-1 pt-0.5 pl-2 sm:pl-3"
    : "flex flex-col gap-3 pb-1 pt-0.5 pl-1 sm:pl-2";
}

function nestedWorksheetInsetClass(depth) {
  return depth <= 1 ? "pl-1 sm:pl-1.5 ml-1.5 sm:ml-2" : "pl-0.5 sm:pl-1 ml-1 sm:ml-1.5";
}

function CollectionNode({
  node,
  worksheets,
  depth,
  onOpenWorksheet,
  onOpenTest,
  renderSideAction,
  renderLeadingAction,
  adminMode,
  onAddSubCollection,
  onMoveCollection,
  onDeleteCollection,
}) {
  const [open, setOpen] = useState(false);
  const [sortMode, setSortMode] = useState(SECTION_SORT_STATUS);
  const isRoot = isRootSection(node);
  const items = sectionCanHoldWorksheets(node)
    ? worksheetsInSection(worksheets, node.id)
    : [];
  const sortedItems = useMemo(() => {
    if (!sectionCanHoldWorksheets(node)) return [];
    return sortWorksheetItems(
      worksheetsInSection(worksheets, node.id),
      sortMode,
    );
  }, [worksheets, node, sortMode]);
  const childCount = node.children?.length ?? 0;
  const emptyNested = !isRoot && items.length === 0 && childCount === 0;
  const emptyRoot = isRoot && childCount === 0;
  const displayTitle = collectionDisplayTitle(node);
  const isNested = !isRoot;

  const shellClass = isNested
    ? "overflow-hidden"
    : "rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden";

  const toggle = () => setOpen((v) => !v);

  const nestedMeta = nestedSectionMeta(items.length, childCount);

  const adminToolbarOutside = adminMode ? (
    <CollectionAdminToolbar
      node={node}
      displayTitle={displayTitle}
      items={items}
      sortMode={sortMode}
      onSortChange={setSortMode}
      onDeleteCollection={onDeleteCollection}
      onMoveCollection={onMoveCollection}
      onAddSubCollection={onAddSubCollection}
      variant="outside"
    />
  ) : null;

  const adminToolbarInline = adminMode ? (
    <CollectionAdminToolbar
      node={node}
      displayTitle={displayTitle}
      items={items}
      sortMode={sortMode}
      onSortChange={setSortMode}
      onDeleteCollection={onDeleteCollection}
      onMoveCollection={onMoveCollection}
      onAddSubCollection={onAddSubCollection}
      variant="inline"
    />
  ) : null;

  const expandedBody = open ? (
    <div
      className={
        isNested ? nestedExpandedBodyClass(depth) : "p-3 flex flex-col gap-3 bg-slate-50/40"
      }
    >
      {adminMode && !isRoot && items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label
            htmlFor={`worksheets-sort-${node.id}`}
            className="text-xs font-medium text-slate-600"
          >
            Sort
          </label>
          <SectionSortSelect
            id={`worksheets-sort-${node.id}`}
            value={sortMode}
            options={WORKSHEET_SORT_OPTIONS}
            onChange={setSortMode}
          />
        </div>
      ) : null}

      {!adminMode && items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label
            htmlFor={`worksheets-sort-${node.id}`}
            className="text-xs font-medium text-slate-600"
          >
            Sort
          </label>
          <SectionSortSelect
            id={`worksheets-sort-${node.id}`}
            value={sortMode}
            options={WORKSHEET_SORT_OPTIONS}
            onChange={setSortMode}
          />
        </div>
      ) : null}

      {(node.children || []).map((child) => (
        <CollectionNode
          key={child.id}
          node={child}
          worksheets={worksheets}
          depth={depth + 1}
          onOpenWorksheet={onOpenWorksheet}
          onOpenTest={onOpenTest}
          renderSideAction={renderSideAction}
          renderLeadingAction={renderLeadingAction}
          adminMode={adminMode}
          onAddSubCollection={onAddSubCollection}
          onMoveCollection={onMoveCollection}
          onDeleteCollection={onDeleteCollection}
        />
      ))}

      {!isRoot && sortedItems.length > 0 ? (
        <div className={nestedWorksheetInsetClass(depth)}>
          <WorksheetsBySubject
            worksheets={sortedItems}
            onOpenWorksheet={onOpenWorksheet}
            onOpenTest={onOpenTest}
            renderSideAction={renderSideAction}
            renderLeadingAction={renderLeadingAction}
            ungrouped
            preserveOrder
          />
        </div>
      ) : null}

      {adminMode && emptyRoot ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center">
          <p className="text-sm text-slate-600 m-0">
            Add a section (e.g. Math) using the + button beside this section.
          </p>
        </div>
      ) : null}

      {adminMode && emptyNested ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-center">
          <p className="text-sm text-slate-600 m-0">
            No worksheets here yet. Use <strong>Move</strong> from Unassigned,
            or add a subsection with the <strong>+</strong> on this section.
          </p>
        </div>
      ) : null}

      {!adminMode && emptyNested && childCount === 0 ? (
        <p className="text-sm text-slate-500 text-center py-2">No worksheets yet.</p>
      ) : null}
    </div>
  ) : null;

  if (isRoot) {
    const rootMeta = `${childCount} ${childCount === 1 ? "section" : "sections"}`;

    return (
      <div className="flex items-start gap-2 min-w-0 w-full">
        <div className={`flex-1 min-w-0 ${shellClass}`}>
          <div
            className={`px-4 py-3 border-b ${rootCollectionStyle(node)}`}
          >
            <CollectionRowHeader
              displayTitle={displayTitle}
              meta={rootMeta}
              open={open}
              onToggle={toggle}
              titleClassName="text-lg"
              disableHoverHighlight
            />
          </div>
          {expandedBody}
        </div>
        {adminToolbarOutside ? (
          <div className="self-start shrink-0">{adminToolbarOutside}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${shellClass} ${nestedCollectionNestClass(depth)}`}>
      <CollectionRowHeader
        displayTitle={displayTitle}
        meta={nestedMeta}
        open={open}
        onToggle={toggle}
        adminInlineActions={adminToolbarInline}
        smallChevron
      />
      {expandedBody}
    </div>
  );
}

export default function WorksheetCollectionTree({
  sections,
  worksheets,
  onOpenWorksheet,
  onOpenTest,
  renderSideAction,
  renderLeadingAction,
  adminMode = false,
  onAddSubCollection,
  onMoveCollection,
  onDeleteCollection,
}) {
  const roots = buildSectionTree(sections);
  if (roots.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-8">
      {roots.map((node) => (
        <CollectionNode
          key={node.id}
          node={node}
          worksheets={worksheets}
          depth={0}
          onOpenWorksheet={onOpenWorksheet}
          onOpenTest={onOpenTest}
          renderSideAction={renderSideAction}
          renderLeadingAction={renderLeadingAction}
          adminMode={adminMode}
          onAddSubCollection={onAddSubCollection}
          onMoveCollection={onMoveCollection}
          onDeleteCollection={onDeleteCollection}
        />
      ))}
    </div>
  );
}
