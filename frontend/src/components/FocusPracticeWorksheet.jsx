import { useEffect, useMemo, useState } from "react";
import Drawpad from "./Drawpad";
import { DifficultyStars, QuestionDifficultyStars } from "./DifficultyStars";
import { ScratchpadIcon, TextAnswerIcon } from "./ResponseModeIcons";
import {
  ICON_ACTION_ACTIVE_CLASS,
  ICON_ACTION_BUTTON_CLASS,
  ICON_ACTION_IDLE_CLASS,
} from "./rowActionButtonStyles";
import {
  getQuestionHintContext,
  questionHasHint,
} from "../focusPracticeBuilderUtils";

function WorkModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Work space mode">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("text")}
        title="Type notes"
        aria-label="Type notes"
        aria-pressed={mode === "text"}
        className={`${ICON_ACTION_BUTTON_CLASS} ${
          mode === "text" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
        }`}
      >
        <TextAnswerIcon />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("scratchpad")}
        title="Use scratchpad"
        aria-label="Use scratchpad"
        aria-pressed={mode === "scratchpad"}
        className={`${ICON_ACTION_BUTTON_CLASS} ${
          mode === "scratchpad" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
        }`}
      >
        <ScratchpadIcon />
      </button>
    </div>
  );
}

function FocusPracticeHintPanel({
  questions,
  activeHintId,
  revealedHintIds,
}) {
  const activeIndex = questions.findIndex((question) => question.id === activeHintId);
  const activeQuestion = activeIndex >= 0 ? questions[activeIndex] : null;
  const hintText = activeQuestion ? getQuestionHintContext(activeQuestion) : "";
  const isRevealed = activeHintId && revealedHintIds.has(activeHintId);

  return (
    <aside className="hidden xl:flex w-72 shrink-0 flex-col rounded-2xl border border-amber-200 bg-amber-50/80 shadow-sm overflow-hidden max-h-[calc(100vh-6rem)] sticky top-6">
      <div className="shrink-0 border-b border-amber-200/80 bg-white/70 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Hint
        </p>
        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
          Tap Hint on a question when you need a nudge.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!isRevealed ? (
          <p className="text-sm text-slate-500 leading-relaxed">
            Hints appear here for harder questions after you choose Hint on that
            question.
          </p>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Question {activeIndex + 1}
            </p>
            <p className="text-sm text-slate-900 mt-3 leading-relaxed whitespace-pre-wrap">
              {hintText}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function MobileHintReveal({ hintText, alwaysInline = false }) {
  if (!hintText) return null;
  return (
    <div
      className={`${alwaysInline ? "" : "xl:hidden"} mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Hint
      </p>
      <p className="text-sm text-slate-900 mt-2 leading-relaxed whitespace-pre-wrap">
        {hintText}
      </p>
    </div>
  );
}

export default function FocusPracticeWorksheet({
  worksheet,
  variant = "preview",
  onComplete,
}) {
  const [answers, setAnswers] = useState({});
  const [workModes, setWorkModes] = useState({});
  const [workNotes, setWorkNotes] = useState({});
  const [workScratchpads, setWorkScratchpads] = useState({});
  const [checked, setChecked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [workSpaceVisible, setWorkSpaceVisible] = useState(true);
  const [activeHintId, setActiveHintId] = useState(null);
  const [revealedHintIds, setRevealedHintIds] = useState(() => new Set());

  if (!worksheet) return null;

  const questions = worksheet.questions || [];
  const scratchpadAllowed = worksheet.scratchpad !== false;
  const showWorkSpace = scratchpadAllowed && workSpaceVisible;
  const hasAnyHints = questions.some(questionHasHint);
  const showSideHintPanel = hasAnyHints && variant === "revision";
  const isRevision = variant === "revision";
  const locked = checked || submitted;

  useEffect(() => {
    if (!isRevision || !worksheet?.completed_at) return;
    const saved = worksheet.submitted_answers || [];
    const initialAnswers = {};
    for (const row of saved) {
      if (row?.question_id) {
        initialAnswers[row.question_id] = row.given || "";
      }
    }
    setAnswers(initialAnswers);
    setChecked(true);
    setSubmitted(true);
    setSubmitError("");
  }, [isRevision, worksheet]);

  const displayScore = useMemo(() => {
    if (typeof worksheet.last_score === "number") return worksheet.last_score;
    if (!checked) return null;
    return questions.reduce((count, question) => {
      const selected = answers[question.id] || "";
      const expected = (question.answer || "").trim();
      const correct =
        Boolean(selected) &&
        selected.trim().toLowerCase() === expected.toLowerCase();
      return count + (correct ? 1 : 0);
    }, 0);
  }, [worksheet.last_score, checked, questions, answers]);

  function revealHint(questionId) {
    setActiveHintId(questionId);
    setRevealedHintIds((prev) => {
      const next = new Set(prev);
      next.add(questionId);
      return next;
    });
  }

  function handleSelect(questionId, choice) {
    if (locked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: choice }));
  }

  function handleWorkModeChange(questionId, mode) {
    if (locked) return;
    setWorkModes((prev) => ({ ...prev, [questionId]: mode }));
  }

  async function handleCheckAnswers() {
    setSubmitError("");
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
        stars: question.stars ?? 2,
      });
    }

    if (isRevision && onComplete) {
      setSubmitting(true);
      try {
        await onComplete({
          score,
          total: questions.length,
          answers: answerRows,
        });
        setSubmitted(true);
        setChecked(true);
      } catch (err) {
        setSubmitError(err.message || "Could not submit your answers.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setChecked(true);
    if (onComplete) {
      onComplete({ score, total: questions.length, answers: answerRows });
    }
  }

  function handleReset() {
    setAnswers({});
    setWorkModes({});
    setWorkNotes({});
    setWorkScratchpads({});
    setChecked(false);
    setResetKey((value) => value + 1);
    setActiveHintId(null);
    setRevealedHintIds(new Set());
  }

  const worksheetCard = (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] flex-1 min-w-0">
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

      {scratchpadAllowed ? (
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Show your work</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Each question can include typed notes or a scratchpad.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={workSpaceVisible}
              aria-label={`${workSpaceVisible ? "Hide" : "Show"} work space on questions`}
              onClick={() => setWorkSpaceVisible((value) => !value)}
              disabled={submitted}
              className={`relative h-9 w-14 shrink-0 rounded-full transition-colors ${
                workSpaceVisible ? "bg-indigo-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-1 left-1 block h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  workSpaceVisible ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {questions.map((question, index) => {
          const selected = answers[question.id];
          const isMcq = question.type === "multiple_choice";
          const workMode = workModes[question.id] || "text";
          const hintAvailable = questionHasHint(question);
          const hintRevealed = revealedHintIds.has(question.id);
          const hintText = getQuestionHintContext(question);

          return (
            <div
              key={question.id}
              className={`rounded-2xl border bg-slate-50/50 p-5 shadow-sm ${
                activeHintId === question.id && hintRevealed
                  ? "border-amber-300 ring-1 ring-amber-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="font-medium text-slate-900 flex-1 leading-relaxed">
                  {index + 1}. {question.prompt}
                </p>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <QuestionDifficultyStars stars={question.stars} />
                  {hintAvailable && question.stars >= 3 && !locked ? (
                    <button
                      type="button"
                      onClick={() => revealHint(question.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        hintRevealed
                          ? "border-amber-300 bg-amber-100 text-amber-900"
                          : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                      }`}
                    >
                      {hintRevealed ? "Hint shown" : "Hint"}
                    </button>
                  ) : null}
                </div>
              </div>

              {hintRevealed ? (
                <MobileHintReveal
                  hintText={hintText}
                  alwaysInline={!showSideHintPanel}
                />
              ) : null}

              {showWorkSpace ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                  {!locked ? (
                    <div className="flex justify-end mb-3">
                      <WorkModeToggle
                        mode={workMode}
                        onChange={(mode) => handleWorkModeChange(question.id, mode)}
                        disabled={locked}
                      />
                    </div>
                  ) : null}
                  {workMode === "scratchpad" ? (
                    locked ? (
                      workScratchpads[question.id] ? (
                        <img
                          src={workScratchpads[question.id]}
                          alt="Your scratchpad work"
                          className="max-w-full rounded-xl border border-slate-200 bg-black"
                        />
                      ) : (
                        <p className="text-sm text-slate-500 italic">
                          No scratchpad work saved.
                        </p>
                      )
                    ) : (
                      <Drawpad
                        key={`work-${question.id}-${resetKey}`}
                        value={workScratchpads[question.id] || ""}
                        onChange={(dataUrl) =>
                          setWorkScratchpads((prev) => ({
                            ...prev,
                            [question.id]: dataUrl,
                          }))
                        }
                        showHeading={false}
                        showTextTool
                        canvasHeight={700}
                        className="mt-0"
                      />
                    )
                  ) : (
                    <textarea
                      value={workNotes[question.id] || ""}
                      onChange={(e) =>
                        setWorkNotes((prev) => ({
                          ...prev,
                          [question.id]: e.target.value,
                        }))
                      }
                      disabled={locked}
                      placeholder="Jot notes or steps for this question…"
                      rows={8}
                      className="quill-field-textarea w-full border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 resize-y min-h-[12rem]"
                    />
                  )}
                </div>
              ) : null}

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
                        disabled={locked}
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

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 flex flex-col gap-3">
        {submitError ? (
          <p className="text-sm text-red-600">{submitError}</p>
        ) : null}
        {isRevision && submitted ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-slate-900 font-semibold">
              You got {displayScore ?? 0} out of {questions.length} correct!
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Submitted — your teacher can review this under Results → Revision.
            </p>
          </div>
        ) : !checked ? (
          <button
            type="button"
            onClick={handleCheckAnswers}
            disabled={
              submitting || questions.some((q) => !answers[q.id])
            }
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 text-sm transition w-fit"
          >
            {submitting
              ? "Submitting…"
              : isRevision
                ? "Submit answers"
                : "Check answers"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-5 py-2.5 text-sm transition w-fit"
          >
            Try again
          </button>
        )}
        <p className="text-xs text-slate-500">
          {isRevision
            ? submitted
              ? "This practice attempt is saved."
              : "Submit once when you are ready — answers are saved for your teacher."
            : "For practice only — saved to the student's Revision page when generated."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col xl:flex-row gap-4 xl:gap-5 items-start w-full">
      {worksheetCard}
      {showSideHintPanel ? (
        <FocusPracticeHintPanel
          questions={questions}
          activeHintId={activeHintId}
          revealedHintIds={revealedHintIds}
        />
      ) : null}
    </div>
  );
}
