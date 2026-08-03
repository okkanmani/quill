import { useEffect, useMemo, useState } from "react";
import { getWorksheet } from "../api";
import {
  contextCenteredForPassage,
  groupWorksheetAnswers,
  passageWindowUnitLabel,
} from "../testResultUtils";
import AnswerResponseView from "./AnswerResponseView";
import CollapsiblePassageContext from "./CollapsiblePassageContext";
import {
  RESULTS_ANSWER_BODY,
  RESULTS_ANSWER_PROMPT,
  RESULTS_BODY_MUTED,
} from "../resultsTypography";

function WorksheetAnswerRow({ answer, number }) {
  return (
    <li className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className={RESULTS_ANSWER_PROMPT}>
        <span className="font-normal text-indigo-600">{number}. </span>
        {answer.prompt}
      </p>
      <div className="mt-2 flex flex-col gap-1.5 text-sm">
        <span className={RESULTS_ANSWER_BODY}>Response:</span>
        <AnswerResponseView answer={answer} />
        {typeof answer.correct === "boolean" ? (
          <span
            className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              answer.correct
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {answer.correct ? "Correct" : "Incorrect"}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function WorksheetPassageAnswerGroup({ group, groupIndex, subject }) {
  const unitLabel = passageWindowUnitLabel(subject);
  const centered = contextCenteredForPassage(group.passage, subject);

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {unitLabel} {groupIndex + 1}
      </p>
      <CollapsiblePassageContext passage={group.passage} centered={centered} />
      <ul className="flex flex-col gap-3">
        {group.numberedAnswers.map(({ answer, number }) => (
          <WorksheetAnswerRow key={answer.question_id || number} answer={answer} number={number} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Student worksheet answer review with passage/context grouping.
 */
export default function WorksheetAnswerReview({ result }) {
  const [worksheet, setWorksheet] = useState(null);
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);

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
  let passageGroupIndex = 0;

  return (
    <div className="px-4 pb-4 pt-4">
      {loadingWorksheet ? (
        <p className={`${RESULTS_BODY_MUTED} mb-3 text-xs`}>Loading context…</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {groups.map((group) => {
          if (group.kind === "passage") {
            const index = passageGroupIndex;
            passageGroupIndex += 1;
            return (
              <li key={group.passageId || index} className="list-none">
                <WorksheetPassageAnswerGroup
                  group={group}
                  groupIndex={index}
                  subject={subject}
                />
              </li>
            );
          }
          return (
            <WorksheetAnswerRow
              key={group.answer.question_id || group.number}
              answer={group.answer}
              number={group.number}
            />
          );
        })}
      </ul>
    </div>
  );
}
