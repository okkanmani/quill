import { Link } from "react-router-dom";
import { formatAreaLabel } from "./analysisUtils";
import { focusSelectionKey } from "./adminHomeUtils";
import { formatSubjectLabel } from "./subjectUtils";

export function focusChipBadgeClass(kind) {
  if (kind === "needs_reinforcing") {
    return "bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100";
  }
  return "bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100";
}

export function focusChipKindLabel(kind) {
  if (kind.kind === "needs_reinforcing" || kind === "needs_reinforcing") {
    return "Reinforcement";
  }
  return "Needs addressing";
}

export function adminFocusAnalysisPath(chip) {
  const focus = focusSelectionKey(chip.subject, chip.area);
  return `/admin/analysis?focus=${encodeURIComponent(focus)}`;
}

export function AdminFocusChip({
  chip,
  showStudentName = false,
  onNavigate,
  switchingStudent = "",
}) {
  const label = formatAreaLabel(chip.area);
  if (!label.trim()) return null;

  const subjectLabel = formatSubjectLabel(chip.subject);
  const kindLabel = focusChipKindLabel(chip.kind);
  const className = `flex w-full rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition disabled:opacity-60 ${focusChipBadgeClass(chip.kind)}`;

  const content = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate">{label}</span>
        <span className="text-xs font-medium opacity-75">
          {subjectLabel}
          {showStudentName && chip.student_name ? ` · ${chip.student_name}` : ""}
        </span>
      </span>
      <span className="shrink-0 self-center text-xs font-semibold">{kindLabel}</span>
    </>
  );

  if (onNavigate) {
    return (
      <button
        type="button"
        disabled={Boolean(switchingStudent)}
        onClick={() => onNavigate(chip.student_name, adminFocusAnalysisPath(chip))}
        className={`${className} items-center justify-between gap-3`}
        title={kindLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={adminFocusAnalysisPath(chip)}
      className={`${className} items-center justify-between gap-3`}
      title={kindLabel}
    >
      {content}
    </Link>
  );
}

export function AdminFocusChipSection({
  chips = [],
  totalCount = 0,
  previewLimit = 5,
  showStudentName = false,
  onNavigate,
  switchingStudent = "",
}) {
  const preview = chips.slice(0, previewLimit);
  const hiddenCount = Math.max(0, totalCount - preview.length);

  return (
    <section>
      <SectionHeading />
      {totalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-3.5 py-4 text-sm text-slate-500">
          No focus areas need attention right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {preview.map((chip) => (
            <AdminFocusChip
              key={`${chip.kind}-${chip.student_name}-${chip.subject}-${chip.area}`}
              chip={chip}
              showStudentName={showStudentName}
              onNavigate={onNavigate}
              switchingStudent={switchingStudent}
            />
          ))}
          {hiddenCount > 0 ? (
            <Link
              to="/admin/analysis"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-slate-50 transition text-center"
            >
              View more ({totalCount} total)
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SectionHeading() {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
      Focus areas
    </p>
  );
}
