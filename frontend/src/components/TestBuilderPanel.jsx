import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { generateTestDraft, getAdminSettings, getWorksheet, createTestFromBuilder, updateTestFromBuilder, bulkSaveQuestionBank, getQuestionBankPassage } from "../api";
import QuillLoading from "./QuillLoading";
import { QuestionDifficultyStars } from "./DifficultyStars";
import TestQuestionCard from "./TestQuestionCard";
import TestPassageCard from "./TestPassageCard";
import QuestionBankPicker from "./QuestionBankPicker";
import {
  BUILDER_SUBJECTS,
  DEFAULT_SITTING_COUNT,
  DEFAULT_TIME_LIMIT_MINUTES,
  DEFAULT_RC_PASSAGE_COUNT,
  DEFAULT_RC_QUESTIONS_PER_PASSAGE,
  GRADE_OPTIONS,
  MAX_SITTING_COUNT,
  MIN_SITTING_COUNT,
  MIN_RC_PASSAGE_COUNT,
  MAX_RC_PASSAGE_COUNT,
  MIN_RC_QUESTIONS_PER_PASSAGE,
  MAX_RC_QUESTIONS_PER_PASSAGE,
  TEST_TIERS,
  buildTestBuilderPreview,
  countQuestionsByTier,
  countPassagesByTier,
  draftToTestBuilderQuestions,
  draftRcToTestBuilderState,
  draftDataToTestBuilderState,
  emptyTestQuestion,
  emptyTestPassage,
  emptyRcTestQuestion,
  isTestQuestionComplete,
  isPassageWindowTest,
  isDataPassageTest,
  passageWindowUnitLabels,
  fixedOrderAiBankSize,
  minimumBankSize,
  syncPassageQuestions,
  trimQuestionsForPublish,
  validateTestBuilder,
  testQuestionToBankPayload,
  bankItemToTestQuestion,
  bankPassageToTestPassage,
  mergeTestPassages,
  groupTestQuestionsByPassage,
  unassignedTestQuestions,
  worksheetToTestBuilderState,
} from "../testBuilderUtils";

function TierBankStatus({
  sittingCount,
  tierCounts,
  adaptive,
  aiBankTarget,
  passageWindow = false,
  unitPlural = "questions",
}) {
  const unitLabel = passageWindow ? unitPlural : "questions";
  if (!adaptive) {
    const total = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);
    const ready = total >= sittingCount;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Fixed-order bank</p>
        <p className="text-xs text-slate-600 mt-1">
          Tier labels still affect scoring weight. Publish keeps the first {sittingCount}{" "}
          {unitLabel}
          {aiBankTarget ? ` (AI target ~${aiBankTarget} for review)` : ""}.
        </p>
        <p
          className={`text-lg font-bold tabular-nums mt-2 ${
            ready ? "text-emerald-800" : "text-amber-900"
          }`}
        >
          {total}
          <span className="text-sm font-semibold text-slate-500"> / {sittingCount}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {TEST_TIERS.map((tier) => {
        const count = tierCounts[tier.value] || 0;
        const ready = count >= sittingCount;
        return (
          <div
            key={tier.value}
            className={`rounded-xl border px-4 py-3 ${
              ready
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-amber-200 bg-amber-50/80"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{tier.label}</p>
              <QuestionDifficultyStars stars={tier.value} />
            </div>
            <p className="text-xs text-slate-600 mt-1">{tier.weight} scoring weight</p>
            {passageWindow ? (
              <p className="text-xs text-slate-500 mt-1">Units at tier {tier.value}</p>
            ) : null}
            <p
              className={`text-lg font-bold tabular-nums mt-2 ${
                ready ? "text-emerald-800" : "text-amber-900"
              }`}
            >
              {count}
              <span className="text-sm font-semibold text-slate-500"> / {sittingCount}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function TestBuilderPanel() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit")?.trim() || "";

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState(5);
  const [sittingCount, setSittingCount] = useState(DEFAULT_SITTING_COUNT);
  const [questionsPerPassage, setQuestionsPerPassage] = useState(DEFAULT_RC_QUESTIONS_PER_PASSAGE);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(DEFAULT_TIME_LIMIT_MINUTES);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [buildUsingAi, setBuildUsingAi] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lockOnPublish, setLockOnPublish] = useState(true);
  const [questions, setQuestions] = useState(() => [
    emptyTestQuestion(1),
    emptyTestQuestion(2),
    emptyTestQuestion(3),
  ]);
  const [passages, setPassages] = useState([]);
  const [readingComprehensionEnabled, setReadingComprehensionEnabled] = useState(false);
  const [expandedPassageIds, setExpandedPassageIds] = useState(() => new Set());
  const [activeTierFilter, setActiveTierFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [savingToBank, setSavingToBank] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminSettings()
      .then((settings) => {
        if (cancelled) return;
        setAiEnabled(Boolean(settings.ai_enabled));
        setApiKeyConfigured(Boolean(settings.openai_key_configured));
      })
      .catch(() => {
        if (!cancelled) {
          setAiEnabled(false);
          setApiKeyConfigured(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editId) return undefined;
    let cancelled = false;
    setLoadingEdit(true);
    setErrors([]);
    getWorksheet(editId)
      .then((worksheet) => {
        if (cancelled) return;
        const state = worksheetToTestBuilderState(worksheet);
        setTitle(state.title);
        setSubject(state.subject);
        setSittingCount(state.sittingCount);
        setQuestionsPerPassage(state.questionsPerPassage || DEFAULT_RC_QUESTIONS_PER_PASSAGE);
        setTimeLimitMinutes(state.timeLimitMinutes);
        setAdaptiveEnabled(state.adaptiveEnabled);
        setBuildUsingAi(false);
        setQuestions(state.questions);
        setPassages(state.passages || []);
        setReadingComprehensionEnabled(state.readingComprehensionEnabled);
        setExpandedIds(new Set(state.questions.slice(0, 3).map((question) => question.id)));
        setExpandedPassageIds(
          new Set((state.passages || []).slice(0, 1).map((passage) => passage.id)),
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setErrors([err.message || "Could not load test for editing."]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const canUseAi = aiEnabled && apiKeyConfigured && !editId;
  const isReadingComprehension =
    subject === "english" && readingComprehensionEnabled;
  const passageWindowEnabled = isPassageWindowTest(subject, isReadingComprehension);
  const passageMode = isDataPassageTest(subject) ? "data" : "rc";
  const unitLabels = passageWindowUnitLabels(subject, isReadingComprehension);
  const tierCounts = useMemo(
    () =>
      passageWindowEnabled
        ? countPassagesByTier(passages)
        : countQuestionsByTier(questions),
    [passageWindowEnabled, passages, questions],
  );
  const bankMinimum = minimumBankSize(sittingCount, adaptiveEnabled, passageWindowEnabled);
  const aiBankTarget = passageWindowEnabled
    ? bankMinimum
    : fixedOrderAiBankSize(sittingCount);

  const filteredQuestions = useMemo(() => {
    if (activeTierFilter === "all") return questions;
    const tier = Number(activeTierFilter);
    return questions.filter((question) => Number(question.tier) === tier);
  }, [activeTierFilter, questions]);

  const previewPayload = useMemo(
    () =>
      buildTestBuilderPreview({
        title,
        subject,
        sittingCount,
        timeLimitMinutes,
        questions,
        passages,
        adaptive: adaptiveEnabled,
        readingComprehension: isReadingComprehension,
        passageWindow: passageWindowEnabled,
        questionsPerPassage,
      }),
    [
      title,
      subject,
      sittingCount,
      timeLimitMinutes,
      questions,
      passages,
      adaptiveEnabled,
      isReadingComprehension,
      passageWindowEnabled,
      questionsPerPassage,
    ],
  );

  useEffect(() => {
    if (!passageWindowEnabled) return;
    setQuestions((prev) => syncPassageQuestions(passages, prev, questionsPerPassage));
  }, [passageWindowEnabled, questionsPerPassage, passages.map((p) => p.id).join(",")]);

  const passageQuestionGroups = useMemo(
    () => groupTestQuestionsByPassage(passages, questions),
    [passages, questions],
  );
  const filteredPassageGroups = useMemo(() => {
    if (activeTierFilter === "all") return passageQuestionGroups;
    const tier = Number(activeTierFilter);
    return passageQuestionGroups.filter(
      ({ passage }) => Number(passage.tier) === tier,
    );
  }, [activeTierFilter, passageQuestionGroups]);
  const orphanQuestions = useMemo(
    () => (passageWindowEnabled ? unassignedTestQuestions(passages, questions) : []),
    [passageWindowEnabled, passages, questions],
  );

  function updatePassage(id, patch) {
    setPassages((prev) =>
      prev.map((passage) => (passage.id === id ? { ...passage, ...patch } : passage)),
    );
  }

  function removePassage(id) {
    setPassages((prev) => prev.filter((passage) => passage.id !== id));
    setQuestions((prev) => prev.filter((question) => question.passageId !== id));
    setExpandedPassageIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function addPassage(tier = 2) {
    const passage = emptyTestPassage(null, tier, { data: isDataPassageTest(subject) });
    const nextPassages = [...passages, passage];
    setPassages(nextPassages);
    setQuestions((prev) => syncPassageQuestions(nextPassages, prev, questionsPerPassage));
    setExpandedPassageIds((prev) => new Set(prev).add(passage.id));
  }

  function togglePassageExpanded(id) {
    setExpandedPassageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubjectChange(nextSubject) {
    const leavingData = subject === "data" && nextSubject !== "data";
    setSubject(nextSubject);
    if (nextSubject !== "english") {
      setReadingComprehensionEnabled(false);
    }
    if (nextSubject === "data") {
      setSittingCount(DEFAULT_RC_PASSAGE_COUNT);
      if (passages.length === 0) {
        const first = emptyTestPassage(null, 2, { data: true });
        const nextPassages = [first];
        setPassages(nextPassages);
        setQuestions((prev) => syncPassageQuestions(nextPassages, prev, questionsPerPassage));
        setExpandedPassageIds(new Set([first.id]));
      } else {
        setQuestions((prev) => syncPassageQuestions(passages, prev, questionsPerPassage));
      }
    } else if (leavingData) {
      setPassages([]);
      setQuestions((prev) => prev.map((question) => ({ ...question, passageId: null })));
    }
  }

  function handleReadingComprehensionChange(enabled) {
    setReadingComprehensionEnabled(enabled);
    if (enabled) {
      setSittingCount(DEFAULT_RC_PASSAGE_COUNT);
      if (passages.length === 0) {
        const first = emptyTestPassage(null, 2);
        const nextPassages = [first];
        setPassages(nextPassages);
        setQuestions((prev) => syncPassageQuestions(nextPassages, prev, questionsPerPassage));
        setExpandedPassageIds(new Set([first.id]));
      } else {
        setQuestions((prev) => syncPassageQuestions(passages, prev, questionsPerPassage));
      }
    } else {
      setQuestions((prev) =>
        prev.map((question) => ({ ...question, passageId: null })),
      );
    }
  }

  function updateQuestion(id, patch) {
    setQuestions((prev) =>
      prev.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    );
  }

  function removeQuestion(id) {
    setQuestions((prev) => prev.filter((question) => question.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function removeAllUnassignedQuestions() {
    const orphanIds = new Set(orphanQuestions.map((question) => question.id));
    if (orphanIds.size === 0) return;
    setQuestions((prev) => prev.filter((question) => !orphanIds.has(question.id)));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of orphanIds) next.delete(id);
      return next;
    });
  }

  function addQuestion(tier = 2, passageId = null) {
    if (passageWindowEnabled && passageId) {
      const question = emptyRcTestQuestion(passageId);
      setQuestions((prev) => [...prev, question]);
      setExpandedIds((prev) => new Set(prev).add(question.id));
      setExpandedPassageIds((prev) => new Set(prev).add(passageId));
      return;
    }
    const question = emptyTestQuestion(tier);
    setQuestions((prev) => [...prev, question]);
    setExpandedIds((prev) => new Set(prev).add(question.id));
  }

  function addQuestionForPassage(passageId) {
    addQuestion(2, passageId);
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleValidate() {
    const nextErrors = validateTestBuilder({
      title,
      sittingCount,
      timeLimitMinutes,
      questions,
      adaptive: adaptiveEnabled,
      readingComprehension: isReadingComprehension,
      passageWindow: passageWindowEnabled,
      passageMode,
      passages,
      questionsPerPassage,
    });
    setErrors(nextErrors);
    setNotice(
      nextErrors.length === 0
        ? "Validation passed — you can publish this test."
        : "",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
    return nextErrors.length === 0;
  }

  async function handlePublish() {
    setErrors([]);
    setNotice("");
    const valid = handleValidate();
    if (!valid) return;

    setPublishing(true);
    try {
      const publishQuestions = trimQuestionsForPublish(
        questions,
        sittingCount,
        adaptiveEnabled,
      );
      const trimmedCount = questions.length - publishQuestions.length;
      const payload = {
        ...buildTestBuilderPreview({
          title,
          subject,
          sittingCount,
          timeLimitMinutes,
          questions: publishQuestions,
          passages,
          adaptive: adaptiveEnabled,
          readingComprehension: isReadingComprehension,
          passageWindow: passageWindowEnabled,
          questionsPerPassage,
        }),
        lock_on_create: lockOnPublish,
      };
      const result = editId
        ? await updateTestFromBuilder(editId, payload)
        : await createTestFromBuilder(payload);
      const lockNote =
        !editId &&
        lockOnPublish &&
        typeof result.locked_for_students === "number"
          ? ` Locked for ${result.locked_for_students} student${
              result.locked_for_students === 1 ? "" : "s"
            }.`
          : !editId && lockOnPublish
            ? " Locked for your students."
            : "";
      setNotice(
        editId
          ? `Saved changes to ${result.id} — “${result.title}”.`
          : `Published ${result.id} — “${result.title}” (${result.question_count} questions).${lockNote}${
              trimmedCount > 0
                ? ` ${trimmedCount} extra buffer question${trimmedCount === 1 ? "" : "s"} were not included.`
                : ""
            }`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors([err.message || "Could not publish test."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPublishing(false);
    }
  }

  async function handleGenerateWithAi() {
    setErrors([]);
    setNotice("");
    if (!canUseAi) {
      setErrors(["Add your OpenAI API key under Admin → Settings before generating."]);
      return;
    }

    setGenerating(true);
    try {
      const draft = await generateTestDraft({
        subject,
        grade,
        sitting_count: sittingCount,
        adaptive: adaptiveEnabled,
        custom_prompt: aiCustomPrompt.trim(),
        ...(passageWindowEnabled
          ? {
              ...(isReadingComprehension
                ? { english_type: "reading_comprehension" }
                : {}),
              questions_per_passage: questionsPerPassage,
            }
          : {}),
      });
      if (passageWindowEnabled) {
        const generated = isDataPassageTest(subject)
          ? draftDataToTestBuilderState(draft)
          : draftRcToTestBuilderState(draft);
        if (!title.trim() && generated.title) {
          setTitle(generated.title);
        }
        setPassages(generated.passages);
        setQuestions(
          syncPassageQuestions(
            generated.passages,
            generated.questions,
            questionsPerPassage,
          ),
        );
        setNotice(
          `Generated ${generated.passages.length} ${unitLabels.plural} with ${questionsPerPassage} questions each. Review and edit below before publishing.`,
        );
      } else {
        const generated = draftToTestBuilderQuestions(draft);
        if (!title.trim() && draft.title) {
          setTitle(draft.title);
        }
        setQuestions(generated);
        setExpandedIds(new Set(generated.slice(0, 3).map((question) => question.id)));
        setNotice(
          `Generated ${generated.length} questions. Review and edit below before publishing.`,
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors([err.message || "Could not generate test questions."]);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddFromBank(selectedItems) {
    const imported = selectedItems.map((item) => bankItemToTestQuestion(item));
    setQuestions((prev) => [...prev, ...imported]);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const question of imported.slice(0, 3)) next.add(question.id);
      return next;
    });

    const passageIds = [
      ...new Set(selectedItems.map((item) => item.passage_id).filter(Boolean)),
    ];
    if (passageIds.length > 0) {
      try {
        const tierByPassageId = {};
        for (const question of imported) {
          if (question.passageId && question.bankTier && !tierByPassageId[question.passageId]) {
            tierByPassageId[question.passageId] = question.bankTier;
          }
        }
        const fetched = await Promise.all(
          passageIds.map((passageId) => getQuestionBankPassage(passageId)),
        );
        setPassages((prev) =>
          mergeTestPassages(
            prev,
            fetched.map((passage) =>
              bankPassageToTestPassage(passage, tierByPassageId[passage.id]),
            ),
          ),
        );
        if (subject === "english") {
          setReadingComprehensionEnabled(true);
        }
      } catch (err) {
        setErrors([
          err.message ||
            "Questions were added, but some passage context could not be loaded.",
        ]);
      }
    }

    setNotice(
      `Added ${imported.length} question${imported.length === 1 ? "" : "s"} from the bank.`,
    );
  }

  async function handleSaveToBank(source = "manual") {
    setErrors([]);
    const completeQuestions = questions.filter(isTestQuestionComplete);
    if (completeQuestions.length === 0) {
      setErrors(["Add at least one complete question before saving to the bank."]);
      return;
    }
    setSavingToBank(true);
    try {
      await bulkSaveQuestionBank({
        subject,
        source,
        questions: completeQuestions.map((question) =>
          testQuestionToBankPayload(question, subject, null, passages),
        ),
      });
    } catch (err) {
      setErrors([err.message || "Could not save questions to the bank."]);
    } finally {
      setSavingToBank(false);
    }
  }

  if (settingsLoading || loadingEdit) {
    return (
      <QuillLoading
        label={loadingEdit ? `Loading ${editId}…` : "Loading test builder…"}
      />
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-slate-600 text-sm mb-4 leading-relaxed">
        {editId
          ? `Editing ${editId}. Update questions below, then save.`
          : passageWindowEnabled
            ? adaptiveEnabled
              ? isDataPassageTest(subject)
                ? `Build an adaptive data analysis test. Each sitting draws ${unitLabels.plural} by tier; after a data set, difficulty adjusts for the next one.`
                : "Build an adaptive RC test. Each sitting draws passages by tier; after a passage, difficulty adjusts for the next one."
              : isDataPassageTest(subject)
                ? `Build a fixed-order data analysis test. ${unitLabels.capitalized}s are assigned at the start — tier labels affect scoring weight only.`
                : "Build a fixed-order RC test. Passages are assigned at the start — tier labels affect scoring weight only."
            : adaptiveEnabled
              ? "Build an adaptive timed test. Students answer one sitting; difficulty adjusts by tier after each question."
              : "Build a fixed-order timed test. All questions are assigned at the start — tier labels affect scoring weight only."}
      </p>

      <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950 leading-relaxed">
        <p className="font-semibold">
          {adaptiveEnabled ? "How adaptive tests work" : "How fixed-order tests work"}
        </p>
        <ul className="mt-2 space-y-1 list-disc pl-5 text-teal-900/90">
          {passageWindowEnabled ? (
            adaptiveEnabled ? (
              <>
                <li>
                  Each sitting draws {sittingCount} {unitLabels.plural} from tiered pools (1 = easy, 3 = hard).
                </li>
                <li>
                  Students answer all {questionsPerPassage} questions for a {unitLabels.singular}, then move to the
                  next {unitLabels.singular}.
                </li>
                <li>
                  A strong score moves up a tier; a weak score moves down (majority correct).
                </li>
                <li>
                  You need at least {sittingCount} {unitLabels.plural} in every tier ({bankMinimum} total
                  minimum).
                </li>
              </>
            ) : (
              <>
                <li>All {sittingCount} {unitLabels.plural} are assigned when the student starts.</li>
                <li>Each {unitLabels.singular} includes {questionsPerPassage} questions shown together.</li>
                <li>Scoring is weighted by each {unitLabels.singular}&apos;s tier.</li>
              </>
            )
          ) : adaptiveEnabled ? (
            <>
              <li>
                Each sitting draws {sittingCount} questions from tiered pools (1 = easy, 3 = hard).
              </li>
              <li>Correct answers move up a tier; incorrect answers move down.</li>
              <li>Scoring is weighted: tier 1 = 1×, tier 2 = 1.5×, tier 3 = 2×.</li>
              <li>You need at least {sittingCount} questions in every tier before publishing.</li>
            </>
          ) : (
            <>
              <li>All {sittingCount} questions are assigned when the student starts.</li>
              <li>Scoring is still weighted by each question&apos;s tier.</li>
              <li>
                AI may generate ~{aiBankTarget} questions as a review buffer; publish keeps the
                first {sittingCount}.
              </li>
            </>
          )}
        </ul>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      ) : null}
      {errors.length > 0 ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold mb-1">Fix these before publishing:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-bold text-slate-900">Test details</h2>
          <label
            className={`flex items-center gap-2 text-sm font-semibold ${
              canUseAi ? "text-slate-800 cursor-pointer" : "text-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={buildUsingAi}
              onChange={(e) => setBuildUsingAi(e.target.checked)}
              disabled={!canUseAi}
              className="rounded border-slate-300"
            />
            Build using AI
          </label>
        </div>

        {buildUsingAi && !canUseAi ? (
          <p className="text-sm text-amber-900 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
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
            placeholder={
              buildUsingAi
                ? "Optional — AI will suggest a title if blank"
                : "e.g. Math Adaptive Test — Unit 4"
            }
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block text-sm font-semibold text-slate-800">
            Subject
            <select
              value={subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {BUILDER_SUBJECTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            {passageWindowEnabled
              ? `${unitLabels.capitalized}s per test`
              : "Sitting size"}
            <input
              type="number"
              min={passageWindowEnabled ? MIN_RC_PASSAGE_COUNT : MIN_SITTING_COUNT}
              max={passageWindowEnabled ? MAX_RC_PASSAGE_COUNT : MAX_SITTING_COUNT}
              value={sittingCount}
              onChange={(e) => setSittingCount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {passageWindowEnabled
                ? `${unitLabels.capitalized}s shown per attempt (${MIN_RC_PASSAGE_COUNT}–${MAX_RC_PASSAGE_COUNT})`
                : `Questions per attempt (${MIN_SITTING_COUNT}–${MAX_SITTING_COUNT})`}
            </span>
          </label>

          {passageWindowEnabled ? (
            <label className="block text-sm font-semibold text-slate-800">
              Questions per {unitLabels.singular}
              <input
                type="number"
                min={MIN_RC_QUESTIONS_PER_PASSAGE}
                max={MAX_RC_QUESTIONS_PER_PASSAGE}
                value={questionsPerPassage}
                onChange={(e) => setQuestionsPerPassage(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Fixed count for every {unitLabels.singular} ({MIN_RC_QUESTIONS_PER_PASSAGE}–
                {MAX_RC_QUESTIONS_PER_PASSAGE})
              </span>
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-slate-800">
            Time limit (minutes)
            <input
              type="number"
              min={1}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {subject === "data" ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Data analysis test</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Each sitting shows chart/table data sets with grouped questions. Adaptive difficulty
              adjusts between data sets based on performance — same flow as reading comprehension.
            </p>
          </div>
        ) : null}

        {subject === "english" ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={readingComprehensionEnabled}
                onChange={(e) => handleReadingComprehensionChange(e.target.checked)}
                className="rounded border-slate-300"
              />
              Reading comprehension
            </label>
            <p className="text-xs text-slate-600 leading-relaxed">
              {readingComprehensionEnabled
                ? "Set a tier on each passage, then add questions inside it."
                : "Standard English MCQs without a shared reading passage."}
            </p>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={adaptiveEnabled}
            onChange={(e) => setAdaptiveEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Adaptive difficulty
          <span className="font-normal text-slate-500">
            {adaptiveEnabled
              ? passageWindowEnabled
                ? `tier changes after each ${unitLabels.singular}`
                : "tier changes after each answer"
              : "fixed question order at start"}
          </span>
        </label>

        {buildUsingAi ? (
          <label className="block text-sm font-semibold text-slate-800">
            AI instructions <span className="font-normal text-slate-500">(optional)</span>
            <textarea
              value={aiCustomPrompt}
              onChange={(e) => setAiCustomPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Focus on fractions and decimals from Unit 4. Include a few word problems."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm resize-y min-h-[4.5rem]"
            />
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={lockOnPublish}
            onChange={(e) => setLockOnPublish(e.target.checked)}
            className="rounded border-slate-300"
          />
          Lock test for students after publishing
          <span className="font-normal text-slate-500">(unlock from Worksheets → Tests)</span>
        </label>
      </section>

      {passageWindowEnabled ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">
                {isDataPassageTest(subject) ? "Data sets & questions" : "Passages & questions"}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Set a tier on each {unitLabels.singular} with exactly {questionsPerPassage} questions. Adaptive
                difficulty adjusts between {unitLabels.plural} based on performance.
                {buildUsingAi
                  ? adaptiveEnabled
                    ? ` AI generates ${bankMinimum} ${unitLabels.plural} (${sittingCount} per tier).`
                    : ` AI generates ${bankMinimum} ${unitLabels.plural}.`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowBankPicker(true)}
                className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 transition"
              >
                Add from bank
              </button>
              {buildUsingAi ? (
                <button
                  type="button"
                  onClick={handleGenerateWithAi}
                  disabled={generating}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-semibold transition"
                >
                  {generating
                    ? "Generating…"
                    : isDataPassageTest(subject)
                      ? "Generate data sets"
                      : "Generate passages"}
                </button>
              ) : null}
              {TEST_TIERS.map((tier) => (
                <button
                  key={`add-passage-${tier.value}`}
                  type="button"
                  onClick={() => addPassage(tier.value)}
                  className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 transition"
                >
                  + Tier {tier.value} {unitLabels.singular}
                </button>
              ))}
              {passages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePassage(passages[passages.length - 1].id)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Remove last
                </button>
              ) : null}
            </div>
          </div>

          <TierBankStatus
            sittingCount={sittingCount}
            tierCounts={tierCounts}
            adaptive={adaptiveEnabled}
            aiBankTarget={buildUsingAi ? aiBankTarget : null}
            passageWindow={passageWindowEnabled}
            unitPlural={unitLabels.plural}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTierFilter("all")}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                activeTierFilter === "all"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All {unitLabels.plural} ({passages.length})
            </button>
            {TEST_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setActiveTierFilter(String(tier.value))}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  activeTierFilter === String(tier.value)
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tier.label} ({tierCounts[tier.value] || 0} {unitLabels.plural})
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {passages.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                No {unitLabels.plural} yet. Add a tier {unitLabels.singular} to get started.
              </p>
            ) : filteredPassageGroups.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                No {unitLabels.plural} in this tier yet.
              </p>
            ) : (
              filteredPassageGroups.map(({ passage, questions: passageQuestions }) => {
                const index = passages.findIndex((entry) => entry.id === passage.id);
                return (
                <TestPassageCard
                  key={passage.id}
                  passage={passage}
                  index={index}
                  expanded={expandedPassageIds.has(passage.id)}
                  onToggle={() => togglePassageExpanded(passage.id)}
                  onChange={(patch) => updatePassage(passage.id, patch)}
                  onRemove={
                    passages.length > 1 ? () => removePassage(passage.id) : null
                  }
                  passageMode={passageMode}
                  passageQuestions={passageQuestions}
                  expandedQuestionIds={expandedIds}
                  onToggleQuestion={toggleExpanded}
                  onChangeQuestion={updateQuestion}
                  onRemoveQuestion={removeQuestion}
                  subject={subject}
                  areaSuggestions
                  fixedQuestionCount={questionsPerPassage}
                />
                );
              })
            )}
          </div>

          {orphanQuestions.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-950">Unassigned questions</p>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    These questions are not linked to a {unitLabels.singular}. Assign them or remove them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeAllUnassignedQuestions}
                  className="rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 transition shrink-0"
                >
                  Delete all ({orphanQuestions.length})
                </button>
              </div>
              <div className="space-y-3">
                {orphanQuestions.map((question) => {
                  const index = questions.findIndex((item) => item.id === question.id);
                  return (
                    <TestQuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      expanded={expandedIds.has(question.id)}
                      onToggle={() => toggleExpanded(question.id)}
                      onChange={(patch) => updateQuestion(question.id, patch)}
                      onRemove={() => removeQuestion(question.id)}
                      subject={subject}
                      areaSuggestions
                      readingComprehension={passageWindowEnabled}
                      passages={passages}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4${
          passageWindowEnabled ? " hidden" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Question bank</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {adaptiveEnabled
                ? `Add at least ${sittingCount} questions per tier (${bankMinimum} total minimum).`
                : buildUsingAi
                  ? `AI targets ~${aiBankTarget} questions for review; publish uses the first ${sittingCount}.`
                  : `Add at least ${sittingCount} questions (${sittingCount + 1}+ recommended as a review buffer).`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowBankPicker(true)}
              className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 transition"
            >
              Add from bank
            </button>
            {buildUsingAi ? (
              <button
                type="button"
                onClick={handleGenerateWithAi}
                disabled={generating}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-semibold transition"
              >
                {generating ? "Generating…" : "Generate question bank"}
              </button>
            ) : null}
            <button
            type="button"
            onClick={() => setShowJsonPreview((open) => !open)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
          >
            {showJsonPreview ? "Hide JSON preview" : "Preview JSON"}
          </button>
          </div>
        </div>

        <TierBankStatus
          sittingCount={sittingCount}
          tierCounts={tierCounts}
          adaptive={adaptiveEnabled}
          aiBankTarget={buildUsingAi ? aiBankTarget : null}
        />

        {!buildUsingAi ? (
          <>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTierFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
              activeTierFilter === "all"
                ? "bg-teal-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All tiers ({questions.length})
          </button>
          {TEST_TIERS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              onClick={() => setActiveTierFilter(String(tier.value))}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                activeTierFilter === String(tier.value)
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tier.label} ({tierCounts[tier.value] || 0})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {TEST_TIERS.map((tier) => (
            <button
              key={`add-${tier.value}`}
              type="button"
              onClick={() => addQuestion(tier.value)}
              className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 transition"
            >
              + Tier {tier.value} question
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredQuestions.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              No questions in this tier yet. Use the buttons above to add one.
            </p>
          ) : (
            filteredQuestions.map((question) => {
              const index = questions.findIndex((item) => item.id === question.id);
              return (
                <TestQuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  expanded={expandedIds.has(question.id)}
                  onToggle={() => toggleExpanded(question.id)}
                  onChange={(patch) => updateQuestion(question.id, patch)}
                  onRemove={() => removeQuestion(question.id)}
                  subject={subject}
                  areaSuggestions
                  readingComprehension={isReadingComprehension}
                  passages={passages}
                />
              );
            })
          )}
        </div>
          </>
        ) : questions.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Generated bank — expand any question to edit before publishing.
            </p>
            {questions.map((question, index) => (
              <TestQuestionCard
                key={question.id}
                question={question}
                index={index}
                expanded={expandedIds.has(question.id)}
                onToggle={() => toggleExpanded(question.id)}
                onChange={(patch) => updateQuestion(question.id, patch)}
                onRemove={() => removeQuestion(question.id)}
                subject={subject}
                areaSuggestions
                readingComprehension={isReadingComprehension}
                passages={passages}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
            Use &ldquo;Generate question bank&rdquo; to create questions with AI, then review them here.
          </p>
        )}
      </section>

      {showJsonPreview ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 p-5 shadow-sm mb-6 overflow-x-auto">
          <h2 className="font-bold text-white mb-3">Publish payload preview</h2>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap">
            {JSON.stringify(previewPayload, null, 2)}
          </pre>
        </section>
      ) : null}

      <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleValidate}
          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 transition"
        >
          Validate &amp; preview publish
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || generating}
          className="rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition"
        >
          {publishing ? "Publishing…" : editId ? "Save test" : "Publish test"}
        </button>
        {questions.some(isTestQuestionComplete) ? (
          <button
            type="button"
            onClick={() => handleSaveToBank(buildUsingAi ? "ai" : "manual")}
            disabled={savingToBank || generating || publishing}
            className="rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-900 text-sm font-bold px-5 py-2.5 transition"
          >
            {savingToBank ? "Saving…" : "Save to bank"}
          </button>
        ) : null}
        <Link
          to="/admin/worksheets"
          className="ml-auto text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          View worksheets →
        </Link>
      </div>

      <QuestionBankPicker
        subject={subject}
        open={showBankPicker}
        onClose={() => setShowBankPicker(false)}
        onAdd={handleAddFromBank}
      />
    </div>
  );
}
