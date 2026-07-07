import { useEffect, useState } from "react";
import { evaluateResult } from "../api";
import AnswerResponseView from "./AnswerResponseView";

/**
 * Admin grading panel for a pending manual-evaluation submission.
 */
export default function AdminResultGrader({ result, onEvaluated }) {
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initial = {};
    for (const a of result.answers || []) {
      if (a.correct === true) initial[a.question_id] = true;
      else if (a.correct === false) initial[a.question_id] = false;
      else initial[a.question_id] = null;
    }
    setMarks(initial);
  }, [result.id, result.answers]);

  function setMark(questionId, correct) {
    setMarks((prev) => ({ ...prev, [questionId]: correct }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = (result.answers || []).map((a) => ({
        question_id: a.question_id,
        correct: marks[a.question_id] === true,
      }));
      const updated = await evaluateResult(result.id, payload);
      onEvaluated(updated);
    } catch (e) {
      setError(e.message || "Could not save marks.");
    } finally {
      setSaving(false);
    }
  }

  const markedCount = Object.values(marks).filter((v) => v === true).length;
  const allMarked = (result.answers || []).every(
    (a) => marks[a.question_id] === true || marks[a.question_id] === false,
  );

  return (
    <div className="border-t border-slate-100 px-5 pb-5 pt-4 bg-slate-50/30">
      <p className="text-sm font-semibold text-amber-900 mb-3">
        Mark each answer — reference answers shown for your guidance only.
      </p>
      <ul className="flex flex-col gap-4">
        {(result.answers || []).map((a, index) => {
          const isCorrect = marks[a.question_id] === true;
          const isWrong = marks[a.question_id] === false;
          return (
            <li
              key={a.question_id}
              className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm"
            >
              <p className="text-slate-800 text-sm font-medium leading-snug">
                <span className="text-indigo-500 font-normal">
                  {index + 1}.{" "}
                </span>
                {a.prompt}
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-slate-600">Student response: </span>
                </p>
                <AnswerResponseView answer={a} />
                {a.expected ? (
                  <p className="text-slate-600">
                    Reference:{" "}
                    <span className="text-slate-800 font-medium">{a.expected}</span>
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMark(a.question_id, true)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                    isCorrect
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-white text-slate-700 border-slate-200 hover:border-green-300"
                  }`}
                >
                  Correct
                </button>
                <button
                  type="button"
                  onClick={() => setMark(a.question_id, false)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                    isWrong
                      ? "bg-red-100 text-red-800 border-red-300"
                      : "bg-white text-slate-700 border-slate-200 hover:border-red-300"
                  }`}
                >
                  Incorrect
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-red-600 text-sm mt-3">{error}</p> : null}
      <button
        type="button"
        disabled={saving || !allMarked}
        onClick={handleSave}
        className="mt-4 w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition"
      >
        {saving
          ? "Saving…"
          : allMarked
            ? `Save marks (${markedCount}/${result.answers?.length ?? 0} correct)`
            : "Mark every question before saving"}
      </button>
    </div>
  );
}
