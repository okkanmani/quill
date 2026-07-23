import { QuestionDifficultyStars } from "./DifficultyStars";
import WorksheetPassageContent from "./WorksheetPassageContent";
import TestQuestionCard from "./TestQuestionCard";
import { isTestPassageComplete, isTestQuestionComplete, TEST_TIERS } from "../testBuilderUtils";

export default function TestPassageCard({
  passage,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  removeLabel,
  passageMode = "rc",
  passageQuestions = [],
  expandedQuestionIds = new Set(),
  onToggleQuestion,
  onChangeQuestion,
  onRemoveQuestion,
  onAddQuestion,
  subject = "",
  areaSuggestions = false,
  fixedQuestionCount = null,
}) {
  const isDataMode = passageMode === "data";
  const unitLabel = isDataMode ? "Data set" : "Passage";
  const targetCount = Number(fixedQuestionCount) || 0;
  const passageComplete = isTestPassageComplete(passage, passageMode);
  const questionsComplete =
    targetCount > 0
      ? passageQuestions.length === targetCount &&
        passageQuestions.every((question) => isTestQuestionComplete(question))
      : passageQuestions.length > 0 &&
        passageQuestions.every((question) => isTestQuestionComplete(question));
  const complete = passageComplete && questionsComplete;
  const summary = passage.title.trim() || `${unitLabel} ${index + 1}`;
  const tierLabel = TEST_TIERS.find((tier) => tier.value === Number(passage.tier))?.shortLabel;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-sky-50 hover:bg-sky-100 transition"
      >
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">
            {unitLabel} {index + 1}
          </span>
          <span className="block text-sm text-slate-600 truncate mt-0.5">
            {summary}
            {tierLabel ? ` · ${tierLabel}` : ""}
            {passageQuestions.length
              ? ` · ${passageQuestions.length} question${passageQuestions.length === 1 ? "" : "s"}`
              : ""}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-2">
          <QuestionDifficultyStars stars={passage.tier} />
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${
              complete
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            {complete ? "Complete" : "Incomplete"}
          </span>
          <span className="text-slate-700 font-bold text-sm">{expanded ? "▼" : "▶"}</span>
        </span>
      </button>

      {expanded ? (
        <div className="p-4 border-t border-slate-100 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-slate-800">
              Difficulty tier
              <select
                value={passage.tier ?? 2}
                onChange={(e) => onChange({ tier: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {TEST_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label} ({tier.weight})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              Title
              <input
                type="text"
                value={passage.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder={
                  isDataMode ? "e.g. Fruit sales at the market" : "e.g. The Lighthouse Keeper"
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-800">
            {isDataMode ? (
              <>
                Caption <span className="font-normal text-slate-500">(optional)</span>
              </>
            ) : (
              "Passage text"
            )}
            <textarea
              value={passage.body}
              onChange={(e) => onChange({ body: e.target.value })}
              rows={isDataMode ? 3 : 8}
              placeholder={
                isDataMode
                  ? "Short intro shown above the chart or table."
                  : "Paste or type the reading passage students will refer to."
              }
              className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm resize-y leading-relaxed ${
                isDataMode ? "min-h-[5rem]" : "min-h-[10rem]"
              }`}
            />
          </label>

          {isDataMode && !passage.chart?.type && !passage.table?.headers?.length ? (
            <p className="text-xs text-slate-600 rounded-xl border border-dashed border-slate-200 px-3 py-2">
              Chart or table required — use Generate data sets, import from the bank, or add
              questions linked to a bank data set.
            </p>
          ) : null}

          {passageComplete ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Preview
              </p>
              <WorksheetPassageContent passage={passage} embedded />
            </div>
          ) : null}

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Questions for this {isDataMode ? "data set" : "passage"}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {targetCount > 0
                    ? `Exactly ${targetCount} questions inherit this ${isDataMode ? "data set's" : "passage's"} tier (${tierLabel || "unset"}).`
                    : `All questions inherit this ${isDataMode ? "data set's" : "passage's"} tier (${tierLabel || "unset"}).`}
                </p>
              </div>
              {targetCount > 0 ? null : (
                <button
                  type="button"
                  onClick={() => onAddQuestion?.()}
                  className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition"
                >
                  + Add question
                </button>
              )}
            </div>

            {passageQuestions.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
                {targetCount > 0
                  ? `This ${isDataMode ? "data set" : "passage"} needs ${targetCount} questions — adjust questions per ${isDataMode ? "data set" : "passage"} above if needed.`
                  : "No questions yet — use the button above to add one."}
              </p>
            ) : (
              <div className="space-y-3">
                {passageQuestions.map((question, questionIndex) => (
                  <TestQuestionCard
                    key={question.id}
                    question={question}
                    index={questionIndex}
                    expanded={expandedQuestionIds.has(question.id)}
                    onToggle={() => onToggleQuestion?.(question.id)}
                    onChange={(patch) => onChangeQuestion?.(question.id, patch)}
                    onRemove={
                      targetCount > 0 ? null : () => onRemoveQuestion?.(question.id)
                    }
                    subject={subject}
                    areaSuggestions={areaSuggestions}
                    hideTier
                  />
                ))}
              </div>
            )}
          </div>

          {onRemove ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onRemove}
                className="text-sm font-semibold text-red-700 hover:text-red-900"
              >
                {removeLabel || (isDataMode ? "Remove data set" : "Remove passage")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
