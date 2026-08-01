import AnswerResponseView from "./AnswerResponseView";
import AdminResultGrader from "./AdminResultGrader";
import {
  RESULTS_ANSWER_BODY,
  RESULTS_ANSWER_PROMPT,
  RESULTS_BODY_MUTED,
  RESULTS_ITEM_SHELL,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
} from "../resultsTypography";

function WorksheetAnswersBody({ result, isAdmin, isPending, onResultEvaluated }) {
  if (isAdmin) {
    return (
      <AdminResultGrader
        result={result}
        mode={isPending ? "pending" : "override"}
        onEvaluated={onResultEvaluated}
        layout="side"
      />
    );
  }

  return (
    <div className="px-4 pb-4 pt-4">
      <ul className="flex flex-col gap-3">
        {(result.answers || []).map((a, index) => (
          <li
            key={a.question_id}
            className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm"
          >
            <p className={RESULTS_ANSWER_PROMPT}>
              <span className="text-indigo-600 font-normal">
                {index + 1}.{" "}
              </span>
              {a.prompt}
            </p>
            <div className="mt-2 flex flex-col gap-1.5 text-sm">
              <span className={RESULTS_ANSWER_BODY}>Response:</span>
              <AnswerResponseView answer={a} />
              {typeof a.correct === "boolean" ? (
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    a.correct
                      ? "bg-green-50 text-green-800 border-green-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {a.correct ? "Correct" : "Incorrect"}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PracticeAnswersBody({ item }) {
  return (
    <div className="px-4 pb-4 pt-4">
      {item.answers?.length ? (
        <ul className="flex flex-col gap-3">
          {item.answers.map((answer, index) => (
            <li
              key={answer.question_id || index}
              className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm"
            >
              <p className={RESULTS_ANSWER_PROMPT}>
                <span className="text-indigo-600 font-normal">
                  {index + 1}.{" "}
                </span>
                {answer.prompt}
              </p>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <p className={RESULTS_ANSWER_BODY}>
                  <span className="font-medium text-slate-700">
                    Student chose:{" "}
                  </span>
                  {answer.given || (
                    <span className="text-slate-400 italic">No answer</span>
                  )}
                </p>
                {answer.expected ? (
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-600">
                      Correct:{" "}
                    </span>
                    {answer.expected}
                  </p>
                ) : null}
                {typeof answer.correct === "boolean" ? (
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      answer.correct
                        ? "bg-green-50 text-green-800 border-green-200"
                        : "bg-red-50 text-red-800 border-red-200"
                    }`}
                  >
                    {answer.correct ? "Correct" : "Incorrect"}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={RESULTS_BODY_MUTED}>
          No per-question answers were saved for this attempt.
        </p>
      )}
    </div>
  );
}

function TestAnswersBody({ item }) {
  return (
    <div className="px-4 pb-4 pt-4 text-sm space-y-3">
      {(item.answers || []).map((a, i) => (
        <div
          key={a.question_id || i}
          className={`rounded-xl border p-3 ${
            a.correct
              ? "border-green-200 bg-green-50/50"
              : "border-red-200 bg-red-50/50"
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">
            {a.prompt || "Question"}
          </p>
          <p className={`mt-1 ${RESULTS_ANSWER_BODY}`}>
            Answer: {a.given || "—"}
            {!a.correct && a.expected ? (
              <span className="block text-emerald-800 mt-0.5">
                Correct: {a.expected}
              </span>
            ) : null}
          </p>
          {a.tier ? (
            <p className={`${RESULTS_ROW_DETAIL} mt-1`}>Tier {a.tier}</p>
          ) : null}
        </div>
      ))}
      {item.review_id ? (
        <p className="text-xs text-amber-800 font-medium">
          Review session #{item.review_id}
          {item.review_completed ? " — completed" : " — pending"}
        </p>
      ) : null}
      {!item.answers?.length && !item.review_id ? (
        <p className={RESULTS_BODY_MUTED}>No answers were saved for this test.</p>
      ) : null}
    </div>
  );
}

/**
 * Dedicated right-hand panel for worksheet / practice / test answer review.
 */
export default function ResultsAnswerAside({
  worksheetResult = null,
  practiceItem = null,
  testResult = null,
  isAdmin = true,
  onResultEvaluated,
  onClose,
  className = "",
}) {
  const hasSelection = Boolean(worksheetResult || practiceItem || testResult);

  if (!hasSelection) {
    return null;
  }

  const title =
    worksheetResult?.title ||
    worksheetResult?.worksheet_id ||
    practiceItem?.title ||
    testResult?.title ||
    "Answers";
  const subtitle = worksheetResult
    ? new Date(worksheetResult.submitted_at).toLocaleString()
    : practiceItem
      ? new Date(practiceItem.completed_at).toLocaleString()
      : testResult?.completed_at
        ? new Date(testResult.completed_at).toLocaleString()
        : null;
  const isPending = worksheetResult?.status === "pending";

  return (
    <aside
      className={`lg:sticky lg:top-4 ${className}`}
      aria-label="Answer review panel"
    >
      <div className={`${RESULTS_ITEM_SHELL} flex flex-col max-h-[calc(100vh-6rem)]`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 bg-white shrink-0">
          <div className="min-w-0">
            <p className={RESULTS_ROW_TITLE}>{title}</p>
            {subtitle ? (
              <p className={`${RESULTS_ROW_DETAIL} mt-1`}>{subtitle}</p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Close
            </button>
          ) : null}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 bg-slate-50/30">
          {worksheetResult ? (
            <WorksheetAnswersBody
              result={worksheetResult}
              isAdmin={isAdmin}
              isPending={isPending}
              onResultEvaluated={onResultEvaluated}
            />
          ) : null}
          {practiceItem ? <PracticeAnswersBody item={practiceItem} /> : null}
          {testResult ? <TestAnswersBody item={testResult} /> : null}
        </div>
      </div>
    </aside>
  );
}
