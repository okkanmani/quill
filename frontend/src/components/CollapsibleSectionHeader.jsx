import {
  WS_CHEVRON,
  WS_SECTION_META,
  WS_SECTION_TITLE,
} from "../worksheetAdminTypography";

/**
 * Collapsible section header row (matches WorksheetCollectionTree).
 */
export default function CollapsibleSectionHeader({
  title,
  meta,
  open,
  onToggle,
  titleClassName = WS_SECTION_TITLE,
  smallChevron = false,
  ariaLabel,
}) {
  const titleBtnClass =
    "flex-1 flex items-center gap-3 min-w-0 text-left rounded-lg hover:bg-slate-100/70 transition px-1 py-1.5 -ml-1";
  const chevronBtnClass = `shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100/80 transition ${
    smallChevron ? "w-5 h-5" : "w-7 h-7"
  }`;

  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={titleBtnClass}
      >
        <span className={`truncate ${titleClassName}`}>{title}</span>
        <span className="flex-1 min-w-[0.75rem]" aria-hidden />
        {meta ? (
          <span className={`${WS_SECTION_META} shrink-0 whitespace-nowrap`}>
            {meta}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={
          ariaLabel ||
          (open ? `Collapse ${title}` : `Expand ${title}`)
        }
        className={chevronBtnClass}
      >
        <span
          className={`${WS_CHEVRON} ${smallChevron ? "text-[10px]" : ""}`}
          aria-hidden
        >
          {open ? "▼" : "▶"}
        </span>
      </button>
    </div>
  );
}
