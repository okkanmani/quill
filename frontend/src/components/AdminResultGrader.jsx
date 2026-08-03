import { useEffect, useMemo, useState } from "react";
import { evaluateResult, getWorksheet } from "../api";
import {
  contextCenteredForPassage,
  groupWorksheetAnswers,
  passageWindowUnitLabel,
} from "../testResultUtils";
import AnswerResponseView from "./AnswerResponseView";
import CollapsiblePassageContext from "./CollapsiblePassageContext";

function AdminGradingQuestionRow({ answer, number, marks, saving, onMark }) {
  const isCorrect = marks[answer.question_id] === true;
  const isWrong = marks[answer.question_id] === false;

  return (
    <li className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium leading-snug text-slate-800">
        <span className="font-normal text-indigo-500">{number}. </span>
        {answer.prompt}
      </p>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <p>
          <span className="text-slate-600">Student response: </span>
        </p>
        <AnswerResponseView answer={answer} />
        {answer.expected ? (
          <p className="text-slate-600">
            Reference:{" "}
            <span className="font-medium text-slate-800">{answer.expected}</span>
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onMark(answer.question_id, true)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            isCorrect
              ? "border-green-300 bg-green-100 text-green-800"
              : "border-slate-200 bg-white text-slate-700 hover:border-green-300"
          }`}
        >
          Correct
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onMark(answer.question_id, false)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            isWrong
              ? "border-red-300 bg-red-100 text-red-800"
              : "border-slate-200 bg-white text-slate-700 hover:border-red-300"
          }`}
        >
          Incorrect
        </button>
      </div>
    </li>
  );
}

/**
 * Admin grading panel for pending or already-evaluated submissions.
 */
export default function AdminResultGrader({
  result,
  onEvaluated,
  mode = "pending",
  layout = "stacked",
}) {
  const isOverride = mode === "override";
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [worksheet, setWorksheet] = useState(null);
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);

  useEffect(() => {
    const initial = {};
    for (const a of result.answers || []) {
      if (a.correct === true) initial[a.question_id] = true;
      else if (a.correct === false) initial[a.question_id] = false;
      else initial[a.question_id] = null;
    }
    setMarks(initial);
  }, [result.id, result.answers]);

  useEffect(() => {
    if (!result?.worksheet_id) {
      setWorksheet(null);
      return;
    }
    let cancelled = false;
    setLoadingWorksheet(true);
    getWorksheet(result.worksheet_id)
      .then((data) => {
        if (!cancelled) setWorksheet(data);
      })
      .catch(() => {
        if (!cancelled) setWorksheet(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingWorksheet(false);
      });
    return () => {
      cancelled = true;
    };
  }, [result?.worksheet_id]);

  const groups = useMemo(
    () => groupWorksheetAnswers(result?.answers || [], worksheet),
    [result?.answers, worksheet],
  );
  const subject = result?.subject || worksheet?.subject || "general";

  async function setMark(questionId, correct) {
    const nextMarks = { ...marks, [questionId]: correct };
    setMarks(nextMarks);
    if (isOverride) {
      await saveMarks(nextMarks);
    }
  }

  async function saveMarks(nextMarks) {
    setSaving(true);
    setError("");
    try {
      const payload = (result.answers || []).map((a) => ({
        question_id: a.question_id,
        correct: nextMarks[a.question_id] === true,
      }));
      const updated = await evaluateResult(result.id, payload);
      onEvaluated(updated);
    } catch (e) {
      setError(e.message || "Could not save marks.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await saveMarks(marks);
  }

  const markedCount = Object.values(marks).filter((v) => v === true).length;
  const allMarked = (result.answers || []).every(
    (a) => marks[a.question_id] === true || marks[a.question_id] === false,
  );

  const shellClass =
    layout === "side"
      ? "px-4 pb-4 pt-4 bg-slate-50/30"
      : "border-t border-slate-100 px-5 pb-5 pt-4 bg-slate-50/30";

  let passageGroupIndex = 0;

  return (
    <div className={shellClass}>
      <p className="mb-3 text-sm font-semibold text-amber-900">
        {isOverride
          ? "Tap Correct or Incorrect to update a mark."
          : "Mark each answer — reference answers shown for your guidance only."}
      </p>
      {loadingWorksheet ? (
        <p className="mb-3 text-xs text-slate-500">Loading context…</p>
      ) : null}
      <ul className="flex flex-col gap-4">
        {groups.map((group) => {
          if (group.kind === "passage") {
            const index = passageGroupIndex;
            passageGroupIndex += 1;
            const unitLabel = passageWindowUnitLabel(subject);
            const centered = contextCenteredForPassage(group.passage, subject);
            return (
              <li
                key={group.passageId || index}
                className="list-none space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {unitLabel} {index + 1}
                </p>
                <CollapsiblePassageContext passage={group.passage} centered={centered} />
                <ul className="flex flex-col gap-4">
                  {group.numberedAnswers.map(({ answer, number }) => (
                    <AdminGradingQuestionRow
                      key={answer.question_id || number}
                      answer={answer}
                      number={number}
                      marks={marks}
                      saving={saving}
                      onMark={setMark}
                    />
                  ))}
                </ul>
              </li>
            );
          }

          return (
            <AdminGradingQuestionRow
              key={group.answer.question_id || group.number}
              answer={group.answer}
              number={group.number}
              marks={marks}
              saving={saving}
              onMark={setMark}
            />
          );
        })}
      </ul>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {!isOverride ? (
        <button
          type="button"
          disabled={saving || !allMarked}
          onClick={handleSave}
          className="mt-4 w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
        >
          {saving
            ? "Saving…"
            : allMarked
              ? `Save marks (${markedCount}/${result.answers?.length ?? 0} correct)`
              : "Mark every question before saving"}
        </button>
      ) : saving ? (
        <p className="mt-3 text-sm text-slate-500">Saving…</p>
      ) : null}
    </div>
  );
}
