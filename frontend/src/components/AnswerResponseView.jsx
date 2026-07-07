import { useEffect, useState } from "react";
import {
  ScratchpadIcon,
  TextAnswerIcon,
} from "./ResponseModeIcons";

function hasTextAnswer(answer) {
  return answer?.given != null && String(answer.given).trim() !== "";
}

function hasScratchpadAnswer(answer) {
  return Boolean(answer?.scratchpad);
}

function defaultViewMode(answer) {
  if (answer?.response_mode === "scratchpad" && hasScratchpadAnswer(answer)) {
    return "scratchpad";
  }
  if (answer?.response_mode === "text" && hasTextAnswer(answer)) {
    return "text";
  }
  if (hasScratchpadAnswer(answer)) return "scratchpad";
  return "text";
}

function ResponseReviewToggle({ mode, onChange }) {
  const baseBtn =
    "inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 transition";
  const active = "bg-indigo-100 text-indigo-900 border-indigo-300";
  const idle =
    "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-800";

  return (
    <div className="flex flex-col gap-2 shrink-0" role="group" aria-label="Response view">
      <button
        type="button"
        onClick={() => onChange("text")}
        title="View typed answer"
        aria-label="View typed answer"
        aria-pressed={mode === "text"}
        className={`${baseBtn} ${mode === "text" ? active : idle}`}
      >
        <TextAnswerIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange("scratchpad")}
        title="View scratchpad work"
        aria-label="View scratchpad work"
        aria-pressed={mode === "scratchpad"}
        className={`${baseBtn} ${mode === "scratchpad" ? active : idle}`}
      >
        <ScratchpadIcon />
      </button>
    </div>
  );
}

function TextAnswerDisplay({ given }) {
  return (
    <div className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-slate-50 whitespace-pre-wrap break-words min-h-[6rem]">
      {given?.trim() ? given : <span className="text-slate-500 italic">(empty)</span>}
    </div>
  );
}

function ScratchpadAnswerDisplay({ scratchpad }) {
  return (
    <img
      src={scratchpad}
      alt="Student scratchpad work"
      className="max-w-full rounded-xl border border-slate-200 bg-black"
    />
  );
}

/** Display a student's text or scratchpad response on result views. */
export default function AnswerResponseView({ answer }) {
  const hasText = hasTextAnswer(answer);
  const hasScratchpad = hasScratchpadAnswer(answer);
  const [viewMode, setViewMode] = useState(() => defaultViewMode(answer));

  useEffect(() => {
    setViewMode(defaultViewMode(answer));
  }, [answer?.question_id, answer?.response_mode, answer?.given, answer?.scratchpad]);

  if (hasText && hasScratchpad) {
    return (
      <div className="flex items-start gap-3">
        <ResponseReviewToggle mode={viewMode} onChange={setViewMode} />
        <div className="min-w-0 flex-1">
          {viewMode === "scratchpad" ? (
            <ScratchpadAnswerDisplay scratchpad={answer.scratchpad} />
          ) : (
            <TextAnswerDisplay given={answer.given} />
          )}
        </div>
      </div>
    );
  }

  if (hasScratchpad) {
    return (
      <div className="mt-2">
        <ScratchpadAnswerDisplay scratchpad={answer.scratchpad} />
      </div>
    );
  }

  if (hasText) {
    return (
      <span className="text-slate-900 font-medium break-words min-w-0">
        {`"${answer.given}"`}
      </span>
    );
  }

  const mode = answer?.response_mode || "text";
  if (mode === "scratchpad") {
    return (
      <p className="text-slate-600 text-sm mt-2 italic">(No scratchpad work saved)</p>
    );
  }

  return (
    <span className="text-slate-900 font-medium break-words min-w-0">(empty)</span>
  );
}
