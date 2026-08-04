import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { generateTestDraft, getAdminSettings, getWorksheet, createTestFromBuilder, updateTestFromBuilder, bulkSaveQuestionBank, saveWorksheetContextToBank, getQuestionBankPassage, previewAdminResourceCode } from "../api";
import {
  defaultScheduledUnlockLocalInput,
  formatScheduledUnlockLabel,
  isoToLocalDatetimeInput,
  localDatetimeInputToIso,
} from "../testSchedulingUtils";
import QuillLoading from "./QuillLoading";
import AdminResourceCodeLabel from "./AdminResourceCodeLabel";
import {
  CREATE_BODY,
  CREATE_METRIC,
  CREATE_METRIC_SUFFIX,
  CREATE_SECTION_TITLE,
  CREATE_SUBSECTION_TITLE,
  CREATE_ACTION_BUTTON_TEAL,
  CREATE_PUBLISH_BUTTON,
  CREATE_STICKY_ACTION_BAR,
  CREATE_STICKY_ACTION_LINK,
  CREATE_TOOLBAR_ADD,
  CREATE_TOOLBAR_ADD_BANK,
  CREATE_TOOLBAR_ADD_PASSAGE,
  CREATE_TOOLBAR_CHIP,
  CREATE_TOOLBAR_CHIP_OFF,
  CREATE_TOOLBAR_CHIP_ON,
  CREATE_TOOLBAR_NEUTRAL,
} from "../createTypography";
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
  RC_PASSAGE_TIERS,
  isRcAdaptiveTest,
  rcQuestionsBankSize,
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
  isTestPassageComplete,
  isPassageWindowTest,
  isDataPassageTest,
  passageWindowUnitLabels,
  fixedOrderAiBankSize,
  minimumBankSize,
  syncPassageQuestions,
  trimQuestionsForPublish,
  validateTestBuilder,
  testQuestionToBankPayload,
  testPassageToBankPayload,
  testQuestionToContextBankPayload,
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
  rcPassageMode = false,
}) {
  const unitLabel = passageWindow ? unitPlural : "questions";
  const tierOptions = rcPassageMode ? RC_PASSAGE_TIERS : TEST_TIERS;
  if (!adaptive) {
    const total = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);
    const ready = total >= sittingCount;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Fixed-order bank</p>
        <p className={`${CREATE_BODY} mt-1 text-xs`}>
          Tier labels still affect scoring weight. Publish keeps the first {sittingCount}{" "}
          {unitLabel}
          {aiBankTarget ? ` (AI target ~${aiBankTarget} for review)` : ""}.
        </p>
        <p
          className={`${CREATE_METRIC} mt-2 ${
            ready ? "text-emerald-800" : "text-amber-900"
          }`}
        >
          {total}
          <span className={CREATE_METRIC_SUFFIX}> / {sittingCount}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${rcPassageMode ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {tierOptions.map((tier) => {
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
              <p className={CREATE_SUBSECTION_TITLE}>{tier.label}</p>
              {rcPassageMode ? null : <QuestionDifficultyStars stars={tier.value} />}
            </div>
            {!rcPassageMode ? (
              <p className={`${CREATE_BODY} mt-1 text-xs`}>{tier.weight} scoring weight</p>
            ) : null}
            {passageWindow ? (
              <p className="text-xs text-slate-500 mt-1">
                {rcPassageMode ? `${tier.shortLabel} ${unitLabel}` : `Units at tier ${tier.value}`}
              </p>
            ) : null}
            <p
              className={`${CREATE_METRIC} mt-2 ${
                ready ? "text-emerald-800" : "text-amber-900"
              }`}
            >
              {count}
              <span className={CREATE_METRIC_SUFFIX}> / {sittingCount}</span>
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
  const [availabilityMode, setAvailabilityMode] = useState("scheduled");
  const [scheduledUnlockLocal, setScheduledUnlockLocal] = useState(
    defaultScheduledUnlockLocalInput,
  );
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
  const [adminCode, setAdminCode] = useState("");
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
        setAdminCode(worksheet.admin_code || "");
        const schedule = worksheet.unlock_schedule;
        if (schedule?.mode === "scheduled" && schedule.scheduled_unlock_at) {
          setAvailabilityMode("scheduled");
          setScheduledUnlockLocal(
            isoToLocalDatetimeInput(schedule.scheduled_unlock_at),
          );
        } else if (schedule?.mode === "locked") {
          setAvailabilityMode("scheduled");
          setScheduledUnlockLocal(defaultScheduledUnlockLocalInput());
        } else {
          setAvailabilityMode("now");
        }
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

  useEffect(() => {
    if (editId) return undefined;
    let cancelled = false;
    previewAdminResourceCode({
      subject,
      isTest: true,
      englishType:
        subject === "english"
          ? readingComprehensionEnabled
            ? "reading_comprehension"
            : "critical_reasoning"
          : "",
    })
      .then((data) => {
        if (!cancelled) setAdminCode(data.preview || "");
      })
      .catch(() => {
        if (!cancelled) setAdminCode("");
      });
    return () => {
      cancelled = true;
    };
  }, [editId, subject, readingComprehensionEnabled]);

  const canUseAi = aiEnabled && apiKeyConfigured && !editId;
  const isReadingComprehension =
    subject === "english" && readingComprehensionEnabled;
  const passageWindowEnabled = isPassageWindowTest(subject, isReadingComprehension);
  const passageMode = isDataPassageTest(subject) ? "data" : "rc";
  const rcAdaptiveMode = isRcAdaptiveTest(subject, isReadingComprehension, adaptiveEnabled);
  const unitLabels = passageWindowUnitLabels(subject, isReadingComprehension);
  const passageTierOptions = rcAdaptiveMode || (isReadingComprehension && !isDataPassageTest(subject))
    ? RC_PASSAGE_TIERS
    : TEST_TIERS;
  const tierCounts = useMemo(
    () =>
      passageWindowEnabled
        ? countPassagesByTier(passages, { rcMode: isReadingComprehension && !isDataPassageTest(subject) })
        : countQuestionsByTier(questions),
    [passageWindowEnabled, passages, questions, isReadingComprehension, subject],
  );
  const bankMinimum = minimumBankSize(
    sittingCount,
    adaptiveEnabled,
    passageWindowEnabled,
    isReadingComprehension && !isDataPassageTest(subject),
  );
  const rcBankSize = rcQuestionsBankSize(questionsPerPassage, adaptiveEnabled);
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
        passageMode,
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
      passageMode,
      questionsPerPassage,
    ],
  );

  useEffect(() => {
    if (!passageWindowEnabled) return;
    setQuestions((prev) =>
      syncPassageQuestions(passages, prev, questionsPerPassage, {
        rcAdaptive: rcAdaptiveMode,
        adaptive: adaptiveEnabled,
      }),
    );
  }, [
    passageWindowEnabled,
    questionsPerPassage,
    rcAdaptiveMode,
    adaptiveEnabled,
    passages.map((p) => p.id).join(","),
  ]);

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

  function syncPassageQuestionBank(nextPassages, prev) {
    return syncPassageQuestions(nextPassages, prev, questionsPerPassage, {
      rcAdaptive: rcAdaptiveMode,
      adaptive: adaptiveEnabled,
    });
  }

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
    setQuestions((prev) => syncPassageQuestionBank(nextPassages, prev));
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
        setQuestions((prev) => syncPassageQuestionBank(nextPassages, prev));
        setExpandedPassageIds(new Set([first.id]));
      } else {
        setQuestions((prev) => syncPassageQuestionBank(passages, prev));
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
        setQuestions((prev) => syncPassageQuestionBank(nextPassages, prev));
        setExpandedPassageIds(new Set([first.id]));
      } else {
        setQuestions((prev) => syncPassageQuestionBank(passages, prev));
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
      let scheduledUnlockAt = null;
      if (availabilityMode === "scheduled") {
        scheduledUnlockAt = localDatetimeInputToIso(scheduledUnlockLocal);
        if (!scheduledUnlockAt) {
          setErrors(["Pick a valid date and time for scheduled unlock."]);
          setPublishing(false);
          return;
        }
        if (new Date(scheduledUnlockAt).getTime() <= Date.now()) {
          setErrors(["Scheduled unlock must be in the future."]);
          setPublishing(false);
          return;
        }
      }
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
          passageMode,
          questionsPerPassage,
        }),
      };
      if (scheduledUnlockAt) {
        payload.scheduled_unlock_at = scheduledUnlockAt;
      } else if (availabilityMode === "now" && editId) {
        payload.unlock_students_now = true;
      }
      const result = editId
        ? await updateTestFromBuilder(editId, payload)
        : await createTestFromBuilder(payload);
      const lockNote =
        scheduledUnlockAt
          ? ` Scheduled unlock ${formatScheduledUnlockLabel(scheduledUnlockAt)} for ${
              typeof result.locked_for_students === "number"
                ? `${result.locked_for_students} student${
                    result.locked_for_students === 1 ? "" : "s"
                  }`
                : "your students"
            }.`
          : availabilityMode === "now" && typeof result.unlocked_for_students === "number"
            ? ` Unlocked for ${result.unlocked_for_students} student${
                result.unlocked_for_students === 1 ? "" : "s"
              }.`
            : availabilityMode === "now" && !editId
              ? " Unlocked for students now."
              : availabilityMode === "now" && editId
                ? " Student access updated to unlocked."
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
      if (editId) {
        if (result.admin_code) setAdminCode(result.admin_code);
      } else {
        previewAdminResourceCode({
          subject,
          isTest: true,
          englishType:
            subject === "english"
              ? readingComprehensionEnabled
                ? "reading_comprehension"
                : "critical_reasoning"
              : "",
        })
          .then((data) => setAdminCode(data.preview || result.admin_code || ""))
          .catch(() => {
            if (result.admin_code) setAdminCode(result.admin_code);
          });
      }
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
          syncPassageQuestions(generated.passages, generated.questions, questionsPerPassage, {
            rcAdaptive: rcAdaptiveMode,
            adaptive: adaptiveEnabled,
          }),
        );
        setNotice(
          rcAdaptiveMode
            ? `Generated ${generated.passages.length} ${unitLabels.plural} with ${rcBankSize} questions each (${questionsPerPassage} shown per sitting). Review and edit below before publishing.`
            : `Generated ${generated.passages.length} ${unitLabels.plural} with ${questionsPerPassage} questions each. Review and edit below before publishing.`,
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
    setNotice("");
    const completeQuestions = questions.filter(isTestQuestionComplete);
    if (completeQuestions.length === 0) {
      setErrors(["Add at least one complete question before saving to the bank."]);
      return;
    }
    setSavingToBank(true);
    try {
      if (passageWindowEnabled) {
        let totalCreated = 0;
        let totalSkipped = 0;
        let passagesCreated = 0;
        const saveErrors = [];

        for (const { passage, questions: passageQuestions } of groupTestQuestionsByPassage(
          passages,
          completeQuestions,
        )) {
          const readyQuestions = passageQuestions.filter(isTestQuestionComplete);
          if (readyQuestions.length === 0) continue;

          const passageLabel = passage.title?.trim() || "Untitled passage";
          if (!isTestPassageComplete(passage, passageMode)) {
            saveErrors.push(
              `${passageLabel}: Passage must have a title, tier, and content before saving.`,
            );
            continue;
          }

          const result = await saveWorksheetContextToBank({
            subject,
            stars: Number(passage.tier) || 2,
            source,
            passage: testPassageToBankPayload(passage),
            questions: readyQuestions.map((question) =>
              testQuestionToContextBankPayload(question, passage),
            ),
          });

          totalCreated += result.created_count || 0;
          totalSkipped += result.skipped_duplicate_count || 0;
          if (result.created_passage) passagesCreated += 1;
          if (Array.isArray(result.errors) && result.errors.length) {
            saveErrors.push(...result.errors);
          }
        }

        const unassigned = unassignedTestQuestions(passages, completeQuestions).filter(
          isTestQuestionComplete,
        );
        if (unassigned.length > 0) {
          const result = await bulkSaveQuestionBank({
            subject,
            source,
          questions: unassigned.map((question) => {
            const payload = testQuestionToBankPayload(question, subject, null, passages);
            delete payload.passage_id;
            return payload;
          }),
          });
          totalCreated += result.created_count || 0;
          totalSkipped += result.skipped_duplicate_count || 0;
          if (Array.isArray(result.errors) && result.errors.length) {
            saveErrors.push(...result.errors);
          }
        }

        if (saveErrors.length && totalCreated === 0 && totalSkipped === 0) {
          setErrors(saveErrors);
          return;
        }

        if (saveErrors.length) {
          setErrors(saveErrors);
        }

        const passageNote =
          passagesCreated > 0
            ? ` ${passagesCreated} passage${passagesCreated === 1 ? "" : "s"} added to the bank.`
            : "";
        if (totalCreated === 0 && totalSkipped > 0) {
          setNotice(
            `All ${totalSkipped} question${totalSkipped === 1 ? "" : "s"} are already in the question bank.${passageNote}`,
          );
        } else {
          setNotice(
            `Saved ${totalCreated} question${totalCreated === 1 ? "" : "s"} to the question bank.${totalSkipped ? ` ${totalSkipped} duplicate${totalSkipped === 1 ? "" : "s"} skipped.` : ""}${passageNote}`,
          );
        }
        return;
      }

      const result = await bulkSaveQuestionBank({
        subject,
        source,
        questions: completeQuestions.map((question) =>
          testQuestionToBankPayload(question, subject, null, passages),
        ),
      });
      const created = result.created_count ?? completeQuestions.length;
      const skipped = result.skipped_duplicate_count || 0;
      if (created === 0 && skipped > 0) {
        setNotice(
          `All ${skipped} question${skipped === 1 ? "" : "s"} are already in the question bank.`,
        );
      } else {
        setNotice(
          `Saved ${created} question${created === 1 ? "" : "s"} to the question bank.${skipped ? ` ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.` : ""}`,
        );
      }
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
      <p className={`${CREATE_BODY} mb-4`}>
        {editId
          ? `Editing ${editId}. Update questions below, then save.`
          : passageWindowEnabled
            ? adaptiveEnabled
              ? isDataPassageTest(subject)
                ? `Build an adaptive data analysis test. Each sitting draws ${unitLabels.plural} by tier; after a data set, difficulty adjusts for the next one.`
                : "Build an adaptive RC test. Easy and complex passages; weighted score adjusts the next passage tier."
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
              isReadingComprehension && !isDataPassageTest(subject) ? (
                <>
                  <li>
                    Each sitting draws {sittingCount} passages — easy or complex — with{" "}
                    {questionsPerPassage} random questions from a bank of {rcBankSize} per passage.
                  </li>
                  <li>
                    Question tiers (1–3) set scoring weight. Easy passages allow tier 1–2 questions;
                    complex passages allow tier 2–3.
                  </li>
                  <li>
                    Slot 1 is an easy passage with mostly tier 2 questions (~75%). After each
                    passage, weighted score routes the next passage and question mix:
                    under 50% → easy tier 1 only · 50–70% → easy tier 2 only · 70–85% →
                    complex tier 2/3 mix · above 85% → complex tier 3 only.
                  </li>
                  <li>
                    Bank needs {sittingCount} easy and {sittingCount} complex passages ({bankMinimum}{" "}
                    total), each with {rcBankSize} questions.
                  </li>
                </>
              ) : (
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
              )
            ) : (
              <>
                <li>All {sittingCount} {unitLabels.plural} are assigned when the student starts.</li>
                <li>Each {unitLabels.singular} includes {questionsPerPassage} questions shown together.</li>
                <li>
                  Scoring is weighted per question using its {unitLabels.singular}&apos;s tier.
                </li>
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
          <h2 className={CREATE_SECTION_TITLE}>Test details</h2>
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

        {adminCode ? (
          <AdminResourceCodeLabel code={adminCode} className="mb-1.5" />
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

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 space-y-3">
            <p className="font-semibold text-sm text-slate-900">Availability</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name="test-availability"
                  checked={availabilityMode === "now"}
                  onChange={() => setAvailabilityMode("now")}
                  className="text-indigo-600"
                />
                {editId ? "Unlock for students now" : "Publish and unlock now"}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name="test-availability"
                  checked={availabilityMode === "scheduled"}
                  onChange={() => setAvailabilityMode("scheduled")}
                  className="text-indigo-600"
                />
                Schedule unlock for later
              </label>
            </div>
            {availabilityMode === "scheduled" ? (
              <div className="ml-6">
                <input
                  type="datetime-local"
                  value={scheduledUnlockLocal}
                  onChange={(e) => setScheduledUnlockLocal(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Test stays locked until this time — you can still edit it before then.
                  {editId ? " Saving applies this schedule for all your students." : ""}
                </p>
              </div>
            ) : null}
          </div>
      </section>

      {passageWindowEnabled ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={CREATE_SECTION_TITLE}>
                {isDataPassageTest(subject) ? "Data sets & questions" : "Passages & questions"}
              </h2>
              <p className={`${CREATE_BODY} mt-0.5`}>
                {rcAdaptiveMode
                  ? `Each passage is easy or complex with a bank of ${rcBankSize} tiered questions (${questionsPerPassage} shown per sitting).`
                  : `Set a tier on each ${unitLabels.singular} with exactly ${questionsPerPassage} questions.`}{" "}
                {buildUsingAi
                  ? adaptiveEnabled
                    ? ` AI generates ${bankMinimum} ${unitLabels.plural} (${sittingCount} per ${rcAdaptiveMode ? "level" : "tier"}).`
                    : ` AI generates ${bankMinimum} ${unitLabels.plural}.`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowBankPicker(true)}
                className={CREATE_TOOLBAR_ADD_BANK}
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
              {(isReadingComprehension && !isDataPassageTest(subject)
                ? RC_PASSAGE_TIERS
                : TEST_TIERS
              ).map((tier) => (
                <button
                  key={`add-passage-${tier.value}`}
                  type="button"
                  onClick={() => addPassage(tier.value)}
                  className={CREATE_TOOLBAR_ADD_PASSAGE}
                >
                  + {isReadingComprehension && !isDataPassageTest(subject)
                    ? tier.shortLabel
                    : `Tier ${tier.value}`}{" "}
                  {unitLabels.singular}
                </button>
              ))}
              {passages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePassage(passages[passages.length - 1].id)}
                  className={CREATE_TOOLBAR_NEUTRAL}
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
            rcPassageMode={isReadingComprehension && !isDataPassageTest(subject)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTierFilter("all")}
              className={`${CREATE_TOOLBAR_CHIP} ${
                activeTierFilter === "all"
                  ? CREATE_TOOLBAR_CHIP_ON
                  : CREATE_TOOLBAR_CHIP_OFF
              }`}
            >
              All {unitLabels.plural} ({passages.length})
            </button>
            {passageTierOptions.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setActiveTierFilter(String(tier.value))}
                className={`${CREATE_TOOLBAR_CHIP} ${
                  activeTierFilter === String(tier.value)
                    ? CREATE_TOOLBAR_CHIP_ON
                    : CREATE_TOOLBAR_CHIP_OFF
                }`}
              >
                {rcAdaptiveMode ? tier.shortLabel : tier.label} ({tierCounts[tier.value] || 0}{" "}
                {unitLabels.plural})
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
                  rcAdaptiveMode={rcAdaptiveMode}
                  questionsShownPerPassage={questionsPerPassage}
                  passageQuestions={passageQuestions}
                  expandedQuestionIds={expandedIds}
                  onToggleQuestion={toggleExpanded}
                  onChangeQuestion={updateQuestion}
                  onRemoveQuestion={removeQuestion}
                  subject={subject}
                  areaSuggestions
                  fixedQuestionCount={
                    rcAdaptiveMode ? rcBankSize : questionsPerPassage
                  }
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
            <h2 className={CREATE_SECTION_TITLE}>Question bank</h2>
            <p className={`${CREATE_BODY} mt-0.5`}>
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
              className={CREATE_TOOLBAR_ADD_BANK}
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
            className={CREATE_TOOLBAR_NEUTRAL}
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
            className={`${CREATE_TOOLBAR_CHIP} ${
              activeTierFilter === "all"
                ? CREATE_TOOLBAR_CHIP_ON
                : CREATE_TOOLBAR_CHIP_OFF
            }`}
          >
            All tiers ({questions.length})
          </button>
          {TEST_TIERS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              onClick={() => setActiveTierFilter(String(tier.value))}
              className={`${CREATE_TOOLBAR_CHIP} ${
                activeTierFilter === String(tier.value)
                  ? CREATE_TOOLBAR_CHIP_ON
                  : CREATE_TOOLBAR_CHIP_OFF
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
              className={CREATE_TOOLBAR_ADD}
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

      <div className={CREATE_STICKY_ACTION_BAR}>
        <button
          type="button"
          onClick={handleValidate}
          className={CREATE_ACTION_BUTTON_TEAL}
        >
          Validate &amp; preview publish
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || generating}
          className={CREATE_PUBLISH_BUTTON}
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
          to="/admin/tests"
          className={CREATE_STICKY_ACTION_LINK}
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
