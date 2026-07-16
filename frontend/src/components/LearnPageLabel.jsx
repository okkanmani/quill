import { formatLearnPageLabel } from "../learnPageUtils";

export function LearnPageBadge({ pageNumber, totalPages, className = "" }) {
  const label = formatLearnPageLabel(pageNumber, totalPages);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 tabular-nums ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export function LearnPageFooter({ pageNumber, totalPages }) {
  const label = formatLearnPageLabel(pageNumber, totalPages);
  if (!label) return null;

  return (
    <footer className="mt-8 pt-4 border-t border-slate-100 flex justify-center">
      <span className="text-xs font-medium text-slate-400 tabular-nums tracking-wide">
        {label}
      </span>
    </footer>
  );
}

const LEARN_PAGE_STICKY_HEADER_CLASS =
  "sticky top-6 z-20 -mx-6 sm:-mx-8 px-6 sm:px-8 pb-3 mb-4 bg-white/95 backdrop-blur-sm border-b border-slate-100/80";

export function LearnPageSheet({
  pageNumber,
  totalPages,
  children,
  className = "",
  headerStart = null,
  stickyHeader = false,
}) {
  const headerClassName = stickyHeader
    ? `${LEARN_PAGE_STICKY_HEADER_CLASS} -mt-6 sm:-mt-8 pt-6 sm:pt-8 flex items-start justify-between gap-3`
    : "flex items-start justify-between gap-3 mb-4 -mt-1";

  return (
    <article
      className={`learn-page rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm ${className}`.trim()}
    >
      <div className={headerClassName}>
        <div className="min-w-0 flex-1">{headerStart}</div>
        <LearnPageBadge pageNumber={pageNumber} totalPages={totalPages} />
      </div>
      {children}
      <LearnPageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </article>
  );
}

export function LearnPageStickyToolbar({ children }) {
  if (!children) return null;
  return (
    <div className={`${LEARN_PAGE_STICKY_HEADER_CLASS} -mt-6 sm:-mt-8 pt-6 sm:pt-8`}>
      {children}
    </div>
  );
}
