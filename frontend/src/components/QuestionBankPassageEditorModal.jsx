import QuillLoading from "./QuillLoading";
import QuestionBankEditorModal from "./QuestionBankEditorModal";
import { QuestionDifficultyStars } from "./DifficultyStars";
import { TEST_TIERS } from "../testBuilderUtils";

export default function QuestionBankPassageEditorModal({
  open,
  title,
  subtitle = "",
  copy,
  passageDraft,
  onPassageChange,
  passageItems = [],
  loadingDetail = false,
  savingPassage = false,
  deletingPassage = false,
  isNew = false,
  onClose,
  onSavePassage,
  onDeletePassage,
  onAddQuestion,
  onEditQuestion,
  questionEditor,
}) {
  if (!open || !copy) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-slate-900/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passage-editor-title"
      >
        <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h2 id="passage-editor-title" className="text-lg font-bold text-slate-900">
                {title}
              </h2>
              {subtitle ? (
                <p className="text-sm text-slate-600 mt-0.5 truncate">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-800">
                {copy.titleField}
                <input
                  type="text"
                  value={passageDraft.title}
                  onChange={(e) => onPassageChange({ title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder={copy.titlePlaceholder}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                {copy.bodyField}
                <textarea
                  value={passageDraft.body}
                  onChange={(e) => onPassageChange({ body: e.target.value })}
                  rows={10}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed resize-y min-h-[12rem]"
                  placeholder={copy.bodyPlaceholder}
                />
              </label>
            </div>

            {!isNew ? (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Questions ({passageItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={onAddQuestion}
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
                      <tbody className="divide-y divide-slate-100">
                        {passageItems.map((item) => {
                          const tier = TEST_TIERS.find((t) => t.value === Number(item.stars));
                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/80 transition cursor-pointer"
                              onClick={() => onEditQuestion(item)}
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
                                    onEditQuestion(item);
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
            ) : (
              <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-3">
                {copy.saveBeforeQuestions}
              </p>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div>
              {!isNew ? (
                <button
                  type="button"
                  onClick={onDeletePassage}
                  disabled={deletingPassage}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingPassage ? "Deleting…" : copy.deleteLabel}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSavePassage}
                disabled={savingPassage}
                className="rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition"
              >
                {savingPassage
                  ? "Saving…"
                  : isNew
                    ? copy.saveNewLabel
                    : copy.saveExistingLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {questionEditor}
    </>
  );
}
