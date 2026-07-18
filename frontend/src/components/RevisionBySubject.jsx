import { useMemo } from "react";
import SubjectBadge from "./SubjectBadge";
import ContentBadge from "./ContentBadge";
import { DifficultyStars } from "./DifficultyStars";
import { isWorksheetDone } from "../subjectUtils";

function formatRevisionDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RevisionRow({ item, onOpenRevision }) {
  const done = isWorksheetDone(item);

  return (
    <button
      type="button"
      onClick={() => onOpenRevision(item.id)}
      className="w-full text-left flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm transition overflow-hidden hover:shadow-md hover:border-indigo-400"
    >
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-slate-900 font-semibold text-lg">{item.title}</p>
          {done ? (
            <span className="shrink-0 inline-flex items-center gap-2 flex-wrap justify-end">
              {typeof item.last_score === "number" &&
              typeof item.last_total === "number" &&
              item.last_total > 0 ? (
                <span className="inline-flex items-baseline gap-x-4 text-sm font-bold text-emerald-950 tabular-nums">
                  <span className="shrink-0">Score:</span>
                  <span>
                    {item.last_score}/{item.last_total}
                  </span>
                  <span>
                    {Math.round((item.last_score / item.last_total) * 100)}%
                  </span>
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                Done
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 pt-3">
        <ContentBadge label={item.content_badge || "Revision"} />
        <SubjectBadge subject={item.subject} />
        <DifficultyStars min={item.difficulty_min} max={item.difficulty_max} />
        {item.focus_area_label ? (
          <span className="text-violet-800 text-xs font-semibold rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 capitalize">
            {item.focus_area_label}
          </span>
        ) : null}
        <span className="text-indigo-500 text-sm">
          {item.question_count} questions
        </span>
        {item.created_at ? (
          <span className="text-slate-500 text-xs">
            {formatRevisionDate(item.created_at)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

/** Flat revision worksheet list (metadata cards only). */
export default function RevisionBySubject({ revisions, onOpenRevision }) {
  const items = useMemo(
    () =>
      [...revisions].sort(
        (a, b) => (b.sort_ts || 0) - (a.sort_ts || 0) || b.id - a.id,
      ),
    [revisions],
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <RevisionRow
          key={item.id}
          item={item}
          onOpenRevision={onOpenRevision}
        />
      ))}
    </div>
  );
}
