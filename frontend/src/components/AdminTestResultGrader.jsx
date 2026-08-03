import { useEffect, useMemo, useState } from "react";
import { evaluateTestResult, getWorksheet } from "../api";
import {
  contextCenteredForPassage,
  flattenTestQuestions,
  groupTestAnswers,
  passageWindowUnitLabel,
} from "../testResultUtils";
import { AdminGradingQuestionRow } from "./AdminResultGrader";
import CollapsiblePassageContext from "./CollapsiblePassageContext";

/**
 * Admin correct/incorrect overrides for completed test and composite section results.
 */
export default function AdminTestResultGrader({
  result,
  onEvaluated,
  layout = "stacked",
}) {
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [worksheet, setWorksheet] = useState(null);
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);

  const flatQuestions = useMemo(
    () => flattenTestQuestions(result?.answers || []),
    [result?.answers],
  );

  useEffect(() => {
    const initial = {};
    for (const question of flatQuestions) {
      if (question.correct === true) initial[question.question_id] = true;
      else if (question.correct === false) initial[question.question_id] = false;
      else initial[question.question_id] = null;
    }
    setMarks(initial);
  }, [result?.id, flatQuestions]);

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
    () => groupTestAnswers(result?.answers || [], worksheet),
    [result?.answers, worksheet],
  );
  const subject = result?.subject || worksheet?.subject || "general";

  async function setMark(questionId, correct) {
    const nextMarks = { ...marks, [questionId]: correct };
    setMarks(nextMarks);
    await saveMarks(nextMarks);
  }

  async function saveMarks(nextMarks) {
    setSaving(true);
    setError("");
    try {
      const payload = flatQuestions.map((question) => ({
        question_id: question.question_id,
        correct: nextMarks[question.question_id] === true,
      }));
      const updated = await evaluateTestResult(result.id, payload);
      onEvaluated(updated);
    } catch (e) {
      setError(e.message || "Could not save marks.");
    } finally {
      setSaving(false);
    }
  }

  const shellClass =
    layout === "side"
      ? "px-4 pb-4 pt-4 bg-slate-50/30"
      : "border-t border-slate-100 px-5 pb-5 pt-4 bg-slate-50/30";

  let passageGroupIndex = 0;

  if (!flatQuestions.length) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-slate-600">No gradable answers for this test.</p>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <p className="mb-3 text-sm font-semibold text-amber-900">
        Tap Correct or Incorrect to update a mark. Weighted score updates automatically.
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
                {group.passage ? (
                  <CollapsiblePassageContext passage={group.passage} centered={centered} />
                ) : null}
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
            <li key={group.answer.question_id || group.number} className="list-none space-y-3">
              {group.passage ? <CollapsiblePassageContext passage={group.passage} /> : null}
              <AdminGradingQuestionRow
                answer={group.answer}
                number={group.number}
                marks={marks}
                saving={saving}
                onMark={setMark}
              />
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
