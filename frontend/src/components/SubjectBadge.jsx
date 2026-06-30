import { formatSubjectLabel } from "../subjectUtils";

const STYLES = {
  math: "bg-sky-100 text-sky-900 border-sky-200",
  english: "bg-violet-100 text-violet-900 border-violet-200",
  science: "bg-teal-100 text-teal-900 border-teal-200",
  data: "bg-indigo-100 text-indigo-950 border-indigo-200",
  general: "bg-stone-100 text-stone-800 border-stone-200",
};

export default function SubjectBadge({ subject }) {
  const key = (subject || "general").trim().toLowerCase() || "general";
  const style = STYLES[key] || "bg-slate-100 text-slate-900 border-slate-200";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {formatSubjectLabel(subject)}
    </span>
  );
}
