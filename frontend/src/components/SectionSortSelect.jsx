import { SECTION_SORT_OPTIONS } from "../sectionSortUtils";

export default function SectionSortSelect({ id, value, onChange, className = "" }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Sort section"
      className={`rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300/80 ${className}`}
    >
      {SECTION_SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
