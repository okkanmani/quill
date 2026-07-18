import { useEffect, useRef } from "react";
import { DifficultyStars, QuestionDifficultyStars } from "./DifficultyStars";
import WorksheetPassageContent from "./WorksheetPassageContent";

function scrollWithinContainer(container, element, offset = 12) {
  if (!container || !element) return;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const nextTop =
    elementRect.top - containerRect.top + container.scrollTop - offset;
  container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

function PreviewQuestionCard({
  question,
  index,
  manual,
  scratchpadAllowed,
  innerRef,
  isFocused = false,
}) {
  const promptClass = question.promptPlaceholder
    ? "text-slate-400 italic"
    : "text-slate-900";

  return (
    <div
      ref={innerRef}
      className={`bg-white border rounded-2xl p-5 shadow-sm transition-shadow ${
        isFocused
          ? "border-indigo-300 ring-2 ring-indigo-200 ring-offset-2 ring-offset-slate-50"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className={`font-medium flex-1 ${promptClass}`}>
          {index + 1}. {question.prompt}
        </p>
        <QuestionDifficultyStars stars={question.stars} />
      </div>

      {question.aiPlaceholder ? (
        <p className="text-xs font-semibold text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 inline-flex">
          Generated at publish
        </p>
      ) : null}

      {question.type === "multiple_choice" ? (
        <div className="flex flex-col gap-2 mt-3">
          {(question.choices || []).map((choice) => (
            <div
              key={choice}
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white"
            >
              {choice}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          {manual && scratchpadAllowed ? (
            <div className="flex flex-col gap-2 shrink-0 opacity-60">
              <div className="w-9 h-9 rounded-xl border border-slate-300 bg-slate-50" />
              <div className="w-9 h-9 rounded-xl border border-slate-300 bg-slate-50" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400 bg-slate-50 min-h-[6rem]">
            Type your answer and show your reasoning…
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorksheetBuilderPreview({
  model,
  focusQuestionIndex = null,
  focusPassageId = null,
}) {
  const scrollContainerRef = useRef(null);
  const questionRefs = useRef({});
  const passageRefs = useRef({});

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const run = () => {
      if (focusQuestionIndex != null) {
        const target = questionRefs.current[focusQuestionIndex];
        if (target) scrollWithinContainer(container, target);
        return;
      }

      if (focusPassageId) {
        const target = passageRefs.current[focusPassageId];
        if (target) scrollWithinContainer(container, target);
      }
    };

    requestAnimationFrame(run);
  }, [focusQuestionIndex, focusPassageId]);

  if (!model) return null;

  const manual = model.evaluation === "manual";
  const passages = Array.isArray(model.passages) ? model.passages : [];
  const hasReadingPassages = passages.length > 0;
  const scratchpadAllowed = model.scratchpad !== false;

  function setQuestionRef(index) {
    return (node) => {
      if (node) questionRefs.current[index] = node;
      else delete questionRefs.current[index];
    };
  }

  function setPassageRef(passageId) {
    return (node) => {
      if (node) passageRefs.current[passageId] = node;
      else delete passageRefs.current[passageId];
    };
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Student preview
        </p>
        {model.buildUsingAi ? (
          <p className="text-xs text-amber-900 mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 leading-relaxed">
            AI placeholders show where content will appear after generation.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{model.title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <p className="text-indigo-500 capitalize">
            {model.subject} · {model.questions.length} question
            {model.questions.length === 1 ? "" : "s"}
          </p>
          {model.timed && model.time_limit_minutes ? (
            <span className="text-rose-700 text-xs font-semibold rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5">
              Timed · {model.time_limit_minutes} min
            </span>
          ) : null}
          {manual ? (
            <span className="text-amber-700 text-xs font-semibold rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5">
              Written answers
            </span>
          ) : null}
          <DifficultyStars
            min={model.difficulty_min}
            max={model.difficulty_max}
            size="lg"
          />
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 pt-4">
        <div className="flex flex-col gap-6">
          {hasReadingPassages ? (
            <>
              {passages.map((passage) => {
                const passageQuestions = model.questions.filter(
                  (question) => question.passage_id === passage.id,
                );
                return (
                  <div
                    key={passage.id}
                    ref={setPassageRef(passage.id)}
                    className="flex flex-col gap-4 scroll-mt-4"
                  >
                    {passage.bodyPlaceholder && !passage.aiPlaceholder ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
                        <p className="text-slate-800 font-semibold text-base mb-3">
                          📖 {passage.title}
                        </p>
                        <p className="text-sm text-slate-400 italic leading-relaxed whitespace-pre-line">
                          {passage.body}
                        </p>
                      </div>
                    ) : (
                      <WorksheetPassageContent passage={passage} />
                    )}
                    <div className="flex flex-col gap-4">
                      {passageQuestions.map((question) => {
                        const index = model.questions.indexOf(question);
                        return (
                          <PreviewQuestionCard
                            key={question.id}
                            question={question}
                            index={index}
                            manual={manual}
                            scratchpadAllowed={scratchpadAllowed}
                            innerRef={setQuestionRef(index)}
                            isFocused={focusQuestionIndex === index}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {model.questions.some((question) => !question.passage_id) ? (
                <div className="flex flex-col gap-4">
                  {model.questions
                    .filter((question) => !question.passage_id)
                    .map((question) => {
                      const index = model.questions.indexOf(question);
                      return (
                        <PreviewQuestionCard
                          key={question.id}
                          question={question}
                          index={index}
                          manual={manual}
                          scratchpadAllowed={scratchpadAllowed}
                          innerRef={setQuestionRef(index)}
                          isFocused={focusQuestionIndex === index}
                        />
                      );
                    })}
                </div>
              ) : null}
            </>
          ) : (
            model.questions.map((question, index) => (
              <PreviewQuestionCard
                key={question.id}
                question={question}
                index={index}
                manual={manual}
                scratchpadAllowed={scratchpadAllowed}
                innerRef={setQuestionRef(index)}
                isFocused={focusQuestionIndex === index}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
