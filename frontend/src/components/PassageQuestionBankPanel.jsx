import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createQuestionBankItem,
  createQuestionBankPassage,
  deleteQuestionBankItem,
  deleteQuestionBankPassage,
  getQuestionBankPassage,
  listQuestionBank,
  listQuestionBankPassages,
  updateQuestionBankItem,
  updateQuestionBankPassage,
} from "../api";
import QuillLoading from "./QuillLoading";
import QuestionBankEditorModal from "./QuestionBankEditorModal";
import QuestionBankPassageEditorModal from "./QuestionBankPassageEditorModal";
import {
  isPassageDraftComplete,
  passageBankCopy,
  passageHasVisual,
} from "./passageQuestionBankCopy";
import { QuestionDifficultyStars } from "./DifficultyStars";
import {
  TEST_TIERS,
  bankItemToEditorQuestion,
  editorQuestionToBankPayload,
  emptyTestQuestion,
  isTestQuestionComplete,
} from "../testBuilderUtils";

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

function emptyPassageDraft() {
  return { title: "", body: "", chart: null, table: null };
}

function passageDraftToPayload(draft, subject) {
  return {
    subject,
    title: draft.title.trim(),
    body: draft.body.trim(),
    chart: draft.chart ?? null,
    table: draft.table ?? null,
  };
}

function matchesPassageSearch(passage, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [passage.title, passage.id, String(passage.question_count || "")]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesStandaloneSearch(item, query) {
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

export default function PassageQuestionBankPanel({
  subject,
  showStandalone = false,
  onNotice,
  onError,
}) {
  const copy = passageBankCopy(subject);
  const [viewMode, setViewMode] = useState("passages");
  const [passages, setPassages] = useState([]);
  const [passageSearchQuery, setPassageSearchQuery] = useState("");
  const [standaloneSearchQuery, setStandaloneSearchQuery] = useState("");
  const [passageEditorMode, setPassageEditorMode] = useState(null);
  const [passageDraft, setPassageDraft] = useState(emptyPassageDraft());
  const [passageItems, setPassageItems] = useState([]);
  const [standaloneItems, setStandaloneItems] = useState([]);
  const [loadingPassages, setLoadingPassages] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingStandalone, setLoadingStandalone] = useState(false);
  const [savingPassage, setSavingPassage] = useState(false);
  const [deletingPassage, setDeletingPassage] = useState(false);
  const [editorMode, setEditorMode] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  const loadPassages = useCallback(() => {
    setLoadingPassages(true);
    listQuestionBankPassages({ subject })
      .then(setPassages)
      .catch((err) =>
        onError(err.message || `Could not load ${copy.passagePlural}.`),
      )
      .finally(() => setLoadingPassages(false));
  }, [copy.passagePlural, onError, subject]);

  const loadStandalone = useCallback(() => {
    if (!showStandalone) return;
    setLoadingStandalone(true);
    listQuestionBank({ subject, standaloneOnly: true })
      .then(setStandaloneItems)
      .catch((err) => onError(err.message || "Could not load standalone questions."))
      .finally(() => setLoadingStandalone(false));
  }, [onError, showStandalone, subject]);

  useEffect(() => {
    loadPassages();
    loadStandalone();
  }, [loadPassages, loadStandalone]);

  const loadPassageDetail = useCallback(
    (passageId) => {
      if (!passageId || passageId === "create") return;
      setLoadingDetail(true);
      getQuestionBankPassage(passageId)
        .then((data) => {
          setPassageDraft({
            title: data.passage?.title || "",
            body: data.passage?.body || "",
            chart: data.passage?.chart ?? null,
            table: data.passage?.table ?? null,
          });
          setPassageItems(data.items || []);
        })
        .catch((err) => onError(err.message || "Could not load passage."))
        .finally(() => setLoadingDetail(false));
    },
    [onError],
  );

  useEffect(() => {
    if (passageEditorMode && passageEditorMode !== "create") {
      loadPassageDetail(passageEditorMode);
    }
  }, [passageEditorMode, loadPassageDetail]);

  const editingPassage = useMemo(
    () =>
      passageEditorMode && passageEditorMode !== "create"
        ? passages.find((p) => p.id === passageEditorMode) || null
        : null,
    [passageEditorMode, passages],
  );

  const filteredPassages = useMemo(() => {
    if (!passageSearchQuery.trim()) return passages;
    return passages.filter((passage) => matchesPassageSearch(passage, passageSearchQuery));
  }, [passages, passageSearchQuery]);

  const filteredStandaloneItems = useMemo(() => {
    if (!standaloneSearchQuery.trim()) return standaloneItems;
    return standaloneItems.filter((item) =>
      matchesStandaloneSearch(item, standaloneSearchQuery),
    );
  }, [standaloneItems, standaloneSearchQuery]);

  function openCreatePassage() {
    setPassageEditorMode("create");
    setPassageDraft(emptyPassageDraft());
    setPassageItems([]);
    onError("");
  }

  function openEditPassage(passageId) {
    setPassageEditorMode(passageId);
    onError("");
  }

  function closePassageEditor() {
    setPassageEditorMode(null);
    setPassageDraft(emptyPassageDraft());
    setPassageItems([]);
  }

  async function handleSavePassage() {
    if (!isPassageDraftComplete(passageDraft, subject)) {
      onError(
        subject === "data" && copy.saveValidationHint
          ? copy.saveValidationHint
          : `${copy.titleField} and ${copy.bodyField.toLowerCase()} are required.`,
      );
      return;
    }
    const payload = passageDraftToPayload(passageDraft, subject);
    setSavingPassage(true);
    onError("");
    try {
      if (passageEditorMode === "create") {
        const created = await createQuestionBankPassage(payload);
        setPassages((prev) => [created, ...prev]);
        setPassageEditorMode(created.id);
        setPassageDraft({
          title: created.title || payload.title,
          body: created.body || payload.body,
          chart: created.chart ?? payload.chart,
          table: created.table ?? payload.table,
        });
        onNotice(`${copy.passageSingular[0].toUpperCase()}${copy.passageSingular.slice(1)} created.`);
      } else if (passageEditorMode) {
        const saved = await updateQuestionBankPassage(passageEditorMode, payload);
        setPassages((prev) =>
          prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)),
        );
        setPassageDraft({
          title: saved.title || payload.title,
          body: saved.body || payload.body,
          chart: saved.chart ?? payload.chart,
          table: saved.table ?? payload.table,
        });
        onNotice(`${copy.passageSingular[0].toUpperCase()}${copy.passageSingular.slice(1)} saved.`);
      }
    } catch (err) {
      onError(err.message || "Could not save passage.");
    } finally {
      setSavingPassage(false);
    }
  }

  async function handleDeletePassage() {
    if (!passageEditorMode || passageEditorMode === "create") return;
    const label = passageDraft.title.trim() || passageEditorMode;
    const ok = window.confirm(
      `Delete ${copy.passageSingular} “${label}” and all of its questions? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingPassage(true);
    onError("");
    try {
      await deleteQuestionBankPassage(passageEditorMode);
      setPassages((prev) => prev.filter((p) => p.id !== passageEditorMode));
      closePassageEditor();
      onNotice(`${copy.passageSingular[0].toUpperCase()}${copy.passageSingular.slice(1)} deleted.`);
    } catch (err) {
      onError(err.message || "Could not delete passage.");
    } finally {
      setDeletingPassage(false);
    }
  }

  function openCreateQuestion() {
    if (!passageEditorMode || passageEditorMode === "create") {
      onError(`Save the ${copy.passageSingular} before adding questions.`);
      return;
    }
    setEditorMode("create");
    setEditorDraft(emptyTestQuestion(2));
  }

  function openEditQuestion(item) {
    setEditorMode(item.id);
    setEditorDraft(bankItemToEditorQuestion(item));
  }

  function closeQuestionEditor() {
    setEditorMode(null);
    setEditorDraft(null);
  }

  async function handleSaveQuestion() {
    if (!editorDraft || !isTestQuestionComplete(editorDraft)) {
      onError("Complete all fields before saving.");
      return;
    }
    const passageId =
      viewMode === "passages" && passageEditorMode && passageEditorMode !== "create"
        ? passageEditorMode
        : null;
    setSavingQuestion(true);
    onError("");
    try {
      if (editorMode === "create") {
        const created = await createQuestionBankItem(
          editorQuestionToBankPayload(editorDraft, subject, passageId),
        );
        if (!created.duplicate) {
          if (passageId) {
            setPassageItems((prev) => [created, ...prev]);
            setPassages((prev) =>
              prev.map((p) =>
                p.id === passageId
                  ? { ...p, question_count: (p.question_count || 0) + 1 }
                  : p,
              ),
            );
          } else {
            setStandaloneItems((prev) => [created, ...prev]);
          }
          onNotice("Question added to bank.");
        }
      } else {
        const saved = await updateQuestionBankItem(
          editorMode,
          editorQuestionToBankPayload(editorDraft, subject, passageId),
        );
        if (passageId) {
          setPassageItems((prev) =>
            prev.map((item) => (item.id === editorMode ? saved : item)),
          );
        } else {
          setStandaloneItems((prev) =>
            prev.map((item) => (item.id === editorMode ? saved : item)),
          );
        }
        onNotice("Question saved.");
      }
      closeQuestionEditor();
    } catch (err) {
      onError(err.message || "Could not save question.");
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteQuestion() {
    if (editorMode === "create" || !editorMode) return;
    const preview = editorDraft?.prompt?.trim() || editorMode;
    const ok = window.confirm(
      `Delete “${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}”?`,
    );
    if (!ok) return;
    setDeletingQuestion(true);
    onError("");
    try {
      await deleteQuestionBankItem(editorMode);
      if (passageEditorMode && passageEditorMode !== "create") {
        setPassageItems((prev) => prev.filter((item) => item.id !== editorMode));
        setPassages((prev) =>
          prev.map((p) =>
            p.id === passageEditorMode
              ? { ...p, question_count: Math.max(0, (p.question_count || 1) - 1) }
              : p,
          ),
        );
      } else {
        setStandaloneItems((prev) => prev.filter((item) => item.id !== editorMode));
      }
      onNotice("Question deleted.");
      closeQuestionEditor();
    } catch (err) {
      onError(err.message || "Could not delete question.");
    } finally {
      setDeletingQuestion(false);
    }
  }

  function openStandaloneCreate() {
    setEditorMode("create");
    setEditorDraft(emptyTestQuestion(2));
  }

  const questionEditorModal = (
    <QuestionBankEditorModal
      open={Boolean(editorMode && editorDraft)}
      title={editorMode === "create" ? "Add question" : "Edit question"}
      subject={subject}
      subtitle={
        viewMode === "passages" && editingPassage
          ? `${editingPassage.title} · ${copy.questionSubtitle}`
          : copy.standaloneQuestionSubtitle || "Standalone question"
      }
      question={editorDraft}
      onChange={(patch) => setEditorDraft((prev) => ({ ...prev, ...patch }))}
      onClose={closeQuestionEditor}
      onSave={handleSaveQuestion}
      onDelete={editorMode === "create" ? null : handleDeleteQuestion}
      saving={savingQuestion}
      deleting={deletingQuestion}
      saveLabel={editorMode === "create" ? "Save to bank" : "Save changes"}
    />
  );

  const activePassageView = !showStandalone || viewMode === "passages";

  return (
    <div className="space-y-4">
      {showStandalone ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode("passages");
              closePassageEditor();
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === "passages"
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Reading comprehension
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("standalone");
              closePassageEditor();
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === "standalone"
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Standalone
          </button>
        </div>
      ) : null}

      {activePassageView ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {filteredPassages.length} of {passages.length}{" "}
              {passages.length === 1 ? copy.passageSingular : copy.passagePlural}
            </p>
            <button
              type="button"
              onClick={openCreatePassage}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-sm font-semibold transition"
            >
              {copy.addLabel}
            </button>
          </div>

          <input
            type="search"
            value={passageSearchQuery}
            onChange={(e) => setPassageSearchQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="w-full max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />

          {loadingPassages ? (
            <QuillLoading label={`Loading ${copy.passagePlural}…`} />
          ) : filteredPassages.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center border border-dashed border-slate-200 rounded-xl">
              {passages.length === 0 ? copy.emptyList : `No ${copy.passagePlural} match your search.`}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold w-[46%]">
                      {copy.passageSingular[0].toUpperCase()}
                      {copy.passageSingular.slice(1)}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-28">
                      Questions
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-32">
                      Updated
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold w-20 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPassages.map((passage) => (
                    <tr
                      key={passage.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => openEditPassage(passage.id)}
                    >
                      <td className="px-4 py-3 align-middle max-w-0">
                        <p
                          className="text-slate-900 truncate font-medium"
                          title={passage.title?.trim() || undefined}
                        >
                          {passage.title?.trim() || `Untitled ${copy.passageSingular}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {passageHasVisual(passage) ? (
                            <span className="mr-2">📊 Chart or table</span>
                          ) : null}
                          <span className="font-mono text-slate-400" title={passage.id}>
                            {passage.id}
                          </span>
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">
                        {passage.question_count || 0}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600 whitespace-nowrap">
                        {formatBankDate(passage.updated_at)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditPassage(passage.id);
                          }}
                          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <QuestionBankPassageEditorModal
            open={Boolean(passageEditorMode)}
            subject={subject}
            copy={copy}
            title={
              passageEditorMode === "create" ? copy.addModalTitle : copy.editModalTitle
            }
            subtitle={
              passageEditorMode === "create"
                ? `${subject} · new ${copy.passageSingular}`
                : `${editingPassage?.id || ""}`
            }
            passageDraft={passageDraft}
            onPassageChange={(patch) =>
              setPassageDraft((prev) => ({ ...prev, ...patch }))
            }
            passageItems={passageItems}
            loadingDetail={loadingDetail}
            savingPassage={savingPassage}
            deletingPassage={deletingPassage}
            isNew={passageEditorMode === "create"}
            onClose={closePassageEditor}
            onSavePassage={handleSavePassage}
            onDeletePassage={handleDeletePassage}
            onAddQuestion={openCreateQuestion}
            onEditQuestion={openEditQuestion}
            questionEditor={questionEditorModal}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {filteredStandaloneItems.length} of {standaloneItems.length} standalone question
              {standaloneItems.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={openStandaloneCreate}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-sm font-semibold transition"
            >
              + Add question
            </button>
          </div>

          <input
            type="search"
            value={standaloneSearchQuery}
            onChange={(e) => setStandaloneSearchQuery(e.target.value)}
            placeholder="Search questions, area, choices…"
            className="w-full max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />

          {loadingStandalone ? (
            <QuillLoading label="Loading questions…" />
          ) : standaloneItems.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center border border-dashed border-slate-200 rounded-xl">
              No standalone English questions yet.
            </p>
          ) : filteredStandaloneItems.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center border border-dashed border-slate-200 rounded-xl">
              No standalone questions match your search.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                    <th scope="col" className="px-4 py-3 font-semibold w-20 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStandaloneItems.map((item) => {
                    const tier = TEST_TIERS.find((t) => t.value === Number(item.stars));
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                        onClick={() => openEditQuestion(item)}
                      >
                        <td className="px-4 py-3 align-middle max-w-0">
                          <p className="text-slate-900 truncate">{item.prompt?.trim() || "—"}</p>
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
                        <td className="px-4 py-3 align-top text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditQuestion(item);
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

          {questionEditorModal}
        </>
      )}
    </div>
  );
}
