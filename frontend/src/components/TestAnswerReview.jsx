import { useEffect, useMemo, useState } from "react";
import { getWorksheet } from "../api";
import {
  isPassageWindowAnswer,
  buildPassageLookup,
  buildQuestionPassageLookup,
  passageWindowUnitLabel,
  resolveAnswerPassage,
  contextCenteredForPassage,
} from "../testResultUtils";
import CollapsiblePassageContext from "./CollapsiblePassageContext";
import {
  RESULTS_ANSWER_BODY,
  RESULTS_BODY_MUTED,
  RESULTS_ROW_DETAIL,
} from "../resultsTypography";

function TestAnswerQuestionRow({ question, index = null }) {
  const correct = question.correct === true;
  const incorrect = question.correct === false;

  return (
    <div
      className={`rounded-xl border p-3 ${
        correct
          ? "border-green-200 bg-green-50/50"
          : incorrect
            ? "border-red-200 bg-red-50/50"
            : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">
        {index != null ? (
          <span className="text-indigo-600 font-normal">{index}. </span>
        ) : null}
        {question.prompt || "Question"}
      </p>
      <p className={`mt-1 ${RESULTS_ANSWER_BODY}`}>
        Answer: {question.given || "—"}
        {incorrect && question.expected ? (
          <span className="mt-0.5 block text-emerald-800">
            Correct: {question.expected}
          </span>
        ) : null}
      </p>
      {question.tier ? (
        <p className={`${RESULTS_ROW_DETAIL} mt-1`}>Tier {question.tier}</p>
      ) : null}
    </div>
  );
}

function PassageWindowAnswerGroup({ answer, index, subject, passageLookup, questionPassageLookup }) {
  const unitLabel = passageWindowUnitLabel(subject);
  const passage = resolveAnswerPassage(answer, passageLookup, questionPassageLookup);
  const centered = contextCenteredForPassage(passage, subject);
  const questions = answer.questions || [];
  const scoreLabel =
    typeof answer.correct_count === "number" &&
    typeof answer.question_count === "number"
      ? `${answer.correct_count}/${answer.question_count} correct`
      : null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {unitLabel} {index + 1}
          {scoreLabel ? ` · ${scoreLabel}` : ""}
        </p>
        {answer.tier ? (
          <p className={`${RESULTS_ROW_DETAIL} tabular-nums`}>Tier {answer.tier}</p>
        ) : null}
      </div>
      {passage ? (
        <CollapsiblePassageContext passage={passage} centered={centered} />
      ) : null}
      <div className="space-y-2">
        {questions.map((question, questionIndex) => (
          <TestAnswerQuestionRow
            key={question.question_id || questionIndex}
            question={question}
            index={questionIndex + 1}
          />
        ))}
      </div>
    </section>
  );
}

function RegularTestAnswerRow({ answer, index, passageLookup, questionPassageLookup }) {
  const passage = resolveAnswerPassage(answer, passageLookup, questionPassageLookup);

  return (
    <div className="space-y-3">
      {passage ? <CollapsiblePassageContext passage={passage} /> : null}
      <TestAnswerQuestionRow question={answer} index={index} />
    </div>
  );
}

/**
 * Full test answer review for admin/student results panels.
 */
export default function TestAnswerReview({ item }) {
  const [worksheet, setWorksheet] = useState(null);
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);

  const needsWorksheetLookup = useMemo(
    () =>
      (item?.answers || []).some(
        (answer) =>
          (isPassageWindowAnswer(answer) && !answer?.passage) ||
          (answer?.passage_id && !answer?.passage),
      ),
    [item?.answers],
  );

  useEffect(() => {
    if (!item?.worksheet_id || !needsWorksheetLookup) {
      setWorksheet(null);
      return;
    }
    let cancelled = false;
    setLoadingWorksheet(true);
    getWorksheet(item.worksheet_id)
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
  }, [item?.worksheet_id, needsWorksheetLookup]);

  const passageLookup = useMemo(() => buildPassageLookup(worksheet), [worksheet]);
  const questionPassageLookup = useMemo(
    () => buildQuestionPassageLookup(worksheet),
    [worksheet],
  );
  const answers = item?.answers || [];
  const subject = item?.subject || worksheet?.subject || "general";

  if (!answers.length && !item?.review_id) {
    return (
      <div className="px-4 pb-4 pt-4">
        <p className={RESULTS_BODY_MUTED}>No answers were saved for this test.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-4 text-sm space-y-4">
      {loadingWorksheet ? (
        <p className={`${RESULTS_BODY_MUTED} text-xs`}>Loading context…</p>
      ) : null}
      {answers.map((answer, index) =>
        isPassageWindowAnswer(answer) ? (
          <PassageWindowAnswerGroup
            key={answer.passage_id || index}
            answer={answer}
            index={index}
            subject={subject}
            passageLookup={passageLookup}
            questionPassageLookup={questionPassageLookup}
          />
        ) : (
          <RegularTestAnswerRow
            key={answer.question_id || index}
            answer={answer}
            index={index + 1}
            passageLookup={passageLookup}
            questionPassageLookup={questionPassageLookup}
          />
        ),
      )}
      {item.review_id ? (
        <p className="text-xs font-medium text-amber-800">
          Review session #{item.review_id}
          {item.review_completed ? " — completed" : " — pending"}
        </p>
      ) : null}
    </div>
  );
}
