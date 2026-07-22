import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createWorksheetFromBuilder,
  generateWorksheetDraft,
  getAdminLearnLinkOptions,
  getAdminSettings,
  getWorksheet,
  listAdminStudents,
  updateWorksheetFromBuilder,
} from "../api";
import QuillLoading from "./QuillLoading";
import WorksheetBuilderPreview from "./WorksheetBuilderPreview";
import { useShellLayout } from "./ShellLayoutContext";
import {
  BUILDER_SUBJECTS,
  CHOICE_LABELS,
  ENGLISH_TYPES,
  GRADE_OPTIONS,
  STARS_OPTIONS,
  builderPayload,
  buildDefaultRcPassages,
  buildQuestionList,
  buildQuestionsFromPassages,
  buildWorksheetPreviewFromBuilder,
  addRcPassage,
  removeRcPassageAt,
  defaultQuestionCount,
  DEFAULT_RC_MIN_WORDS,
  defaultScratchpadForSubject,
  draftRcToBuilderState,
  draftToBuilderQuestions,
  groupQuestionsByPassage,
  isBuilderQuestionComplete,
  aiGeneratesReferenceAnswers,
  totalRcQuestionCount,
  resizeQuestions,
  validateBuilderForm,
  validateBuilderParamsForAi,
  worksheetToBuilderState,
} from "../questionBuilderUtils";
import { usePreviewScrollSync } from "../usePreviewScrollSync";

function McqChoices({ question, index, onChange }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-600">
        Choices — mark the correct answer
      </p>
      {CHOICE_LABELS.map((label, choiceIndex) => {
        const selected = question.correctIndex === choiceIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(index, { correctIndex: choiceIndex })}
              className={`shrink-0 w-9 h-9 rounded-full border text-sm font-bold transition ${
                selected
                  ? "bg-emerald-600 border-emerald-700 text-white"
                  : "bg-white border-slate-300 text-slate-500 hover:border-emerald-400"
              }`}
              title={selected ? "Correct answer" : "Mark as correct"}
              aria-label={`Mark choice ${label} as correct`}
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
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        );
      })}
    </div>
  );
}

function PassageCard({
  passage,
  index,
  expanded,
  onToggle,
  onChange,
  buildUsingAi = false,
  format = "multiple_choice",
  passageQuestions = [],
  expandedQuestions,
  onToggleQuestion,
  onChangeQuestion,
  onFocusQuestion,
  registerPassage,
  registerQuestion,
}) {
  const summary = passage.title.trim() || `Passage ${index + 1}`;
  const questionsComplete =
    buildUsingAi ||
    passageQuestions.every(({ question }) =>
      isBuilderQuestionComplete(question, format),
    );
  const complete = buildUsingAi
    ? Number(passage.questionCount) > 0 && Number(passage.minWords) >= 50
    : passage.title.trim() && passage.body.trim() && questionsComplete;
  const showQuestions = !buildUsingAi && passageQuestions.length > 0;

  return (
    <div
      ref={registerPassage ? (node) => registerPassage(passage.id, node) : undefined}
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onToggle(index)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-sky-50 hover:bg-sky-100 transition"
      >
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">Passage {index + 1}</span>
          <span className="block text-sm text-slate-600 truncate mt-0.5">
            {summary}
            {passage.questionCount
              ? ` · ${passage.questionCount} question${passage.questionCount === 1 ? "" : "s"}`
              : ""}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-2">
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${
              complete
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            {complete ? "Complete" : "Incomplete"}
          </span>
          <span className="text-slate-700 font-bold text-sm">{expanded ? "▼" : "▶"}</span>
        </span>
      </button>
      {expanded ? (
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div
            className={`grid gap-4 ${
              buildUsingAi ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <label className="block text-sm font-semibold text-slate-800">
              Passage title
              <input
                type="text"
                value={passage.title}
                onChange={(e) => onChange(index, { title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Life in the Arctic"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Questions for this passage
              <input
                type="number"
                min={1}
                max={15}
                value={passage.questionCount}
                onChange={(e) =>
                  onChange(index, {
                    questionCount: Math.max(1, Math.min(15, Number(e.target.value) || 1)),
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            {buildUsingAi ? (
              <label className="block text-sm font-semibold text-slate-800">
                Minimum words
                <input
                  type="number"
                  min={50}
                  max={2000}
                  value={passage.minWords ?? DEFAULT_RC_MIN_WORDS}
                  onChange={(e) =>
                    onChange(index, {
                      minWords: Math.max(
                        50,
                        Math.min(2000, Number(e.target.value) || DEFAULT_RC_MIN_WORDS),
                      ),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ) : null}
          </div>
          {buildUsingAi ? (
            <label className="block text-sm font-semibold text-slate-800">
              Passage prompt{" "}
              <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                value={passage.aiPrompt || ""}
                onChange={(e) => onChange(index, { aiPrompt: e.target.value })}
                rows={3}
                maxLength={1000}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed resize-y"
                placeholder="e.g. Focus on climate change in the Arctic, include vocabulary about ecosystems…"
              />
            </label>
          ) : (
            <label className="block text-sm font-semibold text-slate-800">
              Passage text
              <textarea
                value={passage.body}
                onChange={(e) => onChange(index, { body: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed resize-y min-h-[10rem]"
                placeholder="Paste or type the reading passage."
              />
            </label>
          )}
          {showQuestions ? (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Questions ({passageQuestions.length})
              </h3>
              {passageQuestions.map(({ question, globalIndex, localIndex }) => (
                <QuestionCard
                  key={globalIndex}
                  question={question}
                  index={localIndex}
                  syncIndex={globalIndex}
                  registerQuestion={registerQuestion}
                  format={format}
                  expanded={expandedQuestions.has(globalIndex)}
                  onToggle={() => onToggleQuestion(globalIndex)}
                  onChange={(_, patch) => onChangeQuestion(globalIndex, patch)}
                  onFocus={() => onFocusQuestion?.(globalIndex)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  format,
  expanded,
  onToggle,
  onChange,
  onFocus,
  passageLabel = "",
  syncIndex = null,
  registerQuestion,
}) {
  const summary =
    question.prompt.trim() ||
    (format === "multiple_choice" ? "Empty multiple choice" : "Empty short answer");
  const complete = isBuilderQuestionComplete(question, format);

  return (
    <div
      ref={
        syncIndex != null && registerQuestion
          ? (node) => registerQuestion(syncIndex, node)
          : undefined
      }
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onToggle(index)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition"
      >
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">
            {passageLabel ? `${passageLabel} · ` : ""}Question {index + 1}
          </span>
          <span className="block text-sm text-slate-600 truncate mt-0.5">{summary}</span>
        </span>
        <span className="shrink-0 flex items-center gap-2">
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${
              complete
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            {complete ? "Complete" : "Incomplete"}
          </span>
          <span className="text-slate-700 font-bold text-sm">{expanded ? "▼" : "▶"}</span>
        </span>
      </button>
      {expanded ? (
        <div className="p-4 border-t border-slate-100">
          <label className="block text-sm font-semibold text-slate-800">
            Prompt
            <textarea
              value={question.prompt}
              onChange={(e) => onChange(index, { prompt: e.target.value })}
              onFocus={() => onFocus?.(index)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Enter the question text"
            />
          </label>
          <label className="block mt-3 text-sm font-semibold text-slate-800">
            Area
            <input
              type="text"
              value={question.area || ""}
              onChange={(e) => onChange(index, { area: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="e.g. vocabulary, inference, main idea"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500 leading-relaxed">
              Be specific — use a narrow skill label (not just “reading”).
            </span>
          </label>
          {format === "multiple_choice" ? (
            <McqChoices question={question} index={index} onChange={onChange} />
          ) : (
            <label className="block mt-3 text-sm font-semibold text-slate-800">
              Reference answer (for grading; hidden from students)
              <input
                type="text"
                value={question.answer}
                onChange={(e) => onChange(index, { answer: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Expected answer"
              />
            </label>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function QuestionBuilderPanel() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { sidebarCollapsed, setSidebarCollapsed } = useShellLayout();
  const didAutoCollapseSidebar = useRef(false);
  const initialGrade = Number(localStorage.getItem("studentGrade")) || 5;
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("math");
  const [englishType, setEnglishType] = useState("");
  const [passages, setPassages] = useState([]);
  const [grade, setGrade] = useState(initialGrade);
  const [stars, setStars] = useState(2);
  const [format, setFormat] = useState("multiple_choice");
  const [scratchpad, setScratchpad] = useState(() => defaultScratchpadForSubject("math"));
  const [questionCount, setQuestionCount] = useState(defaultQuestionCount(2));
  const [timed, setTimed] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [learnResourceKey, setLearnResourceKey] = useState("");
  const [learnResourceOptions, setLearnResourceOptions] = useState([]);
  const [learnResourcesLoading, setLearnResourcesLoading] = useState(false);
  const [lockOnCreate, setLockOnCreate] = useState(false);
  const [questions, setQuestions] = useState(() =>
    buildQuestionList(defaultQuestionCount(2), "multiple_choice"),
  );
  const [expanded, setExpanded] = useState(() => new Set([0]));
  const [expandedPassages, setExpandedPassages] = useState(() => new Set([0]));
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [buildUsingAi, setBuildUsingAi] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState("build");
  const [previewFocusQuestionIndex, setPreviewFocusQuestionIndex] = useState(0);
  const [previewFocusPassageId, setPreviewFocusPassageId] = useState(null);

  useEffect(() => {
    if (previewOpen) return;
    setPreviewFocusPassageId(null);
  }, [previewOpen]);

  useEffect(() => {
    if (previewOpen) {
      setSidebarCollapsed((collapsed) => {
        if (!collapsed) {
          didAutoCollapseSidebar.current = true;
          return true;
        }
        didAutoCollapseSidebar.current = false;
        return collapsed;
      });
    } else if (didAutoCollapseSidebar.current) {
      setSidebarCollapsed(false);
      didAutoCollapseSidebar.current = false;
    }
  }, [previewOpen, setSidebarCollapsed]);

  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    setError("");
    getWorksheet(editId)
      .then((worksheet) => {
        const state = worksheetToBuilderState(worksheet);
        setTitle(state.title);
        setSubject(state.subject);
        setStars(state.stars);
        setFormat(state.format);
        setScratchpad(state.scratchpad);
        setEnglishType(state.englishType);
        setPassages(state.passages.length ? state.passages : []);
        setTimed(state.timed);
        setTimeLimitMinutes(state.timeLimitMinutes);
        setQuestionCount(state.questionCount);
        setQuestions(state.questions);
        if (state.learnSubject && state.learnSection) {
          setLearnResourceKey(`${state.learnSubject}:${state.learnSection}`);
        }
        setExpanded(new Set([0]));
        setExpandedPassages(new Set([0]));
      })
      .catch((err) => {
        setError(err.message || "Could not load worksheet for editing.");
      })
      .finally(() => setLoadingEdit(false));
  }, [editId]);

  useEffect(() => {
    listAdminStudents()
      .then((data) => {
        const current = localStorage.getItem("studentName");
        const match = (data.students || []).find((s) => s.name === current);
        if (match?.grade) setGrade(match.grade);
      })
      .catch(() => {});

    getAdminSettings()
      .then((data) => {
        setAiEnabled(Boolean(data.ai_enabled));
        setApiKeyConfigured(Boolean(data.openai_key_configured));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLearnResourcesLoading(true);
    getAdminLearnLinkOptions(subject)
      .then(({ options }) => {
        setLearnResourceOptions(options || []);
      })
      .catch(() => {
        setLearnResourceOptions([]);
      })
      .finally(() => {
        setLearnResourcesLoading(false);
      });
  }, [subject]);

  const selectedLearnResource = useMemo(() => {
    if (!learnResourceKey) return null;
    return (
      learnResourceOptions.find(
        (option) =>
          `${option.learn_subject}:${option.learn_section}` === learnResourceKey,
      ) || null
    );
  }, [learnResourceKey, learnResourceOptions]);

  const recommendedCount = useMemo(() => defaultQuestionCount(stars), [stars]);
  const countMismatch = questionCount !== recommendedCount;
  const isReadingComprehension =
    subject === "english" && englishType === "reading_comprehension";
  const isShortAnswer = format === "short_answer";
  const aiDraftNeedsReferenceAnswers =
    buildUsingAi && isShortAnswer && !aiGeneratesReferenceAnswers(subject);
  const rcQuestionTotal = useMemo(
    () => (isReadingComprehension ? totalRcQuestionCount(passages) : questionCount),
    [isReadingComprehension, passages, questionCount],
  );
  const rcPassageQuestionGroups = useMemo(
    () =>
      isReadingComprehension ? groupQuestionsByPassage(passages, questions) : [],
    [isReadingComprehension, passages, questions],
  );
  const previewModel = useMemo(
    () =>
      buildWorksheetPreviewFromBuilder({
        title,
        subject,
        stars,
        format,
        englishType,
        passages,
        questions,
        questionCount: isReadingComprehension ? rcQuestionTotal : questionCount,
        timed,
        timeLimitMinutes,
        scratchpad,
        buildUsingAi,
      }),
    [
      title,
      subject,
      stars,
      format,
      englishType,
      passages,
      questions,
      isReadingComprehension,
      rcQuestionTotal,
      questionCount,
      timed,
      timeLimitMinutes,
      scratchpad,
      buildUsingAi,
    ],
  );
  const footerSidebarClass = sidebarCollapsed ? "md:left-5" : "md:left-52";

  const scrollSyncResyncKey = useMemo(
    () =>
      `${questions.length}-${passages.length}-${[...expanded].join(",")}-${[...expandedPassages].join(",")}`,
    [questions.length, passages.length, expanded, expandedPassages],
  );

  const handleScrollFocusQuestion = useCallback((index) => {
    setPreviewFocusPassageId(null);
    setPreviewFocusQuestionIndex(index);
  }, []);

  const handleScrollFocusPassage = useCallback((passageId) => {
    setPreviewFocusQuestionIndex(null);
    setPreviewFocusPassageId(passageId);
  }, []);

  const { registerQuestion, registerPassage, markQuestionFocused, markPassageFocused } =
    usePreviewScrollSync({
      enabled: previewOpen,
      onFocusQuestion: handleScrollFocusQuestion,
      onFocusPassage: handleScrollFocusPassage,
      resyncKey: scrollSyncResyncKey,
    });

  useEffect(() => {
    if (!isReadingComprehension) return;
    setQuestionCount(rcQuestionTotal);
  }, [isReadingComprehension, rcQuestionTotal]);

  useEffect(() => {
    if (!isReadingComprehension) return;
    setQuestions((prev) => buildQuestionsFromPassages(passages, prev));
  }, [passages, isReadingComprehension]);

  function updatePassage(index, patch) {
    setPassages((prev) =>
      prev.map((passage, i) => (i === index ? { ...passage, ...patch } : passage)),
    );
  }

  function updateQuestion(index, patch) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function handleStarsChange(nextStars) {
    setStars(nextStars);
    if (isReadingComprehension) return;
    const nextCount = defaultQuestionCount(nextStars);
    setQuestionCount(nextCount);
    setQuestions((prev) => resizeQuestions(prev, nextCount, format));
  }

  function handleSubjectChange(nextSubject) {
    setSubject(nextSubject);
    setLearnResourceKey("");
    if (nextSubject === "english") {
      if (format === "short_answer") {
        setEnglishType("critical_reasoning");
        setPassages([]);
      } else {
        setEnglishType((current) => current || "critical_reasoning");
        setFormat("multiple_choice");
        setQuestions(buildQuestionList(questionCount, "multiple_choice"));
      }
    } else {
      setEnglishType("");
      setPassages([]);
    }
    setScratchpad(defaultScratchpadForSubject(nextSubject));
  }

  function handleEnglishTypeChange(nextType) {
    setEnglishType(nextType);
    if (nextType === "reading_comprehension") {
      if (format === "short_answer") {
        setFormat("multiple_choice");
        setQuestions(buildQuestionList(questionCount, "multiple_choice"));
      }
      const nextPassages = buildDefaultRcPassages();
      setPassages(nextPassages);
      setQuestions(buildQuestionsFromPassages(nextPassages));
      setExpandedPassages(new Set([0]));
      return;
    }
    setPassages([]);
    setQuestions(buildQuestionList(questionCount, "multiple_choice"));
  }

  function handleAddPassage() {
    const next = addRcPassage(passages, questions);
    setPassages(next.passages);
    setQuestions(next.questions);
    setExpandedPassages(new Set([next.passages.length - 1]));
  }

  function handleRemovePassage(index) {
    const next = removeRcPassageAt(passages, questions, index);
    setPassages(next.passages);
    setQuestions(next.questions);
  }

  function handleFormatChange(nextFormat) {
    setFormat(nextFormat);
    if (nextFormat === "short_answer") {
      if (englishType === "reading_comprehension") {
        setEnglishType("critical_reasoning");
        setPassages([]);
      }
      setScratchpad(defaultScratchpadForSubject(subject));
    }
    setQuestions(buildQuestionList(questionCount, nextFormat));
    setExpanded(new Set([0]));
  }

  function handleQuestionCountChange(raw) {
    if (isReadingComprehension) return;
    const n = Math.max(1, Math.min(50, Number(raw) || 1));
    setQuestionCount(n);
    setQuestions((prev) => resizeQuestions(prev, n, format));
  }

  function focusPreviewQuestion(index) {
    markQuestionFocused(index);
    setPreviewFocusPassageId(null);
    setPreviewFocusQuestionIndex(index);
  }

  function focusPreviewPassage(passageIndex) {
    const passage = passages[passageIndex];
    if (!passage) return;
    markPassageFocused(passage.id);
    setPreviewFocusQuestionIndex(null);
    setPreviewFocusPassageId(passage.id);
  }

  function togglePassageExpanded(index) {
    let willExpand = false;
    setExpandedPassages((prev) => {
      const next = new Set(prev);
      willExpand = !next.has(index);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    if (willExpand) focusPreviewPassage(index);
  }

  function toggleExpanded(index) {
    let willExpand = false;
    setExpanded((prev) => {
      const next = new Set(prev);
      willExpand = !next.has(index);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    if (willExpand) focusPreviewQuestion(index);
  }

  function revealGeneratedWorksheet({
    generatedTitle,
    generatedQuestions,
    generatedPassages = null,
  }) {
    setTitle(generatedTitle);
    setQuestions(generatedQuestions);
    if (generatedPassages) {
      setPassages(generatedPassages);
      setQuestionCount(generatedQuestions.length);
      setExpandedPassages(new Set([0]));
    }
    setBuildUsingAi(false);
    setExpanded(new Set([0]));
    focusPreviewQuestion(0);
    setPreviewOpen(true);
    setMobilePane("build");

    const count = generatedQuestions.length;
    const needsAnswers = isShortAnswer && !aiGeneratesReferenceAnswers(subject);
    setSuccess(
      needsAnswers
        ? `AI generated ${count} question${count === 1 ? "" : "s"} — add reference answers, review in preview, then publish.`
        : `AI generated ${count} question${count === 1 ? "" : "s"} — review in the builder and preview, then publish when ready.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePublish() {
    setError("");
    setSuccess("");

    if (buildUsingAi) {
      const paramErrors = validateBuilderParamsForAi({
        subject,
        format,
        englishType,
        passages,
        timed,
        timeLimitMinutes,
        questionCount: isReadingComprehension ? rcQuestionTotal : questionCount,
        apiKeyConfigured,
        aiEnabled,
      });
      if (paramErrors.length > 0) {
        setError(paramErrors.join(" "));
        return;
      }
    } else {
      const validationErrors = validateBuilderForm({
        title,
        subject,
        format,
        englishType,
        passages,
        timed,
        timeLimitMinutes,
        questions,
      });
      if (validationErrors.length > 0) {
        setError(validationErrors.join(" "));
        return;
      }
    }

    setPublishing(true);
    try {
      let publishTitle = title.trim();
      let publishQuestions = questions;
      let publishPassages = passages;

      if (buildUsingAi) {
        setPublishPhase("Generating with AI…");
        if (isReadingComprehension) {
          const draft = await generateWorksheetDraft({
            subject,
            grade,
            stars,
            format,
            english_type: "reading_comprehension",
            passage_specs: passages.map((passage) => ({
              id: passage.id,
              question_count: Math.max(1, Number(passage.questionCount) || 1),
              prompt: (passage.aiPrompt || "").trim(),
              min_words:
                Math.max(50, Number(passage.minWords) || DEFAULT_RC_MIN_WORDS),
            })),
            custom_prompt: aiCustomPrompt.trim(),
          });
          const rc = draftRcToBuilderState(draft);
          publishTitle = publishTitle || rc.title;
          publishQuestions = rc.questions;
          publishPassages = rc.passages;
        } else {
          const draft = await generateWorksheetDraft({
            subject,
            grade,
            stars,
            format,
            question_count: questionCount,
            custom_prompt: aiCustomPrompt.trim(),
          });
          publishTitle = publishTitle || draft.title;
          publishQuestions = draftToBuilderQuestions(draft, format);
        }

        revealGeneratedWorksheet({
          generatedTitle: publishTitle,
          generatedQuestions: publishQuestions,
          generatedPassages: isReadingComprehension ? publishPassages : null,
        });
        return;
      }

      setPublishPhase(editId ? "Saving…" : "Publishing…");
      const payload = builderPayload({
        title: publishTitle,
        subject,
        stars,
        format,
        englishType,
        passages: publishPassages,
        questionCount: isReadingComprehension ? publishQuestions.length : questionCount,
        timed,
        timeLimitMinutes,
        scratchpad,
        questions: publishQuestions,
        learnSubject: selectedLearnResource?.learn_subject,
        learnSection: selectedLearnResource?.learn_section,
        lockOnCreate,
      });
      const result = editId
        ? await updateWorksheetFromBuilder(editId, payload)
        : await createWorksheetFromBuilder(payload);
      const lockNote =
        !editId &&
        lockOnCreate &&
        typeof result.locked_for_students === "number"
          ? ` Locked for ${result.locked_for_students} student${
              result.locked_for_students === 1 ? "" : "s"
            }.`
          : !editId && lockOnCreate
            ? " Locked for your students."
            : "";
      setSuccess(
        editId
          ? `Saved changes to ${result.id} — “${result.title}” (${result.question_count} questions).`
          : `Published ${result.id} — “${result.title}” (${result.question_count} questions).${lockNote}`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err.message ||
          (buildUsingAi ? "Could not generate worksheet." : "Could not publish worksheet."),
      );
    } finally {
      setPublishing(false);
      setPublishPhase("");
    }
  }

  const canPublishWithAi = aiEnabled && apiKeyConfigured && !editId;
  const publishLabel = publishing
    ? publishPhase || (editId ? "Saving…" : "Publishing…")
    : buildUsingAi
      ? "Generate worksheet"
      : editId
        ? "Save changes"
        : "Publish worksheet";

  if (loadingEdit) {
    return <QuillLoading label="Loading worksheet…" />;
  }

  return (
    <>
      {previewOpen ? (
        <div className="lg:hidden flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMobilePane("build")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mobilePane === "build"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Build
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("preview")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mobilePane === "preview"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Preview
          </button>
        </div>
      ) : null}

      <div
        className={
          previewOpen ? "lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start" : undefined
        }
      >
        <div
          className={`min-w-0 ${
            previewOpen && mobilePane === "preview" ? "hidden lg:block" : ""
          }`}
        >
      <p className="text-slate-600 text-sm mb-6 leading-relaxed">
        {editId
          ? `Editing ${editId}. Mark the correct MCQ answer with ✓ — choices are shuffled on save.`
          : "Create a worksheet without JSON. Mark the correct MCQ answer with ✓ — choices are shuffled on publish."}
      </p>

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}{" "}
          <Link to="/admin/worksheets" className="font-semibold underline">
            View worksheets
          </Link>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-bold text-slate-900">Worksheet details</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPreviewOpen((open) => {
                  const next = !open;
                  if (next) {
                    setMobilePane("preview");
                    const firstExpandedQuestion = [...expanded].sort((a, b) => a - b)[0];
                    if (firstExpandedQuestion != null) {
                      focusPreviewQuestion(firstExpandedQuestion);
                    } else if (isReadingComprehension && passages.length > 0) {
                      const firstPassage = [...expandedPassages].sort((a, b) => a - b)[0] ?? 0;
                      focusPreviewPassage(firstPassage);
                    } else {
                      focusPreviewQuestion(0);
                    }
                  } else {
                    setMobilePane("build");
                  }
                  return next;
                });
              }}
              className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                previewOpen
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {previewOpen ? "Hide preview" : "Preview worksheet"}
            </button>
            <label
              className={`flex items-center gap-2 text-sm font-semibold ${
                aiEnabled && !editId ? "text-slate-800 cursor-pointer" : "text-slate-500"
              }`}
            >
              <input
                type="checkbox"
                checked={buildUsingAi}
                onChange={(e) => setBuildUsingAi(e.target.checked)}
                disabled={!aiEnabled || Boolean(editId)}
                className="rounded border-slate-300"
              />
              Build using AI
            </label>
          </div>
        </div>
        {buildUsingAi && !canPublishWithAi ? (
          <p className="text-sm text-amber-900 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 -mt-1">
            {!aiEnabled ? (
              "AI generation is disabled on this server."
            ) : (
              <>
                Add your OpenAI API key under{" "}
                <Link to="/admin/settings" className="font-semibold underline">
                  Admin → Settings
                </Link>{" "}
                before generating.
              </>
            )}
          </p>
        ) : null}

        <label className="block text-sm font-semibold text-slate-800">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder={
              buildUsingAi
                ? "Optional — AI will suggest a title if blank"
                : "e.g. Math — Fractions practice"
            }
          />
          {buildUsingAi ? (
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Leave blank to use the title from AI generation.
            </span>
          ) : null}
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm font-semibold text-slate-800">
            Subject
            <select
              value={subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {BUILDER_SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Target grade
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {subject === "english" ? (
          <label className="block text-sm font-semibold text-slate-800">
            English worksheet type
            <select
              value={englishType}
              onChange={(e) => handleEnglishTypeChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {ENGLISH_TYPES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    isShortAnswer && option.value === "reading_comprehension"
                  }
                >
                  {option.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500 leading-relaxed">
              {englishType === "reading_comprehension"
                ? buildUsingAi
                  ? "Configure passages below — set question counts and optional prompts per passage."
                  : "Add passage text and questions within each passage section below."
                : "Standard multiple-choice questions — some may stand alone without a passage."}
            </span>
          </label>
        ) : null}

        <label className="block text-sm font-semibold text-slate-800">
          Learning resource
          <select
            value={learnResourceKey}
            onChange={(e) => setLearnResourceKey(e.target.value)}
            disabled={learnResourcesLoading}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-100"
          >
            <option value="">
              {learnResourcesLoading
                ? "Loading resources…"
                : "None — no resource link"}
            </option>
            {learnResourceOptions.map((option) => {
              const value = `${option.learn_subject}:${option.learn_section}`;
              return (
                <option key={value} value={value}>
                  {option.label}
                </option>
              );
            })}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500 leading-relaxed">
            {learnResourceOptions.length === 0 && !learnResourcesLoading
              ? "No learning resources match this subject yet. Create one under Learning resource."
              : "Adds a Learn badge and Open Resource link on the worksheet for students."}
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Difficulty
          <select
            value={stars}
            onChange={(e) => handleStarsChange(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {STARS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count} questions recommended)
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-800 mb-2">
            Question format
          </legend>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/50">
              <input
                type="radio"
                name="format"
                checked={format === "multiple_choice"}
                onChange={() => handleFormatChange("multiple_choice")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Multiple choice
                </span>
                <span className="block text-xs text-slate-600">
                  Auto-graded · four choices per question
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 ${
                isReadingComprehension
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/50"
              }`}
            >
              <input
                type="radio"
                name="format"
                checked={format === "short_answer"}
                onChange={() => handleFormatChange("short_answer")}
                disabled={isReadingComprehension}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Short answer
                </span>
                <span className="block text-xs text-slate-600">
                  Manual grading · you mark each response
                  {isReadingComprehension ? " · not available for reading comprehension yet" : ""}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <label className="block text-sm font-semibold text-slate-800">
            {isReadingComprehension ? "Total questions" : "Number of questions"}
            <input
              type="number"
              min={1}
              max={50}
              value={isReadingComprehension ? rcQuestionTotal : questionCount}
              onChange={(e) => handleQuestionCountChange(e.target.value)}
              readOnly={isReadingComprehension}
              className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm ${
                isReadingComprehension ? "bg-slate-50 text-slate-600" : ""
              }`}
            />
            {isReadingComprehension ? (
              <span className="block text-xs text-slate-500 mt-1">
                Sum of question counts across all passages.
              </span>
            ) : countMismatch ? (
              <span className="block text-xs text-amber-800 mt-1">
                Recommended for this difficulty: {recommendedCount}
              </span>
            ) : null}
          </label>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
              />
              Timed worksheet
            </label>
            {timed ? (
              <label className="block text-sm text-slate-700 mt-2">
                Time limit (minutes)
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ) : null}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={lockOnCreate}
                onChange={(e) => setLockOnCreate(e.target.checked)}
                disabled={Boolean(editId)}
              />
              Lock worksheet on publish
            </label>
            <span className="mt-1 block text-xs font-normal text-slate-500 leading-relaxed">
              {editId
                ? "Use Worksheets to lock or unlock after publishing."
                : "Locks access for all of your students until you unlock it from Worksheets."}
            </span>
          </div>

          {isShortAnswer ? (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={scratchpad}
                  onChange={(e) => setScratchpad(e.target.checked)}
                />
                Allow scratchpad
              </label>
              <span className="mt-1 block text-xs font-normal text-slate-500 leading-relaxed">
                Lets students draw working per question. Default on for math and data;
                turn on for calculation-heavy science worksheets.
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {isReadingComprehension ? (
        <section className={`space-y-3 ${!buildUsingAi ? "mb-24" : "mb-6"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <h2 className="font-bold text-slate-900">
              Passages ({passages.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRemovePassage(passages.length - 1)}
                disabled={passages.length <= 1}
                className="w-9 h-9 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Remove last passage"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleAddPassage}
                className="w-9 h-9 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50"
                aria-label="Add passage"
              >
                +
              </button>
            </div>
          </div>
          {passages.map((passage, i) => (
            <PassageCard
              key={passage.id}
              passage={passage}
              index={i}
              expanded={expandedPassages.has(i)}
              onToggle={togglePassageExpanded}
              onChange={updatePassage}
              buildUsingAi={buildUsingAi}
              format={format}
              passageQuestions={rcPassageQuestionGroups[i] || []}
              expandedQuestions={expanded}
              onToggleQuestion={toggleExpanded}
              onChangeQuestion={updateQuestion}
              onFocusQuestion={focusPreviewQuestion}
              registerPassage={registerPassage}
              registerQuestion={registerQuestion}
            />
          ))}
        </section>
      ) : null}

      {buildUsingAi && !editId ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 mb-6">
          <h2 className="font-bold text-indigo-950 mb-2">AI generation</h2>
          <p className="text-sm text-indigo-900 leading-relaxed">
            {isReadingComprehension
              ? "Passages and questions will be generated from the specs above when you press Generate worksheet. Review them side-by-side with preview, then publish."
              : isShortAnswer && !aiGeneratesReferenceAnswers(subject)
                ? "AI will generate question prompts — you add reference answers, review in preview, then publish."
                : "Questions will be generated from the worksheet details above when you press Generate worksheet. Review them in the builder and preview, then publish."}{" "}
            Usage bills to your OpenAI account.
          </p>
          <label className="block mt-4 text-sm font-semibold text-indigo-950">
            Additional instructions{" "}
            <span className="font-normal text-indigo-800">(optional)</span>
            <textarea
              value={aiCustomPrompt}
              onChange={(e) => setAiCustomPrompt(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={
                isReadingComprehension
                  ? "e.g. Use Canadian spelling, grade-appropriate vocabulary, mix inference and vocabulary questions…"
                  : "e.g. Focus on word problems about money, use Canadian spelling, avoid decimals…"
              }
              className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y min-h-[6rem]"
            />
          </label>
          <p className="text-xs text-indigo-800/80 mt-1">
            These notes are sent to the AI along with subject, grade, and difficulty.
          </p>
        </section>
      ) : !buildUsingAi && !isReadingComprehension ? (
        <section className="space-y-3 mb-24">
          <h2 className="font-bold text-slate-900 px-1">
            Questions ({questions.length})
          </h2>
          {questions.map((q, i) => (
            <QuestionCard
              key={i}
              question={q}
              index={i}
              syncIndex={i}
              registerQuestion={registerQuestion}
              format={format}
              expanded={expanded.has(i)}
              onToggle={toggleExpanded}
              onChange={updateQuestion}
              onFocus={focusPreviewQuestion}
            />
          ))}
        </section>
      ) : (
        <div className="mb-24" />
      )}
        </div>

        {previewOpen ? (
          <div
            className={`lg:sticky lg:top-6 min-w-0 ${
              mobilePane === "build" ? "hidden lg:block" : ""
            }`}
          >
            <WorksheetBuilderPreview
              model={previewModel}
              focusQuestionIndex={previewFocusQuestionIndex}
              focusPassageId={previewFocusPassageId}
            />
          </div>
        ) : null}
      </div>

      <div
        className={`fixed bottom-0 inset-x-0 ${footerSidebarClass} border-t border-slate-200 bg-white/95 backdrop-blur px-6 py-4 z-30`}
      >
        <div
          className={`mx-auto flex flex-wrap items-center justify-between gap-3 ${
            previewOpen ? "max-w-none" : "max-w-3xl"
          }`}
        >
          {buildUsingAi ? (
            <p className="text-sm text-slate-600">
              {aiDraftNeedsReferenceAnswers
                ? `Generate ${isReadingComprehension ? rcQuestionTotal : questionCount} short-answer question${
                    (isReadingComprehension ? rcQuestionTotal : questionCount) === 1 ? "" : "s"
                  } with AI — then add reference answers and publish`
                : `Generate ${isReadingComprehension ? rcQuestionTotal : questionCount} ${
                    format === "multiple_choice" ? "multiple-choice" : "short-answer"
                  } question${
                    (isReadingComprehension ? rcQuestionTotal : questionCount) === 1 ? "" : "s"
                  } with AI${isReadingComprehension ? ` across ${passages.length} passages` : ""} — review, then publish`}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              {questions.filter((q) => q.prompt.trim()).length}/{questions.length}{" "}
              prompts filled
            </p>
          )}
          <button
            type="button"
            onClick={handlePublish}
            disabled={
              publishing ||
              (buildUsingAi && (!aiEnabled || !canPublishWithAi))
            }
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-6 py-3 transition"
          >
            {publishLabel}
          </button>
        </div>
      </div>
    </>
  );
}
