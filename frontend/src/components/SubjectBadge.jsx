const STYLES = {
  math: "bg-sky-100 text-sky-900 border-sky-200",
  english: "bg-violet-100 text-violet-900 border-violet-200",
  science: "bg-teal-100 text-teal-900 border-teal-200",
  general: "bg-stone-100 text-stone-800 border-stone-200",
};

export function formatSubjectLabel(subject) {
  const s = (subject || "general").trim();
  if (!s) return "General";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function SubjectBadge({ subject }) {
  const key = (subject || "general").trim().toLowerCase() || "general";
  const style = STYLES[key] || "bg-amber-100 text-amber-900 border-amber-200";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {formatSubjectLabel(subject)}
    </span>
  );
}
