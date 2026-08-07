import { useEffect, useMemo, useState } from "react";
import { listQuestionBank } from "../api";
import QuillLoading from "./QuillLoading";
import { QuestionDifficultyStars } from "./DifficultyStars";
import { BUILDER_SUBJECTS, TEST_TIERS } from "../testBuilderUtils";

export default function QuestionBankPicker({
  subject,
  open,
  onClose,
  onAdd,
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    setSelectedIds(new Set());
    listQuestionBank({ subject })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load question bank.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, subject]);

  const subjectLabel =
    BUILDER_SUBJECTS.find((option) => option.value === subject)?.label || subject;

  const filteredItems = useMemo(() => {
    let next = items;
    if (tierFilter !== "all") {
      const tier = Number(tierFilter);
      next = next.filter((item) => Number(item.stars) === tier);
    }
    const area = areaFilter.trim().toLowerCase();
    if (area) {
      next = next.filter((item) => String(item.area || "").toLowerCase().includes(area));
    }
    return next;
  }, [areaFilter, items, tierFilter]);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const selected = items.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) return;
    onAdd(selected);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-bank-picker-title"
    >
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="question-bank-picker-title" className="text-lg font-bold text-slate-900">
              Add from question bank
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {subjectLabel} · {items.length} saved question{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTierFilter("all")}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                tierFilter === "all"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All tiers
            </button>
            {TEST_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setTierFilter(String(tier.value))}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  tierFilter === String(tier.value)
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            placeholder="Filter by topic area"
            className="quill-field-input ml-auto min-w-[10rem] rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <QuillLoading label="Loading question bank…" />
          ) : error ? (
            <p className="text-sm text-red-700 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              {error}
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              {items.length === 0
                ? "No saved questions for this subject yet. Save questions from the test builder or add them on the Question Bank page."
                : "No questions match these filters."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredItems.map((item) => {
                const selected = selectedIds.has(item.id);
                const tier = TEST_TIERS.find((t) => t.value === Number(item.stars));
                return (
                  <li key={item.id}>
                    <label
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                        selected
                          ? "border-teal-300 bg-teal-50/70"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(item.id)}
                        className="mt-1 rounded border-slate-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <QuestionDifficultyStars stars={item.stars} />
                          <span className="text-xs font-semibold text-slate-500">
                            {tier?.shortLabel}
                          </span>
                          {item.area ? (
                            <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              {item.area}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-sm text-slate-900 mt-1 leading-relaxed">
                          {item.prompt}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedIds.size === 0}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition"
          >
            Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}to test
          </button>
          <p className="text-sm text-slate-600">
            Selected questions are copied into this test — edits here won&apos;t change saved bank items.
          </p>
        </div>
      </div>
    </div>
  );
}
