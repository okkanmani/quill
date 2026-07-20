import TestQuestionCard from "./TestQuestionCard";
import { isTestQuestionComplete } from "../testBuilderUtils";

export default function QuestionBankEditorModal({
  open,
  title,
  subtitle = "",
  question,
  onChange,
  onClose,
  onSave,
  onDelete,
  saving = false,
  deleting = false,
  saveLabel = "Save changes",
}) {
  if (!open || !question) return null;

  const complete = isTestQuestionComplete(question);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-bank-editor-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="question-bank-editor-title" className="text-lg font-bold text-slate-900">
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

        <div className="flex-1 overflow-y-auto p-5">
          <TestQuestionCard
            question={question}
            index={0}
            expanded
            onToggle={() => {}}
            onChange={onChange}
            onRemove={onDelete}
            removeLabel={deleting ? "Deleting…" : "Delete from bank"}
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !complete}
            className="rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition"
          >
            {saving ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
