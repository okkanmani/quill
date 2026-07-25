import { useMemo, useState } from "react";

const ROSTER_COLLAPSED_LIMIT = 5;

const SORT_OPTIONS = [
  { value: "attention", label: "Needs attention first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "activity", label: "Recent activity" },
];

function studentAttentionScore(student) {
  const needs = student.needs_addressing_count || 0;
  const reinf = student.reinforcement_count || 0;
  return needs * 1000 + reinf;
}

function studentNeedsAttention(student) {
  return (
    (student.needs_addressing_count || 0) > 0 ||
    (student.reinforcement_count || 0) > 0
  );
}

function statusDotClass(student) {
  if ((student.needs_addressing_count || 0) > 0) return "bg-rose-500";
  if ((student.reinforcement_count || 0) > 0) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function AdminStudentRoster({
  students,
  selectedName,
  onSelectStudent,
  switchingStudent = "",
  plainRows = false,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("attention");
  const [expanded, setExpanded] = useState(false);

  const needsAttentionCount = useMemo(
    () => students.filter(studentNeedsAttention).length,
    [students],
  );
  const caughtUpCount = students.length - needsAttentionCount;

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = students.filter((student) => {
      if (query && !student.name.toLowerCase().includes(query)) return false;
      if (filter === "attention") return studentNeedsAttention(student);
      if (filter === "caught_up") return !studentNeedsAttention(student);
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortBy === "activity") {
        const aTs = a.last_activity_at || "";
        const bTs = b.last_activity_at || "";
        if (aTs !== bTs) return bTs.localeCompare(aTs);
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      const scoreDiff = studentAttentionScore(b) - studentAttentionScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return list;
  }, [students, search, filter, sortBy]);

  const collapsed = !expanded && visibleStudents.length > ROSTER_COLLAPSED_LIMIT;
  const displayedStudents = collapsed
    ? visibleStudents.slice(0, ROSTER_COLLAPSED_LIMIT)
    : visibleStudents;
  const hiddenCount = visibleStudents.length - displayedStudents.length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All (${students.length})`}
        />
        <FilterChip
          active={filter === "attention"}
          onClick={() => setFilter("attention")}
          label={`Needs attention (${needsAttentionCount})`}
        />
        <FilterChip
          active={filter === "caught_up"}
          onClick={() => setFilter("caught_up")}
          label={`Caught up (${caughtUpCount})`}
        />
      </div>

      {visibleStudents.length === 0 ? (
        <div className="rounded-xl px-4 py-8 text-center text-sm text-slate-500">
          No students match your search or filter.
        </div>
      ) : plainRows ? (
        <div className="flex flex-col gap-0.5">
          {displayedStudents.map((student) => {
            const selected = student.name === selectedName;
            const caughtUp = !studentNeedsAttention(student);
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => onSelectStudent(student.name)}
                disabled={Boolean(switchingStudent)}
                title={selected ? "Click again to view all students" : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-xl transition-colors disabled:opacity-60 ${
                  selected
                    ? "bg-slate-100/90"
                    : "hover:bg-slate-100/90"
                } ${caughtUp && !selected ? "opacity-60 hover:opacity-80" : ""}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 w-2 h-2 rounded-full ${statusDotClass(student)}`}
                    aria-hidden
                  />
                  <span className="font-medium text-slate-900 truncate">{student.name}</span>
                  {student.grade != null ? (
                    <span className="text-sm text-slate-500 shrink-0">Gr. {student.grade}</span>
                  ) : null}
                  {selected ? (
                    <span className="inline-flex shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
                      Selected
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-500 hover:bg-slate-100/90 hover:text-slate-700 transition-colors"
            >
              + {hiddenCount} more
            </button>
          ) : null}

          {expanded && visibleStudents.length > ROSTER_COLLAPSED_LIMIT ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-500 hover:bg-slate-100/90 hover:text-slate-700 transition-colors"
            >
              Show less
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          {displayedStudents.map((student, index) => {
            const selected = student.name === selectedName;
            const caughtUp = !studentNeedsAttention(student);
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => onSelectStudent(student.name)}
                disabled={Boolean(switchingStudent)}
                title={selected ? "Click again to view all students" : undefined}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition disabled:opacity-60 ${
                  index > 0 ? "border-t border-slate-200" : ""
                } ${
                  selected
                    ? "bg-slate-50"
                    : "bg-white hover:bg-slate-50/70"
                } ${caughtUp && !selected ? "opacity-60 hover:opacity-80" : ""}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 w-2 h-2 rounded-full ${statusDotClass(student)}`}
                    aria-hidden
                  />
                  <span className="font-medium text-slate-900 truncate">{student.name}</span>
                  {student.grade != null ? (
                    <span className="text-sm text-slate-500 shrink-0">Gr. {student.grade}</span>
                  ) : null}
                  {selected ? (
                    <span className="inline-flex shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
                      Selected
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full border-t border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
            >
              + {hiddenCount} more
            </button>
          ) : null}

          {expanded && visibleStudents.length > ROSTER_COLLAPSED_LIMIT ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full border-t border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
            >
              Show less
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-indigo-600 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
