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

export function LearnPageSheet({
  pageNumber,
  totalPages,
  children,
  className = "",
}) {
  return (
    <article
      className={`learn-page rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm ${className}`.trim()}
    >
      <div className="flex justify-end mb-4 -mt-1">
        <LearnPageBadge pageNumber={pageNumber} totalPages={totalPages} />
      </div>
      {children}
      <LearnPageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </article>
  );
}
