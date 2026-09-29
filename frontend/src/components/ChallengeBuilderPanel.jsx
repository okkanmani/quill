import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createWorksheetFromBuilder,
  generateWorksheetDraft,
  getAdminSettings,
  getWorksheet,
  updateWorksheetFromBuilder,
} from "../api";
import QuillLoading from "./QuillLoading";
import WorksheetBuilderPreview from "./WorksheetBuilderPreview";
import { QUESTION_INDEX_BUTTON_CLASS } from "./rowActionButtonStyles";
import { useShellLayout } from "./ShellLayoutContext";
import {
  CREATE_BODY,
  CREATE_FIELD_HINT,
  CREATE_FIELD_LABEL,
  CREATE_FOOTER_STATUS,
  CREATE_PUBLISH_BUTTON,
  CREATE_SECTION_TITLE,
  CREATE_SECTION_TITLE_ACCENT,
  CREATE_STICKY_ACTION_BAR,
  CREATE_STICKY_ACTION_LINK,
} from "../createTypography";
import {
  CCAT_SUBJECTS,
  CHOICE_LABELS,
  GIFTED_TRACK_WEEKS,
  GRADE_OPTIONS,
  PREP_PROGRAMS,
  STARS_OPTIONS,
  buildQuestionList,
  challengeBuilderPayload,
  defaultQuestionCount,
  draftToBuilderQuestions,
  formatForPrepProgram,
  subjectForPrepProgram,
  validateChallengeBuilderForm,
  worksheetToChallengeState,
} from "../challengeBuilderUtils";
import { buildWorksheetPreviewFromBuilder } from "../questionBuilderUtils";
import { usePreviewScrollSync } from "../usePreviewScrollSync";

function McqChoices({ question, index, onChange }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Choices — mark the correct answer
      </p>
      {CHOICE_LABELS.map((label, choiceIndex) => {
        const selected = question.correctIndex === choiceIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(index, { correctIndex: choiceIndex })}
              className={`${QUESTION_INDEX_BUTTON_CLASS} ${
                selected
                  ? "bg-emerald-600 border-emerald-700 text-white"
                  : "bg-white border-slate-300 text-slate-500 hover:border-emerald-400"
              }`}
              aria-pressed={selected}
            >
              {selected ? "✓" : label}
            </button>
            <input
              type="text"
              value={question.choices[choiceIndex]}
              onChange={(e) => {
                const next = [...question.choices];
                next[choiceIndex] = e.target.value;
                onChange(index, { choices: next });
              }}
              placeholder={`Choice ${label}`}
              className="quill-field-input flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}

function QuestionEditor({ question, index, format, expanded, onToggle, onChange }) {
  const complete =
    format === "multiple_choice"
      ? question.prompt.trim() &&
        question.choices.every((c) => c.trim()) &&
        question.correctIndex >= 0
      : question.prompt.trim() && question.answer.trim();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(index)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100"
      >
        <span className="text-sm font-semibold text-slate-900 truncate">
          Q{index + 1}: {question.prompt.trim() || "Empty prompt"}
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {complete ? "Complete" : "Incomplete"} {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded ? (
        <div className="p-4 border-t border-slate-100 space-y-3">
          <label className={CREATE_FIELD_LABEL}>
            Prompt
            <textarea
              value={question.prompt}
              onChange={(e) => onChange(index, { prompt: e.target.value })}
              rows={3}
              className="quill-field-textarea mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className={CREATE_FIELD_LABEL}>
            Area
            <input
              type="text"
              value={question.area || ""}
              onChange={(e) => onChange(index, { area: e.target.value })}
              className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. verbal analogy, number series"
            />
          </label>
          {format === "multiple_choice" ? (
            <McqChoices question={question} index={index} onChange={onChange} />
          ) : (
            <label className={CREATE_FIELD_LABEL}>
              Reference answer (for grading)
              <input
                type="text"
                value={question.answer}
                onChange={(e) => onChange(index, { answer: e.target.value })}
                className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ChallengeBuilderPanel() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { setSidebarCollapsed } = useShellLayout();
  const didAutoCollapse = useRef(false);
  const initialGrade = Number(localStorage.getItem("studentGrade")) || 5;

  const [prepProgram, setPrepProgram] = useState("ccat");
  const [title, setTitle] = useState("");
  const [ccatSubject, setCcatSubject] = useState("general");
  const [grade, setGrade] = useState(initialGrade);
  const [stars, setStars] = useState(2);
  const [questionCount, setQuestionCount] = useState(defaultQuestionCount(2));
  const [format, setFormat] = useState("multiple_choice");
  const [questions, setQuestions] = useState(() =>
    buildQuestionList(defaultQuestionCount(2), "multiple_choice"),
  );
  const [giftedTrackWeek, setGiftedTrackWeek] = useState(1);
  const [contentBadge, setContentBadge] = useState("");
  const [timed, setTimed] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [scratchpad, setScratchpad] = useState(true);
  const [buildUsingAi, setBuildUsingAi] = useState(true);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set([0]));
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewFocusQuestionIndex, setPreviewFocusQuestionIndex] = useState(null);

  const subject = subjectForPrepProgram(prepProgram, ccatSubject);

  useEffect(() => {
    if (!didAutoCollapse.current) {
      setSidebarCollapsed(true);
      didAutoCollapse.current = true;
    }
  }, [setSidebarCollapsed]);

  useEffect(() => {
    getAdminSettings()
      .then((data) => setAiEnabled(data.ai_worksheet_enabled !== false))
      .catch(() => setAiEnabled(true));
  }, []);

  useEffect(() => {
    const nextFormat = formatForPrepProgram(prepProgram);
    setFormat(nextFormat);
    if (prepProgram === "gauss") {
      setScratchpad(true);
      setContentBadge((b) => b || "Contest");
    } else if (prepProgram === "ccat") {
      setContentBadge((b) => b || "CCAT");
    } else if (prepProgram === "thinking_quest") {
      setContentBadge((b) => b || "Quest 1");
    }
  }, [prepProgram]);

  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    getWorksheet(editId)
      .then((ws) => {
        const state = worksheetToChallengeState(ws);
        setPrepProgram(state.prepProgram);
        setTitle(state.title);
        setCcatSubject(state.subject);
        setStars(state.stars);
        setFormat(state.format);
        setQuestionCount(state.questionCount);
        setQuestions(state.questions);
        setGiftedTrackWeek(state.giftedTrackWeek);
        setContentBadge(state.contentBadge);
        setTimed(state.timed);
        setTimeLimitMinutes(state.timeLimitMinutes);
        setScratchpad(state.scratchpad);
        setBuildUsingAi(false);
      })
      .catch(() => setError("Could not load worksheet for editing."))
      .finally(() => setLoadingEdit(false));
  }, [editId]);

  function handleProgramChange(next) {
    setPrepProgram(next);
    const nextFormat = formatForPrepProgram(next);
    const count = questionCount || defaultQuestionCount(stars);
    setQuestions(buildQuestionList(count, nextFormat));
    setExpanded(new Set([0]));
  }

  function handleStarsChange(nextStars) {
    setStars(nextStars);
    const count = defaultQuestionCount(nextStars);
    setQuestionCount(count);
    setQuestions(buildQuestionList(count, format));
  }

  function updateQuestion(index, patch) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function toggleExpanded(index) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const previewModel = useMemo(
    () =>
      buildWorksheetPreviewFromBuilder({
        title: title || "Challenge worksheet preview",
        subject,
        stars,
        format,
        questions,
        questionCount: questions.length,
        timed,
        timeLimitMinutes,
        scratchpad,
        buildUsingAi,
      }),
    [title, subject, stars, format, questions, timed, timeLimitMinutes, scratchpad, buildUsingAi],
  );

  const scrollSyncResyncKey = useMemo(
    () => `${questions.length}-${[...expanded].join(",")}`,
    [questions.length, expanded],
  );

  const { registerQuestion } = usePreviewScrollSync({
    enabled: previewOpen,
    onFocusQuestion: setPreviewFocusQuestionIndex,
    resyncKey: scrollSyncResyncKey,
  });

  async function handlePublish() {
    setError("");
    setSuccess("");

    if (buildUsingAi && !editId) {
      if (!aiEnabled) {
        setError("AI generation is disabled in settings.");
        return;
      }
      setPublishing(true);
      setPublishPhase("Generating with AI…");
      try {
        const draft = await generateWorksheetDraft({
          subject,
          grade,
          stars,
          format,
          question_count: questionCount,
          custom_prompt: aiCustomPrompt.trim(),
          prep_program: prepProgram,
        });
        const generatedTitle = title.trim() || draft.title || "";
        const generatedQuestions = draftToBuilderQuestions(draft, format);
        setTitle(generatedTitle);
        setQuestions(generatedQuestions);
        setQuestionCount(generatedQuestions.length);
        setBuildUsingAi(false);
        setExpanded(new Set([0]));
        setPreviewOpen(true);
        setSuccess(
          prepProgram === "thinking_quest"
            ? `AI generated ${generatedQuestions.length} questions — add or adjust reference answers, then publish.`
            : `AI generated ${generatedQuestions.length} questions — review and publish when ready.`,
        );
      } catch (err) {
        setError(err.message || "Could not generate worksheet.");
      } finally {
        setPublishing(false);
        setPublishPhase("");
      }
      return;
    }

    const validationErrors = validateChallengeBuilderForm({
      title,
      prepProgram,
      questions,
      format,
      giftedTrackWeek,
    });
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }

    const payload = challengeBuilderPayload({
      title,
      prepProgram,
      subject: ccatSubject,
      stars,
      format,
      questionCount: questions.length,
      timed,
      timeLimitMinutes,
      scratchpad,
      questions,
      giftedTrackWeek,
      contentBadge,
    });

    setPublishing(true);
    setPublishPhase(editId ? "Saving…" : "Publishing…");
    try {
      if (editId) {
        await updateWorksheetFromBuilder(editId, payload);
        setSuccess("Worksheet saved.");
      } else {
        const result = await createWorksheetFromBuilder(payload);
        setSuccess(`Published as ${result.id}.`);
      }
    } catch (err) {
      setError(err.message || "Could not publish worksheet.");
    } finally {
      setPublishing(false);
      setPublishPhase("");
    }
  }

  if (loadingEdit) {
    return <QuillLoading label="Loading worksheet…" />;
  }

  const selectedProgram = PREP_PROGRAMS.find((p) => p.value === prepProgram);

  return (
    <div className={CREATE_BODY}>
      <p className="text-sm text-slate-600 mb-6">
        Build CCAT, contest math, or Thinking Quest worksheets with program-specific AI prompts.
        Students see them under Ability prep, Math Enrichment, or Thinking Quest.
      </p>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className={CREATE_SECTION_TITLE}>Program</h2>
            <div className="mt-3 flex flex-col gap-2">
              {PREP_PROGRAMS.map((p) => (
                <label
                  key={p.value}
                  className={`flex gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                    prepProgram === p.value
                      ? "border-violet-400 bg-violet-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="prepProgram"
                    value={p.value}
                    checked={prepProgram === p.value}
                    onChange={() => handleProgramChange(p.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{p.label}</span>
                    <span className="block text-xs text-slate-600 mt-0.5">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className={CREATE_SECTION_TITLE}>Details</h2>
            <label className={CREATE_FIELD_LABEL}>
              Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={buildUsingAi && !editId ? "Optional — AI can suggest" : "Worksheet title"}
                className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {prepProgram === "ccat" ? (
              <label className={CREATE_FIELD_LABEL}>
                CCAT focus
                <select
                  value={ccatSubject}
                  onChange={(e) => setCcatSubject(e.target.value)}
                  className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {CCAT_SUBJECTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {prepProgram === "thinking_quest" ? (
              <>
                <label className={CREATE_FIELD_LABEL}>
                  Week (1–12)
                  <select
                    value={giftedTrackWeek}
                    onChange={(e) => setGiftedTrackWeek(Number(e.target.value))}
                    className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {GIFTED_TRACK_WEEKS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={CREATE_FIELD_LABEL}>
                  Quest badge
                  <input
                    type="text"
                    value={contentBadge}
                    onChange={(e) => setContentBadge(e.target.value)}
                    placeholder="Quest 1"
                    className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </>
            ) : (
              <label className={CREATE_FIELD_LABEL}>
                Content badge
                <input
                  type="text"
                  value={contentBadge}
                  onChange={(e) => setContentBadge(e.target.value)}
                  placeholder={prepProgram === "gauss" ? "Contest" : "CCAT"}
                  className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <label className={CREATE_FIELD_LABEL}>
                Grade (for AI)
                <select
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {GRADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={CREATE_FIELD_LABEL}>
                Difficulty
                <select
                  value={stars}
                  onChange={(e) => handleStarsChange(Number(e.target.value))}
                  className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {STARS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.count} Q)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={scratchpad}
                onChange={(e) => setScratchpad(e.target.checked)}
              />
              Scratch pad
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
              />
              Timed worksheet
            </label>
            {timed ? (
              <label className={CREATE_FIELD_LABEL}>
                Time limit (minutes)
                <input
                  type="number"
                  min={1}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="quill-field-input mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ) : null}
          </section>

          {!editId ? (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
              <h2 className={CREATE_SECTION_TITLE_ACCENT}>AI generation</h2>
              <p className="text-sm text-violet-950/90 mt-1">
                {selectedProgram?.label} uses a dedicated prompt (not the general worksheet
                builder). {format === "short_answer" ? "You will add reference answers after generate." : ""}
              </p>
              <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-violet-950">
                <input
                  type="checkbox"
                  checked={buildUsingAi}
                  onChange={(e) => setBuildUsingAi(e.target.checked)}
                />
                Generate questions with AI on publish
              </label>
              {buildUsingAi ? (
                <label className="block mt-4 text-sm font-semibold text-violet-950">
                  Additional instructions (optional)
                  <textarea
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="e.g. heavier number series, no verbal analogies…"
                    className="quill-field-textarea mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
            </section>
          ) : null}

          {!buildUsingAi || editId ? (
            <section className="space-y-3">
              <h2 className={CREATE_SECTION_TITLE}>Questions ({questions.length})</h2>
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={i}
                  format={format}
                  expanded={expanded.has(i)}
                  onToggle={toggleExpanded}
                  onChange={updateQuestion}
                />
              ))}
            </section>
          ) : null}
        </div>

        {previewOpen ? (
          <div className="lg:sticky lg:top-6 min-w-0 hidden lg:block">
            <WorksheetBuilderPreview
              model={previewModel}
              focusQuestionIndex={previewFocusQuestionIndex}
            />
          </div>
        ) : null}
      </div>

      <div className={CREATE_STICKY_ACTION_BAR}>
        <p className={CREATE_FOOTER_STATUS}>
          {publishPhase || (editId ? "Edit challenge worksheet" : "New challenge worksheet")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/worksheets" className={CREATE_STICKY_ACTION_LINK}>
            Worksheets library
          </Link>
          <button
            type="button"
            disabled={publishing}
            onClick={handlePublish}
            className={CREATE_PUBLISH_BUTTON}
          >
            {publishing
              ? publishPhase || "Working…"
              : buildUsingAi && !editId
                ? "Generate worksheet"
                : editId
                  ? "Save changes"
                  : "Publish worksheet"}
          </button>
        </div>
      </div>
    </div>
  );
}
