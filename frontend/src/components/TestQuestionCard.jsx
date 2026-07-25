import { QuestionDifficultyStars } from "./DifficultyStars";
import AreaCombobox from "./AreaCombobox";
import {
  CHOICE_LABELS,
  TEST_TIERS,
  isTestQuestionComplete,
} from "../testBuilderUtils";
import { QUESTION_INDEX_BUTTON_CLASS } from "./rowActionButtonStyles";

export default function TestQuestionCard({
  question,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  removeLabel = "Remove question",
  subject = "",
  areaSuggestions = false,
  readingComprehension = false,
  passages = [],
  hideTier = false,
  tierOptions = TEST_TIERS,
  tierInvalid = false,
}) {
  const complete = isTestQuestionComplete(question);
  const tierLabel = tierOptions.find((tier) => tier.value === Number(question.tier))?.shortLabel;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition"
      >
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">Question {index + 1}</span>
          <span className="block text-sm text-slate-600 truncate mt-0.5">
            {question.prompt.trim() || "No prompt yet"}
            {!hideTier && tierLabel ? (
              <>
                {" · "}
                {tierLabel}
              </>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-2">
          {!hideTier ? <QuestionDifficultyStars stars={question.tier} /> : null}
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
          {!hideTier ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm font-semibold text-slate-800">
                Difficulty tier
                <select
                  value={question.tier}
                  onChange={(e) => onChange({ tier: Number(e.target.value) })}
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white ${
                    tierInvalid ? "border-red-400" : "border-slate-300"
                  }`}
                >
                  {tierOptions.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label} ({tier.weight})
                    </option>
                  ))}
                </select>
                {tierInvalid ? (
                  <p className="text-xs text-red-700 mt-1">This tier is not allowed on this passage.</p>
                ) : null}
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Topic area <span className="font-normal text-slate-500">(optional)</span>
                {areaSuggestions ? (
                  <AreaCombobox
                    subject={subject}
                    value={question.area}
                    onChange={(area) => onChange({ area })}
                    placeholder="e.g. fractions, algebra"
                  />
                ) : (
                  <input
                    type="text"
                    value={question.area}
                    onChange={(e) => onChange({ area: e.target.value })}
                    placeholder="e.g. fractions, algebra"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </label>
            </div>
          ) : (
            <label className="block text-sm font-semibold text-slate-800">
              Topic area <span className="font-normal text-slate-500">(optional)</span>
              {areaSuggestions ? (
                <AreaCombobox
                  subject={subject}
                  value={question.area}
                  onChange={(area) => onChange({ area })}
                  placeholder="e.g. main idea, inference"
                />
              ) : (
                <input
                  type="text"
                  value={question.area}
                  onChange={(e) => onChange({ area: e.target.value })}
                  placeholder="e.g. main idea, inference"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </label>
          )}

          {!hideTier && readingComprehension && passages.length > 0 ? (
            <label className="block text-sm font-semibold text-slate-800">
              Passage
              <select
                value={question.passageId || ""}
                onChange={(e) =>
                  onChange({ passageId: e.target.value || null })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Select a passage…</option>
                {passages.map((passage, passageIndex) => (
                  <option key={passage.id} value={passage.id}>
                    {passage.title?.trim() || `Passage ${passageIndex + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-slate-800">
            Prompt
            <textarea
              value={question.prompt}
              onChange={(e) => onChange({ prompt: e.target.value })}
              rows={3}
              placeholder="What should the student answer?"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm resize-y min-h-[4.5rem]"
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              Choices — mark the correct answer
            </p>
            {CHOICE_LABELS.map((label, choiceIndex) => {
              const selected = Number(question.correctIndex) === choiceIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ correctIndex: choiceIndex })}
                    className={`${QUESTION_INDEX_BUTTON_CLASS} ${
                      selected
                        ? "bg-teal-600 border-teal-700 text-white"
                        : "bg-white border-slate-300 text-slate-500 hover:border-teal-400"
                    }`}
                    title={selected ? "Correct answer" : "Mark as correct"}
                    aria-label={`Mark choice ${label} as correct`}
                    aria-pressed={selected}
                  >
                    {selected ? "✓" : label}
                  </button>
                  <input
                    type="text"
                    value={question.choices[choiceIndex]}
                    onChange={(e) => {
                      const next = [...question.choices];
                      next[choiceIndex] = e.target.value;
                      onChange({ choices: next });
                    }}
                    placeholder={`Choice ${label}`}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              );
            })}
          </div>

          {onRemove ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onRemove}
                className="text-sm font-semibold text-red-700 hover:text-red-900"
              >
                {removeLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
