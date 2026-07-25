import { useState } from "react";
import { DifficultyStars, QuestionDifficultyStars } from "./DifficultyStars";
import {
  buildManualFocusPracticePayload,
  CHOICE_LABELS,
  emptyFocusPracticeQuestion,
  FOCUS_PRACTICE_STAR_OPTIONS,
  isFocusPracticeQuestionComplete,
  validateFocusPracticeBuilder,
} from "../focusPracticeBuilderUtils";
import { QUESTION_INDEX_BUTTON_CLASS } from "./rowActionButtonStyles";

function McqChoices({ question, index, onChange }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-600">
        Choices — mark the correct answer
      </p>
      {CHOICE_LABELS.map((label, choiceIndex) => {
        const selected = question.correctIndex === choiceIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(index, { correctIndex: choiceIndex })}
              className={`${QUESTION_INDEX_BUTTON_CLASS} ${
                selected
                  ? "bg-emerald-600 border-emerald-700 text-white"
                  : "bg-white border-slate-300 text-slate-500 hover:border-emerald-400"
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
                onChange(index, { choices: next });
              }}
              placeholder={`Choice ${label}`}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        );
      })}
    </div>
  );
}

function BuilderQuestionCard({ question, index, onChange, onRemove, canRemove }) {
  const complete = isFocusPracticeQuestionComplete(question);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-900">
              Question {index + 1}
            </span>
            <span
              className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${
                complete
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-900 border-amber-200"
              }`}
            >
              {complete ? "Complete" : "Incomplete"}
            </span>
          </div>
          <label className="block text-sm font-semibold text-slate-800">
            Prompt
            <textarea
              value={question.prompt}
              onChange={(e) => onChange(index, { prompt: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
              placeholder="Enter the question text"
            />
          </label>
        </div>
        <QuestionDifficultyStars stars={question.stars} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-600">Difficulty</span>
        {FOCUS_PRACTICE_STAR_OPTIONS.map((option) => {
          const selected = question.stars === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange(index, {
                  stars: option.value,
                  ...(option.value < 3
                    ? { hintEnabled: false, hintContext: "" }
                    : {}),
                })
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                selected
                  ? "bg-indigo-100 border-indigo-300 text-indigo-900"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <McqChoices question={question} index={index} onChange={onChange} />

      {question.stars >= 3 ? (
      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(question.hintEnabled)}
            onChange={(e) =>
              onChange(index, {
                hintEnabled: e.target.checked,
                hintContext: e.target.checked ? question.hintContext : "",
              })
            }
            className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-slate-800 leading-relaxed">
            <span className="font-semibold">Include hint</span>
            <span className="block text-xs text-slate-600 mt-1">
              Optional guidance shown when the student asks for help — especially
              useful for harder questions.
            </span>
          </span>
        </label>
        {question.hintEnabled ? (
          <label className="block mt-3 text-sm font-semibold text-slate-800">
            Hint text
            <textarea
              value={question.hintContext}
              onChange={(e) => onChange(index, { hintContext: e.target.value })}
              rows={3}
              placeholder="Nudge the student without giving away the answer…"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 leading-relaxed focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-y"
            />
          </label>
        ) : null}
      </div>
      ) : null}

      {canRemove ? (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="mt-4 text-xs font-semibold text-red-700 hover:text-red-900 hover:underline"
        >
          Remove question
        </button>
      ) : null}
    </div>
  );
}

/** Manual focus practice builder — one question to start, + to add more. */
export default function FocusPracticeBuilder({
  subject,
  subjectLabel,
  focusArea,
  focusAreaLabel,
  grade = null,
  onSave,
  onCancel,
  saving = false,
}) {
  const defaultTitle = `Focus practice: ${focusAreaLabel || focusArea}`;
  const [title, setTitle] = useState(defaultTitle);
  const [questions, setQuestions] = useState([emptyFocusPracticeQuestion(2)]);
  const [errors, setErrors] = useState([]);

  function handleChangeQuestion(index, patch) {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    );
  }

  function handleAddQuestion() {
    setQuestions((prev) => [...prev, emptyFocusPracticeQuestion(2)]);
  }

  function handleRemoveQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const validationErrors = validateFocusPracticeBuilder({ title, questions });
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    const payload = buildManualFocusPracticePayload({
      subject,
      area: focusArea,
      grade,
      title,
      questions,
    });
    await onSave(payload);
  }

  const starValues = questions.map((q) => q.stars);
  const difficultyMin = Math.min(...starValues);
  const difficultyMax = Math.max(...starValues);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Manual practice builder
        </p>
        <label className="block mt-2">
          <span className="text-sm font-semibold text-slate-800">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-3">
          <p className="text-indigo-500 capitalize">
            {subjectLabel || subject}
            {focusAreaLabel ? ` · ${focusAreaLabel}` : ""}
          </p>
          <span className="text-slate-500 text-xs font-semibold rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </span>
          <DifficultyStars min={difficultyMin} max={difficultyMax} size="lg" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {questions.map((question, index) => (
          <BuilderQuestionCard
            key={index}
            question={question}
            index={index}
            onChange={handleChangeQuestion}
            onRemove={handleRemoveQuestion}
            canRemove={questions.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-800 hover:bg-indigo-50/40 transition flex items-center justify-center gap-2"
        >
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 text-lg leading-none"
            aria-hidden="true"
          >
            +
          </span>
          Add question
        </button>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 flex flex-col gap-3">
        {errors.length > 0 ? (
          <ul className="text-sm text-red-700 list-disc pl-5 space-y-0.5">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 text-sm transition"
          >
            {saving ? "Saving…" : "Save to Revision"}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-semibold px-5 py-2.5 text-sm transition"
            >
              Cancel
            </button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Saved worksheets appear on the student&apos;s Revision page.
        </p>
      </div>
    </div>
  );
}
