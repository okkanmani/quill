/** Display a student's text or scratchpad response on result views. */
export default function AnswerResponseView({ answer }) {
  const mode = answer?.response_mode || (answer?.scratchpad ? "scratchpad" : "text");

  if (mode === "scratchpad") {
    if (answer?.scratchpad) {
      return (
        <div className="mt-2">
          <p className="text-slate-600 text-sm mb-2">Scratchpad work:</p>
          <img
            src={answer.scratchpad}
            alt="Student scratchpad work"
            className="max-w-full rounded-xl border border-slate-200 bg-black"
          />
        </div>
      );
    }
    return (
      <p className="text-slate-600 text-sm mt-2 italic">(No scratchpad work saved)</p>
    );
  }

  return (
    <span className="text-slate-900 font-medium break-words min-w-0">
      {answer?.given === "" || answer?.given == null
        ? "(empty)"
        : `"${answer.given}"`}
    </span>
  );
}
