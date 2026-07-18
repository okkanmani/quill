import { useState } from "react";
import { DifficultyStars, QuestionDifficultyStars } from "./DifficultyStars";

export default function FocusPracticeWorksheet({
  worksheet,
  variant = "preview",
  onComplete,
}) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);

  if (!worksheet) return null;

  const questions = worksheet.questions || [];

  function handleSelect(questionId, choice) {
    if (checked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: choice }));
  }

  async function handleCheckAnswers() {
    setChecked(true);
    if (onComplete) {
      let score = 0;
      const answerRows = [];
      for (const question of questions) {
        const selected = answers[question.id] || "";
        const expected = (question.answer || "").trim();
        const correct =
          Boolean(selected) &&
          selected.trim().toLowerCase() === expected.toLowerCase();
        if (correct) score += 1;
        answerRows.push({
          question_id: question.id,
          prompt: question.prompt,
          given: selected,
          expected,
          correct,
          choices: question.choices || [],
          area: question.area || worksheet.focus_area || "",
        });
      }
      onComplete({ score, total: questions.length, answers: answerRows });
    }
  }

  function handleReset() {
    setAnswers({});
    setChecked(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          {variant === "revision" ? "Revision practice" : "Focus practice · not published"}
        </p>
        <h2 className="text-xl font-semibold text-slate-950 mt-1">{worksheet.title}</h2>
        {worksheet.subtitle ? (
          <p className="text-sm text-slate-600 mt-1">{worksheet.subtitle}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-3">
          <p className="text-indigo-500 capitalize">
            {worksheet.subject_label || worksheet.subject}
            {worksheet.focus_area_label ? ` · ${worksheet.focus_area_label}` : ""}
          </p>
          <span className="text-slate-500 text-xs font-semibold rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5">
            {questions.length} questions · 2–3★
          </span>
          {worksheet.mock ? (
            <span className="text-amber-800 text-xs font-semibold rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5">
              Preview worksheet
            </span>
          ) : worksheet.manual ? (
            <span className="text-violet-800 text-xs font-semibold rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5">
              Manual
            </span>
          ) : (
            <span className="text-indigo-800 text-xs font-semibold rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5">
              AI generated
            </span>
          )}
          <DifficultyStars
            min={worksheet.difficulty_min}
            max={worksheet.difficulty_max}
            size="lg"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {questions.map((question, index) => {
          const selected = answers[question.id];
          const isMcq = question.type === "multiple_choice";

          return (
            <div
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="font-medium text-slate-900 flex-1 leading-relaxed">
                  {index + 1}. {question.prompt}
                </p>
                <QuestionDifficultyStars stars={question.stars} />
              </div>

              {isMcq ? (
                <div className="flex flex-col gap-2 mt-3">
                  {(question.choices || []).map((choice) => {
                    const isSelected = selected === choice;
                    const isCorrect =
                      choice.trim().toLowerCase() ===
                      (question.answer || "").trim().toLowerCase();

                    let choiceStyle = "border-slate-200 text-slate-800 bg-white";
                    if (checked) {
                      if (isCorrect) {
                        choiceStyle = "border-green-400 bg-green-50 text-green-800";
                      } else if (isSelected && !isCorrect) {
                        choiceStyle = "border-red-400 bg-red-50 text-red-800";
                      } else {
                        choiceStyle = "border-slate-100 text-slate-400 bg-white";
                      }
                    } else if (isSelected) {
                      choiceStyle = "border-indigo-500 bg-indigo-50 text-slate-900";
                    }

                    return (
                      <button
                        key={choice}
                        type="button"
                        disabled={checked}
                        onClick={() => handleSelect(question.id, choice)}
                        className={`border rounded-xl px-4 py-3 text-sm text-left transition ${choiceStyle}`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 flex flex-wrap gap-2">
        {!checked ? (
          <button
            type="button"
            onClick={handleCheckAnswers}
            disabled={questions.some((q) => !answers[q.id])}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 text-sm transition"
          >
            Check answers
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-5 py-2.5 text-sm transition"
          >
            Try again
          </button>
        )}
        <p className="text-xs text-slate-500 self-center">
          {variant === "revision"
            ? "Practice worksheet from a skill your teacher discussed with you."
            : "For practice only — saved to the student's Revision page when generated."}
        </p>
      </div>
    </div>
  );
}
