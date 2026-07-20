import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  listQuestionBank,
  logout,
  updateQuestionBankItem,
} from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import TestQuestionCard from "../components/TestQuestionCard";
import {
  BUILDER_SUBJECTS,
  TEST_TIERS,
  bankItemToEditorQuestion,
  editorQuestionToBankPayload,
  emptyTestQuestion,
  isTestQuestionComplete,
} from "../testBuilderUtils";

export default function AdminQuestionBank() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("math");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [drafts, setDrafts] = useState({});
  const [activeTierFilter, setActiveTierFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newQuestion, setNewQuestion] = useState(() => emptyTestQuestion(2));

  const loadItems = useCallback(() => {
    setLoading(true);
    setError("");
    listQuestionBank({ subject })
      .then((data) => {
        setItems(data);
        const nextDrafts = {};
        for (const item of data) {
          nextDrafts[item.id] = bankItemToEditorQuestion(item);
        }
        setDrafts(nextDrafts);
      })
      .catch((err) => setError(err.message || "Could not load question bank."))
      .finally(() => setLoading(false));
  }, [subject]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const tierCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    for (const item of items) {
      const tier = Number(item.stars);
      if (tier >= 1 && tier <= 3) counts[tier] += 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    let next = items;
    if (activeTierFilter !== "all") {
      const tier = Number(activeTierFilter);
      next = next.filter((item) => Number(item.stars) === tier);
    }
    const area = areaFilter.trim().toLowerCase();
    if (area) {
      next = next.filter((item) => String(item.area || "").toLowerCase().includes(area));
    }
    return next;
  }, [activeTierFilter, areaFilter, items]);

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateDraft(id, patch) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  async function handleSave(itemId) {
    const draft = drafts[itemId];
    if (!draft || !isTestQuestionComplete(draft)) {
      setError("Complete all fields before saving.");
      return;
    }
    setSavingId(itemId);
    setError("");
    setNotice("");
    try {
      const saved = await updateQuestionBankItem(
        itemId,
        editorQuestionToBankPayload(draft, subject),
      );
      setItems((prev) => prev.map((item) => (item.id === itemId ? saved : item)));
      setDrafts((prev) => ({ ...prev, [itemId]: bankItemToEditorQuestion(saved) }));
      setNotice("Question saved.");
    } catch (err) {
      setError(err.message || "Could not save question.");
    } finally {
      setSavingId("");
    }
  }

  async function handleDelete(itemId) {
    const draft = drafts[itemId];
    const preview = draft?.prompt?.trim() || itemId;
    const ok = window.confirm(`Delete “${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}”?`);
    if (!ok) return;
    setDeletingId(itemId);
    setError("");
    setNotice("");
    try {
      await deleteQuestionBankItem(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      setNotice("Question deleted.");
    } catch (err) {
      setError(err.message || "Could not delete question.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleCreateNew() {
    if (!isTestQuestionComplete(newQuestion)) {
      setError("Complete all fields before adding a question.");
      return;
    }
    setSavingId("new");
    setError("");
    setNotice("");
    try {
      const created = await createQuestionBankItem(
        editorQuestionToBankPayload(newQuestion, subject),
      );
      setItems((prev) => [created, ...prev]);
      setDrafts((prev) => ({ ...prev, [created.id]: bankItemToEditorQuestion(created) }));
      setExpandedIds((prev) => new Set(prev).add(created.id));
      setNewQuestion(emptyTestQuestion(2));
      setAddingNew(false);
      setNotice("Question added to bank.");
    } catch (err) {
      setError(err.message || "Could not add question.");
    } finally {
      setSavingId("");
    }
  }

  const subjectLabel =
    BUILDER_SUBJECTS.find((option) => option.value === subject)?.label || subject;

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
      mainClassName="pb-28"
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Question bank</h1>
        <p className="text-slate-600 text-sm mb-5 leading-relaxed">
          Reusable MCQs organized by subject. Edit questions here, then pick them when building tests
          to save AI tokens and reuse content across assessments.
        </p>

        {notice ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <nav
          className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3"
          aria-label="Question bank subjects"
        >
          {BUILDER_SUBJECTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSubject(option.value);
                setActiveTierFilter("all");
                setAreaFilter("");
                setAddingNew(false);
                setNotice("");
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                subject === option.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">{subjectLabel}</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {items.length} saved question{items.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/create/test"
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
              >
                Build a test →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setAddingNew((open) => !open);
                  setNewQuestion(emptyTestQuestion(2));
                  setExpandedIds(new Set());
                }}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-sm font-semibold transition"
              >
                {addingNew ? "Cancel new question" : "+ Add question"}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {TEST_TIERS.map((tier) => (
              <div
                key={tier.value}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{tier.label}</p>
                <p className="text-lg font-bold tabular-nums mt-1 text-slate-800">
                  {tierCounts[tier.value] || 0}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => setActiveTierFilter("all")}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                activeTierFilter === "all"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All tiers ({items.length})
            </button>
            {TEST_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setActiveTierFilter(String(tier.value))}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  activeTierFilter === String(tier.value)
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tier.label} ({tierCounts[tier.value] || 0})
              </button>
            ))}
            <input
              type="search"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              placeholder="Filter by topic area"
              className="ml-auto min-w-[12rem] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {addingNew ? (
            <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
              <p className="text-sm font-semibold text-teal-950">New question</p>
              <TestQuestionCard
                question={newQuestion}
                index={0}
                expanded
                onToggle={() => {}}
                onChange={(patch) => setNewQuestion((prev) => ({ ...prev, ...patch }))}
                onRemove={null}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  disabled={savingId === "new"}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition"
                >
                  {savingId === "new" ? "Saving…" : "Save to bank"}
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <QuillLoading label="Loading questions…" />
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              {items.length === 0
                ? "No questions saved for this subject yet. Add one manually or save questions from the test builder."
                : "No questions match these filters."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item, index) => {
                const draft = drafts[item.id] || bankItemToEditorQuestion(item);
                return (
                  <div key={item.id} className="space-y-2">
                    <TestQuestionCard
                      question={draft}
                      index={index}
                      expanded={expandedIds.has(item.id)}
                      onToggle={() => toggleExpanded(item.id)}
                      onChange={(patch) => updateDraft(item.id, patch)}
                      onRemove={() => handleDelete(item.id)}
                      removeLabel={deletingId === item.id ? "Deleting…" : "Delete from bank"}
                    />
                    {expandedIds.has(item.id) ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <p className="text-xs text-slate-500">
                          {item.id}
                          {item.source ? ` · ${item.source}` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSave(item.id)}
                          disabled={savingId === item.id || !isTestQuestionComplete(draft)}
                          className="rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 transition"
                        >
                          {savingId === item.id ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
