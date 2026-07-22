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
  });
}

function emptyPassageDraft() {
  return { title: "", body: "" };
}

export default function EnglishQuestionBankPanel({
  onNotice,
  onError,
}) {
  const [englishMode, setEnglishMode] = useState("passages");
  const [passages, setPassages] = useState([]);
  const [selectedPassageId, setSelectedPassageId] = useState(null);
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
    listQuestionBankPassages({ subject: "english" })
      .then((rows) => {
        setPassages(rows);
        if (rows.length === 0) {
          setSelectedPassageId(null);
          setPassageDraft(emptyPassageDraft());
          setPassageItems([]);
        }
      })
      .catch((err) => onError(err.message || "Could not load passages."))
      .finally(() => setLoadingPassages(false));
  }, [onError]);

  const loadStandalone = useCallback(() => {
    setLoadingStandalone(true);
    listQuestionBank({ subject: "english", standaloneOnly: true })
      .then(setStandaloneItems)
      .catch((err) => onError(err.message || "Could not load standalone questions."))
      .finally(() => setLoadingStandalone(false));
  }, [onError]);

  useEffect(() => {
    loadPassages();
    loadStandalone();
  }, [loadPassages, loadStandalone]);

  const loadPassageDetail = useCallback(
    (passageId) => {
      if (!passageId) return;
      setLoadingDetail(true);
      getQuestionBankPassage(passageId)
        .then((data) => {
          setPassageDraft({
            title: data.passage?.title || "",
            body: data.passage?.body || "",
          });
          setPassageItems(data.items || []);
        })
        .catch((err) => onError(err.message || "Could not load passage."))
        .finally(() => setLoadingDetail(false));
    },
    [onError],
  );

  useEffect(() => {
    if (selectedPassageId) {
      loadPassageDetail(selectedPassageId);
    }
  }, [selectedPassageId, loadPassageDetail]);

  const selectedPassage = useMemo(
    () => passages.find((p) => p.id === selectedPassageId) || null,
    [passages, selectedPassageId],
  );

  function startNewPassage() {
    setSelectedPassageId("new");
    setPassageDraft(emptyPassageDraft());
    setPassageItems([]);
    onError("");
  }

  function selectPassage(passageId) {
    setSelectedPassageId(passageId);
    onError("");
  }

  async function handleSavePassage() {
    const title = passageDraft.title.trim();
    const body = passageDraft.body.trim();
    if (!title || !body) {
      onError("Passage title and text are required.");
      return;
    }
    setSavingPassage(true);
    onError("");
    try {
      if (selectedPassageId === "new") {
        const created = await createQuestionBankPassage({
          subject: "english",
          title,
          body,
        });
        setPassages((prev) => [created, ...prev]);
        setSelectedPassageId(created.id);
        onNotice("Passage created.");
      } else if (selectedPassageId) {
        const saved = await updateQuestionBankPassage(selectedPassageId, {
          subject: "english",
          title,
          body,
        });
        setPassages((prev) =>
          prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)),
        );
        onNotice("Passage saved.");
      }
    } catch (err) {
      onError(err.message || "Could not save passage.");
    } finally {
      setSavingPassage(false);
    }
  }

  async function handleDeletePassage() {
    if (!selectedPassageId || selectedPassageId === "new") return;
    const label = passageDraft.title.trim() || selectedPassageId;
    const ok = window.confirm(
      `Delete passage “${label}” and all of its questions? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingPassage(true);
    onError("");
    try {
      await deleteQuestionBankPassage(selectedPassageId);
      setPassages((prev) => prev.filter((p) => p.id !== selectedPassageId));
      setSelectedPassageId(null);
      setPassageDraft(emptyPassageDraft());
      setPassageItems([]);
      onNotice("Passage deleted.");
    } catch (err) {
      onError(err.message || "Could not delete passage.");
    } finally {
      setDeletingPassage(false);
    }
  }

  function openCreateQuestion() {
    if (!selectedPassageId || selectedPassageId === "new") {
      onError("Save the passage before adding questions.");
      return;
    }
    setEditorMode("create");
    setEditorDraft(emptyTestQuestion(2));
  }

  function openEditQuestion(item) {
    setEditorMode(item.id);
    setEditorDraft(bankItemToEditorQuestion(item));
  }

  function closeEditor() {
    setEditorMode(null);
    setEditorDraft(null);
  }

  async function handleSaveQuestion() {
    if (!editorDraft || !isTestQuestionComplete(editorDraft)) {
      onError("Complete all fields before saving.");
      return;
    }
    const passageId =
      englishMode === "passages" && selectedPassageId !== "new"
        ? selectedPassageId
        : null;
    setSavingQuestion(true);
    onError("");
    try {
      if (editorMode === "create") {
        const created = await createQuestionBankItem(
          editorQuestionToBankPayload(editorDraft, "english", passageId),
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
          editorQuestionToBankPayload(editorDraft, "english", passageId),
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
      closeEditor();
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
      if (selectedPassageId && selectedPassageId !== "new") {
        setPassageItems((prev) => prev.filter((item) => item.id !== editorMode));
        setPassages((prev) =>
          prev.map((p) =>
            p.id === selectedPassageId
              ? { ...p, question_count: Math.max(0, (p.question_count || 1) - 1) }
              : p,
          ),
        );
      } else {
        setStandaloneItems((prev) => prev.filter((item) => item.id !== editorMode));
      }
      onNotice("Question deleted.");
      closeEditor();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEnglishMode("passages")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            englishMode === "passages"
              ? "bg-sky-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Reading comprehension
        </button>
        <button
          type="button"
          onClick={() => setEnglishMode("standalone")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            englishMode === "standalone"
              ? "bg-sky-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Standalone
        </button>
      </div>

      {englishMode === "passages" ? (
        <div className="grid lg:grid-cols-[minmax(14rem,18rem)_1fr] gap-5 items-start">
          <aside className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Passages</h3>
              <button
                type="button"
                onClick={startNewPassage}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                + New
              </button>
            </div>
            {loadingPassages ? (
              <div className="p-4">
                <QuillLoading label="Loading passages…" />
              </div>
            ) : passages.length === 0 && selectedPassageId !== "new" ? (
              <p className="text-sm text-slate-500 px-4 py-8 text-center">
                No passages yet. Create one to start building RC questions.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
                {passages.map((passage) => (
                  <button
                    key={passage.id}
                    type="button"
                    onClick={() => selectPassage(passage.id)}
                    className={`w-full text-left px-4 py-3 transition ${
                      selectedPassageId === passage.id
                        ? "bg-sky-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {passage.title || "Untitled passage"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {passage.question_count || 0} question
                      {(passage.question_count || 0) === 1 ? "" : "s"}
                      {passage.updated_at ? ` · ${formatBankDate(passage.updated_at)}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {!selectedPassageId ? (
              <p className="text-sm text-slate-500 px-5 py-16 text-center">
                Select a passage or create a new one.
              </p>
            ) : (
              <>
                <div className="p-5 border-b border-slate-100 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {selectedPassageId === "new"
                          ? "New passage"
                          : selectedPassage?.title || "Passage"}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Questions belong to this passage context.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPassageId !== "new" ? (
                        <button
                          type="button"
                          onClick={handleDeletePassage}
                          disabled={deletingPassage}
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingPassage ? "Deleting…" : "Delete passage"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleSavePassage}
                        disabled={savingPassage}
                        className="rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-semibold transition"
                      >
                        {savingPassage ? "Saving…" : "Save passage"}
                      </button>
                    </div>
                  </div>

                  <label className="block text-sm font-semibold text-slate-800">
                    Passage title
                    <input
                      type="text"
                      value={passageDraft.title}
                      onChange={(e) =>
                        setPassageDraft((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. Life in the Arctic"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-800">
                    Passage text
                    <textarea
                      value={passageDraft.body}
                      onChange={(e) =>
                        setPassageDraft((prev) => ({ ...prev, body: e.target.value }))
                      }
                      rows={10}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed resize-y min-h-[12rem]"
                      placeholder="Paste or type the reading passage."
                    />
                  </label>
                </div>

                {selectedPassageId !== "new" ? (
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-bold text-slate-900">
                        Questions ({passageItems.length})
                      </h4>
                      <button
                        type="button"
                        onClick={openCreateQuestion}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        + Add question
                      </button>
                    </div>

                    {loadingDetail ? (
                      <QuillLoading label="Loading questions…" />
                    ) : passageItems.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        No questions for this passage yet.
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
                              <th scope="col" className="px-4 py-3 font-semibold w-20 text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {passageItems.map((item) => {
                              const tier = TEST_TIERS.find(
                                (t) => t.value === Number(item.stars),
                              );
                              return (
                                <tr
                                  key={item.id}
                                  className="hover:bg-slate-50/80 transition cursor-pointer"
                                  onClick={() => openEditQuestion(item)}
                                >
                                  <td className="px-4 py-3 align-middle max-w-0">
                                    <p className="text-slate-900 truncate">
                                      {item.prompt?.trim() || "—"}
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
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">Standalone questions</h3>
              <p className="text-sm text-slate-600 mt-0.5">
                Critical reasoning and other English questions without a passage.
              </p>
            </div>
            <button
              type="button"
              onClick={openStandaloneCreate}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-sm font-semibold transition"
            >
              + Add question
            </button>
          </div>

          {loadingStandalone ? (
            <div className="p-8">
              <QuillLoading label="Loading questions…" />
            </div>
          ) : standaloneItems.length === 0 ? (
            <p className="text-sm text-slate-500 px-5 py-12 text-center">
              No standalone English questions yet.
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
                    <th scope="col" className="px-4 py-3 font-semibold w-20 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {standaloneItems.map((item) => {
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
        </section>
      )}

      <QuestionBankEditorModal
        open={Boolean(editorMode && editorDraft)}
        title={editorMode === "create" ? "Add question" : "Edit question"}
        subject="english"
        subtitle={
          englishMode === "passages" && selectedPassage
            ? `${selectedPassage.title} · passage question`
            : "Standalone English question"
        }
        question={editorDraft}
        onChange={(patch) => setEditorDraft((prev) => ({ ...prev, ...patch }))}
        onClose={closeEditor}
        onSave={handleSaveQuestion}
        onDelete={editorMode === "create" ? null : handleDeleteQuestion}
        saving={savingQuestion}
        deleting={deletingQuestion}
        saveLabel={editorMode === "create" ? "Save to bank" : "Save changes"}
      />
    </div>
  );
}
