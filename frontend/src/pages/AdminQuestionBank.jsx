import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  listQuestionBank,
  logout,
  updateQuestionBankItem,
} from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import QuestionBankEditorModal from "../components/QuestionBankEditorModal";
import PassageQuestionBankPanel from "../components/PassageQuestionBankPanel";
import { QuestionDifficultyStars } from "../components/DifficultyStars";
import {
  BUILDER_SUBJECTS,
  TEST_TIERS,
  bankItemToEditorQuestion,
  editorQuestionToBankPayload,
  emptyTestQuestion,
  isTestQuestionComplete,
} from "../testBuilderUtils";

function isPassageBankSubject(subject) {
  return subject === "english" || subject === "data";
}

function formatBankDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesSearch(item, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    item.prompt,
    item.area,
    item.id,
    item.source,
    item.answer,
    ...(Array.isArray(item.choices) ? item.choices : []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export default function AdminQuestionBank() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("math");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTierFilter, setActiveTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editorMode, setEditorMode] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    setError("");
    listQuestionBank({ subject })
      .then((data) => setItems(data))
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
    if (searchQuery.trim()) {
      next = next.filter((item) => matchesSearch(item, searchQuery));
    }
    return next;
  }, [activeTierFilter, items, searchQuery]);

  function openCreateEditor() {
    setEditorMode("create");
    setEditorDraft(emptyTestQuestion(2));
    setError("");
  }

  function openEditEditor(item) {
    setEditorMode(item.id);
    setEditorDraft(bankItemToEditorQuestion(item));
    setError("");
  }

  function closeEditor() {
    setEditorMode(null);
    setEditorDraft(null);
  }

  async function handleSaveEditor() {
    if (!editorDraft || !isTestQuestionComplete(editorDraft)) {
      setError("Complete all fields before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editorMode === "create") {
        const created = await createQuestionBankItem(
          editorQuestionToBankPayload(editorDraft, subject),
        );
        if (!created.duplicate) {
          setItems((prev) => [created, ...prev]);
          setNotice("Question added to bank.");
        }
      } else {
        const saved = await updateQuestionBankItem(
          editorMode,
          editorQuestionToBankPayload(editorDraft, subject),
        );
        setItems((prev) => prev.map((item) => (item.id === editorMode ? saved : item)));
        setNotice("Question saved.");
      }
      closeEditor();
    } catch (err) {
      setError(err.message || "Could not save question.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEditor() {
    if (editorMode === "create" || !editorMode) return;
    const preview = editorDraft?.prompt?.trim() || editorMode;
    const ok = window.confirm(
      `Delete “${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}”?`,
    );
    if (!ok) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await deleteQuestionBankItem(editorMode);
      setItems((prev) => prev.filter((item) => item.id !== editorMode));
      setNotice("Question deleted.");
      closeEditor();
    } catch (err) {
      setError(err.message || "Could not delete question.");
    } finally {
      setDeleting(false);
    }
  }

  const subjectLabel =
    BUILDER_SUBJECTS.find((option) => option.value === subject)?.label || subject;

  const editingItem =
    editorMode && editorMode !== "create"
      ? items.find((item) => item.id === editorMode)
      : null;

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
      mainClassName="pb-28"
    >
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Question bank</h1>
        <p className="text-slate-600 text-sm mb-5 leading-relaxed">
          Reusable MCQs organized by subject. Search and edit records here, then pick them when
          building tests.
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
                setSearchQuery("");
                closeEditor();
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

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-6 overflow-hidden">
          {isPassageBankSubject(subject) ? (
            <div className="p-5">
              <div className="mb-4">
                <h2 className="font-bold text-slate-900">{subjectLabel}</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  {subject === "english"
                    ? "Reading comprehension passages with linked questions, plus standalone items."
                    : "Charts, tables, and context with linked questions."}
                </p>
              </div>
              <PassageQuestionBankPanel
                subject={subject}
                showStandalone={subject === "english"}
                onNotice={setNotice}
                onError={setError}
              />
            </div>
          ) : (
            <>
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">{subjectLabel}</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  {filteredItems.length} of {items.length} question
                  {items.length === 1 ? "" : "s"}
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
                  onClick={openCreateEditor}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-sm font-semibold transition"
                >
                  + Add question
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions, area, choices…"
                className="min-w-[16rem] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTierFilter("all")}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    activeTierFilter === "all"
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
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8">
              <QuillLoading label="Loading questions…" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-500 px-5 py-12 text-center">
              {items.length === 0
                ? "No questions saved for this subject yet. Add one manually or save questions from the test builder."
                : "No questions match your search or filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold w-[42%]">
                      Question
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-36">
                      Area
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-28">
                      Tier
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-24">
                      Source
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-32">
                      Updated
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-20 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const tier = TEST_TIERS.find((t) => t.value === Number(item.stars));
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                        onClick={() => openEditEditor(item)}
                      >
                        <td className="px-4 py-3 align-middle max-w-0">
                          <p
                            className="text-slate-900 truncate"
                            title={item.prompt?.trim() || undefined}
                          >
                            {item.prompt?.trim() || "—"}
                          </p>
                          <p
                            className="text-xs text-slate-400 mt-1 font-mono truncate"
                            title={item.id}
                          >
                            {item.id}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700">
                          {item.area?.trim() ? (
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              {item.area}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <QuestionDifficultyStars stars={item.stars} />
                            <span className="text-xs font-medium text-slate-700">
                              {tier?.difficultyLabel || `Tier ${item.stars}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top capitalize text-slate-600">
                          {item.source || "manual"}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-600 whitespace-nowrap">
                          {formatBankDate(item.updated_at)}
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditEditor(item);
                            }}
                            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </>
          )}
        </section>
      </div>

      {isPassageBankSubject(subject) ? null : (
      <QuestionBankEditorModal
        open={Boolean(editorMode && editorDraft)}
        title={editorMode === "create" ? "Add question" : "Edit question"}
        subject={subject}
        subtitle={
          editorMode === "create"
            ? `${subjectLabel} · new record`
            : `${editingItem?.id || ""}${editingItem?.source ? ` · ${editingItem.source}` : ""}`
        }
        question={editorDraft}
        onChange={(patch) => setEditorDraft((prev) => ({ ...prev, ...patch }))}
        onClose={closeEditor}
        onSave={handleSaveEditor}
        onDelete={editorMode === "create" ? null : handleDeleteEditor}
        saving={saving}
        deleting={deleting}
        saveLabel={editorMode === "create" ? "Save to bank" : "Save changes"}
      />
      )}
    </AppShell>
  );
}
