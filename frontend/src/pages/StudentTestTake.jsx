import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getTestSession,
  lockTestAttempt,
  logout,
  saveTestAnswer,
  saveTestScratchpad,
  submitTest,
} from "../api";
import {
  clearTestSittingActive,
  isTestSittingActive,
  markTestSittingActive,
} from "../testSittingUtils";
import AppHeader from "../components/AppHeader";
import AdminStudentBanner from "../components/AdminStudentBanner";
import Drawpad from "../components/Drawpad";
import QuillLoading from "../components/QuillLoading";
import WorksheetPassageContent from "../components/WorksheetPassageContent";
import PadlockIcon from "../components/PadlockIcon";
import {
  ScratchpadIcon,
  TextAnswerIcon,
} from "../components/ResponseModeIcons";
import {
  ICON_ACTION_ACTIVE_CLASS,
  ICON_ACTION_BUTTON_CLASS,
  ICON_ACTION_IDLE_CLASS,
} from "../components/rowActionButtonStyles";
import { useStudentNavLinks } from "../useStudentNavLinks";
import { formatTestTimer, formatWeightedTestScore } from "../testUtils";
import {
  isCurrentContextUnitComplete,
  contextualAdvanceHint,
  isContextualTest,
  canNavigateToTestSlot,
  isPassageWindowSession,
  rcPassageTierLabel,
  testTakeUnitLabels,
} from "../testTakeUtils";
import { formatDurationSeconds } from "../worksheetUtils";

const MAX_WORK_AREA_HEIGHT = 1000;
const MIN_WORK_AREA_HEIGHT = 320;
const DATA_WORK_AREA_HEIGHT = 500;

function dataPanelGridStyle() {
  return { gridTemplateRows: `auto ${DATA_WORK_AREA_HEIGHT}px` };
}

export default function StudentTestTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const compositeAttemptId = searchParams.get("composite_attempt_id");
  const compositeId = searchParams.get("composite_id");
  const inComposite = Boolean(compositeAttemptId && compositeId);
  const isAdminPreview = localStorage.getItem("role") === "admin";
  const selectedStudent = localStorage.getItem("studentName") || "";
  const { navLinks } = useStudentNavLinks();

  const [session, setSession] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(1);
  const [selected, setSelected] = useState("");
  const [passageResponses, setPassageResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [accessLocked, setAccessLocked] = useState(false);
  const [workMode, setWorkMode] = useState("text");
  const [workText, setWorkText] = useState("");
  const [scratchpadData, setScratchpadData] = useState("");

  const submittedRef = useRef(false);
  const testActiveRef = useRef(false);
  const worksheetIdRef = useRef(id);
  const autoSubmitStarted = useRef(false);
  const workSaveTimer = useRef(null);
  const workTextRef = useRef("");
  const scratchpadDataRef = useRef("");
  const workModeRef = useRef("text");
  const workAreaRef = useRef(null);
  const [workAreaHeight, setWorkAreaHeight] = useState(400);
  const [activePassageQuestionIndex, setActivePassageQuestionIndex] = useState(0);

  const timedOut = !isAdminPreview && timeExpired;

  useEffect(() => {
    submittedRef.current = Boolean(submitted);
  }, [submitted]);

  useEffect(() => {
    worksheetIdRef.current = id;
  }, [id]);

  useEffect(() => {
    testActiveRef.current = false;
  }, [id]);

  const compositeAttemptIdRef = useRef(compositeAttemptId);

  useEffect(() => {
    compositeAttemptIdRef.current = compositeAttemptId;
  }, [compositeAttemptId]);

  function compositeTestOptions() {
    const value = compositeAttemptIdRef.current;
    return value ? { compositeAttemptId: value } : {};
  }

  async function leaveWithoutSubmit() {
    if (isAdminPreview) return;
    if (testActiveRef.current && !submittedRef.current) {
      clearTestSittingActive(worksheetIdRef.current, compositeAttemptIdRef.current);
      testActiveRef.current = false;
      try {
        await submitTest(worksheetIdRef.current, {
          ...compositeTestOptions(),
          partial: true,
        });
      } catch {
        lockTestAttempt(worksheetIdRef.current, compositeTestOptions());
      }
    }
  }

  const loadSession = useCallback(
    async (slot, { resume = true } = {}) => {
      const data = await getTestSession(id, {
        slot,
        resume: true,
        preview: isAdminPreview,
        compositeAttemptId: compositeAttemptId || undefined,
      });
      setSession(data);
      if (isAdminPreview) {
        setRemainingSeconds(null);
        setTimeExpired(false);
      } else {
        setRemainingSeconds(data.remaining_seconds);
        setTimeExpired(Boolean(data.expired));
      }
      if (data.completed) {
        setSubmitted({ already: true });
      }
      testActiveRef.current = !data.completed && !data.locked;
      return data;
    },
    [id, isAdminPreview, compositeAttemptId],
  );

  useEffect(() => {
    if (isAdminPreview && !selectedStudent) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setSubmitted(null);
    setAccessLocked(false);
    setSession(null);
    autoSubmitStarted.current = false;

    const continuingSitting = isTestSittingActive(id, compositeAttemptId);
    if (!continuingSitting) {
      markTestSittingActive(id, compositeAttemptId);
    }

    loadSession(1, { resume: continuingSitting })
      .catch((err) => {
        if (err.status === 423) {
          setAccessLocked(true);
          setError(err.message || "This test is locked.");
        } else if (err.message?.includes("already submitted")) {
          setSubmitted({ already: true });
        } else if (isAdminPreview && err.status === 400) {
          setError(err.message || "Choose a student first.");
        } else {
          setError(err.message || "Could not load test.");
        }
      })
      .finally(() => setLoading(false));
  }, [id, loadSession, isAdminPreview, selectedStudent, compositeAttemptId]);

  useEffect(() => {
    if (isAdminPreview || remainingSeconds == null || submitted) return undefined;
    if (remainingSeconds <= 0) {
      setTimeExpired(true);
      return undefined;
    }
    const t = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev == null || prev <= 1) {
          setTimeExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [remainingSeconds, submitted, isAdminPreview]);

  useEffect(() => {
    if (!session?.slots) return;
    const slotData = session.slots.find((s) => s.slot === currentSlot);
    if (isPassageWindowSession(session)) {
      setPassageResponses(slotData?.responses || {});
      setSelected("");
    } else {
      setSelected(slotData?.given || "");
      setPassageResponses({});
    }
    const nextMode = slotData?.work_mode === "scratchpad" ? "scratchpad" : "text";
    const nextText = slotData?.work_text || "";
    const nextScratchpad = slotData?.scratchpad || "";
    setWorkMode(nextMode);
    setWorkText(nextText);
    setScratchpadData(nextScratchpad);
    workModeRef.current = nextMode;
    workTextRef.current = nextText;
    scratchpadDataRef.current = nextScratchpad;
  }, [session, currentSlot]);

  useEffect(() => {
    setActivePassageQuestionIndex(0);
  }, [currentSlot]);

  const flushWorkSave = useCallback(
    async (
      slot = currentSlot,
      {
        scratchpad = scratchpadDataRef.current,
        work_text = workTextRef.current,
        work_mode = workModeRef.current,
      } = {},
    ) => {
      if (isAdminPreview || submitted || !session) return;
      if (workSaveTimer.current) {
        clearTimeout(workSaveTimer.current);
        workSaveTimer.current = null;
      }
      try {
        const data = await saveTestScratchpad(id, {
          slot,
          scratchpad: scratchpad || "",
          work_text,
          work_mode,
          ...compositeTestOptions(),
        });
        setSession(data);
      } catch (err) {
        setSubmitError(err.message || "Could not save your work.");
      }
    },
    [currentSlot, id, isAdminPreview, session, submitted],
  );

  function scheduleWorkSave(overrides = {}) {
    if (isAdminPreview || submitted) return;
    if (workSaveTimer.current) {
      clearTimeout(workSaveTimer.current);
    }
    workSaveTimer.current = setTimeout(() => {
      flushWorkSave(currentSlot, overrides);
    }, 800);
  }

  function handleWorkTextChange(value) {
    setWorkText(value);
    workTextRef.current = value;
    scheduleWorkSave({ work_text: value });
  }

  function handleScratchpadChange(dataUrl) {
    setScratchpadData(dataUrl);
    scratchpadDataRef.current = dataUrl;
    scheduleWorkSave({ scratchpad: dataUrl });
  }

  async function handleWorkModeChange(mode) {
    setWorkMode(mode);
    workModeRef.current = mode;
    await flushWorkSave(currentSlot, { work_mode: mode });
  }

  async function handleSubmit(fromTimer = false) {
    if (submitted || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await flushWorkSave(currentSlot);
      const usePartial = fromTimer && !allAnswered;
      const result = await submitTest(id, {
        ...compositeTestOptions(),
        partial: usePartial,
      });
      clearTestSittingActive(id, compositeAttemptId);
      testActiveRef.current = false;
      setSubmitted(result);
    } catch (err) {
      if (fromTimer) {
        try {
          const result = await submitTest(id, {
            ...compositeTestOptions(),
            partial: true,
          });
          clearTestSittingActive(id, compositeAttemptId);
          testActiveRef.current = false;
          setSubmitted(result);
          return;
        } catch (retryErr) {
          setSubmitError(
            retryErr.message || "Time expired but submit failed — contact your teacher.",
          );
        }
      } else {
        setSubmitError(err.message || "Could not submit test.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (isAdminPreview || !timeExpired || submitted || autoSubmitStarted.current || !session) return;
    autoSubmitStarted.current = true;
    handleSubmit(true);
  }, [timeExpired, submitted, session, isAdminPreview]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (isAdminPreview) return;
      if (testActiveRef.current && !submittedRef.current) {
        clearTestSittingActive(worksheetIdRef.current, compositeAttemptIdRef.current);
        lockTestAttempt(worksheetIdRef.current, compositeTestOptions());
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (workSaveTimer.current) {
        clearTimeout(workSaveTimer.current);
      }
      if (!isAdminPreview && testActiveRef.current && !submittedRef.current) {
        submitTest(worksheetIdRef.current, {
          ...compositeTestOptions(),
          partial: true,
        }).catch(() => {
          lockTestAttempt(worksheetIdRef.current, compositeTestOptions());
        });
        clearTestSittingActive(worksheetIdRef.current, compositeAttemptIdRef.current);
        testActiveRef.current = false;
      }
    };
  }, [isAdminPreview]);

  async function goToSlot(slot) {
    if (!session || submitted) return;
    if (!canNavigateToTestSlot(session, slot, currentSlot)) {
      setSubmitError(
        contextualAdvanceHint(
          session,
          slotData,
          session?.questions_per_passage || passageQuestions.length,
        ) || "Complete this passage or data set before moving on.",
      );
      return;
    }
    setSubmitError("");
    try {
      await flushWorkSave(currentSlot);
      const data = await getTestSession(id, {
        slot,
        resume: true,
        preview: isAdminPreview,
        compositeAttemptId: compositeAttemptId || undefined,
      });
      setSession(data);
      setCurrentSlot(slot);
    } catch (err) {
      setSubmitError(err.message || "Could not open that question.");
    }
  }

  async function handleSelectChoice(choice) {
    if (submitted || submitting || timedOut) return;
    setSelected(choice);
    setSubmitError("");
    try {
      const data = await saveTestAnswer(id, {
        slot: currentSlot,
        given: choice,
        ...compositeTestOptions(),
      });
      setSession(data);
    } catch (err) {
      setSubmitError(err.message || "Could not save answer.");
    }
  }

  async function handleSelectPassageChoice(questionId, choice) {
    if (submitted || submitting || timedOut) return;
    const nextResponses = { ...passageResponses, [questionId]: choice };
    setPassageResponses(nextResponses);
    setSubmitError("");
    try {
      const data = await saveTestAnswer(id, {
        slot: currentSlot,
        responses: nextResponses,
        ...compositeTestOptions(),
      });
      setSession(data);
    } catch (err) {
      setSubmitError(err.message || "Could not save answer.");
    }
  }

  function compositeHubPath() {
    return compositeId ? `/student/composites/${compositeId}` : "/student/tests?tab=composite";
  }

  async function handleBack() {
    await leaveWithoutSubmit();
    if (isAdminPreview) {
      navigate("/admin/tests");
      return;
    }
    navigate(inComposite ? compositeHubPath() : "/student/tests");
  }

  async function handleLogout() {
    await leaveWithoutSubmit();
    await logout();
    navigate("/");
  }

  const slots = session?.slots || [];
  const slotData = slots.find((s) => s.slot === currentSlot);
  const question = slotData?.question;
  const passageQuestions = slotData?.questions || [];
  const passage = slotData?.passage;
  const isPassageWindow = isPassageWindowSession(session);
  const rcAdaptive = Boolean(session?.is_rc && session?.test_adaptive !== false);
  const passageTierLabel = rcAdaptive ? rcPassageTierLabel(slotData?.tier) : null;
  const isDataTest = session?.subject === "data";
  const isRcPassageLayout = isPassageWindow && !isDataTest;
  const unitLabels = testTakeUnitLabels(session);
  const sittingCount = session?.sitting_count || 20;
  const answeredCount = slots.filter((s) => s.answered).length;
  const allAnswered = answeredCount >= sittingCount;
  const scratchpadAllowed = session?.scratchpad !== false;
  const contextualTest = isContextualTest(session);
  const currentUnitComplete = isCurrentContextUnitComplete(
    session,
    slotData,
    passageResponses,
    currentSlot,
  );
  const advanceHint = contextualAdvanceHint(
    session,
    slotData,
    session?.questions_per_passage || passageQuestions.length,
  );
  const canGoNext =
    currentSlot < sittingCount && (!contextualTest || currentUnitComplete);

  useEffect(() => {
    if (isDataTest && isPassageWindow) {
      setWorkAreaHeight(DATA_WORK_AREA_HEIGHT);
      return undefined;
    }

    const el = workAreaRef.current;
    if (!el || !scratchpadAllowed) return undefined;

    const updateHeight = () => {
      setWorkAreaHeight(
        Math.min(
          MAX_WORK_AREA_HEIGHT,
          Math.max(MIN_WORK_AREA_HEIGHT, Math.floor(el.clientHeight)),
        ),
      );
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    scratchpadAllowed,
    workMode,
    question,
    passageQuestions.length,
    currentSlot,
    isPassageWindow,
    isDataTest,
  ]);

  function renderWorkModeToggle() {
    const locked = submitting || timedOut;

    return (
      <div className="flex gap-2" role="group" aria-label="Work mode">
        <button
          type="button"
          disabled={locked}
          onClick={() => handleWorkModeChange("text")}
          title="Text notes"
          aria-label="Text notes"
          aria-pressed={workMode === "text"}
          className={`${ICON_ACTION_BUTTON_CLASS} ${
            workMode === "text" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
          }`}
        >
          <TextAnswerIcon />
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => handleWorkModeChange("scratchpad")}
          title="Scratchpad"
          aria-label="Scratchpad"
          aria-pressed={workMode === "scratchpad"}
          className={`${ICON_ACTION_BUTTON_CLASS} ${
            workMode === "scratchpad" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
          }`}
        >
          <ScratchpadIcon />
        </button>
      </div>
    );
  }

  function passageQuestionMarkerClass(index, answered) {
    const base =
      "shrink-0 min-w-[2.25rem] h-9 px-2 rounded-lg text-xs font-bold tabular-nums border transition";
    if (index === activePassageQuestionIndex) {
      return `${base} bg-teal-600 text-white border-teal-700`;
    }
    if (answered) {
      return `${base} bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100`;
    }
    return `${base} bg-white text-slate-700 border-slate-200 hover:border-teal-300`;
  }

  function renderPassageQuestionList() {
    return (
      <div className="space-y-6">
        {passageQuestions.map((passageQuestion, index) => {
          const qid = passageQuestion.id;
          const selectedChoice = passageResponses[qid] || "";
          return (
            <div
              key={qid}
              className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"
            >
              <p className="text-slate-900 font-medium mb-3">
                {index + 1}. {passageQuestion.prompt}
              </p>
              <div className="flex flex-col gap-2">
                {(passageQuestion.choices || []).map((choice) => {
                  const isSelected = selectedChoice === choice;
                  return (
                    <button
                      key={`${qid}-${choice}`}
                      type="button"
                      disabled={submitting || timedOut}
                      onClick={() => handleSelectPassageChoice(qid, choice)}
                      className={`border rounded-xl px-4 py-3 text-sm text-left transition ${
                        isSelected
                          ? "border-teal-500 bg-teal-50 text-slate-900"
                          : "border-slate-200 text-slate-800 hover:border-teal-300"
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderRcPassageQuestionView() {
    if (!passageQuestions.length) {
      return (
        <p className="text-sm text-slate-500">No questions loaded for this passage.</p>
      );
    }

    const safeIndex = Math.min(
      activePassageQuestionIndex,
      Math.max(0, passageQuestions.length - 1),
    );
    const passageQuestion = passageQuestions[safeIndex];
    const qid = passageQuestion.id;
    const selectedChoice = passageResponses[qid] || "";

    return (
      <div className="flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
          <p className="text-sm font-semibold text-slate-900">
            {unitLabels.questionsHeading}
          </p>
          <div className="overflow-x-auto max-w-full ml-auto">
            <div
              className="flex gap-1.5 min-w-min justify-end"
              role="tablist"
              aria-label="Questions for this passage"
            >
              {passageQuestions.map((item, index) => {
                const answered = Boolean(
                  String(passageResponses[item.id] || "").trim(),
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === safeIndex}
                    aria-controls={`rc-passage-question-${item.id}`}
                    disabled={submitting || timedOut}
                    onClick={() => setActivePassageQuestionIndex(index)}
                    className={passageQuestionMarkerClass(index, answered)}
                    title={
                      answered
                        ? `Question ${index + 1} — answered`
                        : `Question ${index + 1}`
                    }
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          id={`rc-passage-question-${qid}`}
          role="tabpanel"
          className="rounded-xl border border-slate-100 bg-slate-50/40 px-4 py-4"
        >
          <p className="text-slate-900 font-medium mb-3 leading-relaxed">
            {safeIndex + 1}. {passageQuestion.prompt}
          </p>
          <div className="flex flex-col gap-2">
            {(passageQuestion.choices || []).map((choice) => {
              const isSelected = selectedChoice === choice;
              return (
                <button
                  key={`${qid}-${choice}`}
                  type="button"
                  disabled={submitting || timedOut}
                  onClick={() => handleSelectPassageChoice(qid, choice)}
                  className={`border rounded-xl px-4 py-3 text-sm text-left transition ${
                    isSelected
                      ? "border-teal-500 bg-teal-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-teal-300"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderPassageScratchpadPanel({
    noteLabel,
    textPlaceholder,
    fixedWorkHeight = null,
  }) {
    if (!scratchpadAllowed) return null;

    const workHeight = fixedWorkHeight ?? null;
    const panelClass =
      workHeight != null
        ? "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid shrink-0"
        : "lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col max-h-[1000px]";

    return (
      <div
        className={panelClass}
        style={workHeight != null ? dataPanelGridStyle() : undefined}
      >
        <div className="flex items-center justify-between gap-3 mb-3 shrink-0 min-h-[3.5rem]">
          <div>
            <p className="text-sm font-medium text-slate-900">Your work</p>
            <p className="text-xs text-slate-600 mt-0.5">{noteLabel}</p>
          </div>
          {renderWorkModeToggle()}
        </div>
        <div
          ref={workAreaRef}
          className={
            workHeight != null
              ? "relative min-h-0 overflow-hidden"
              : "flex flex-col min-h-[280px] max-h-[920px] overflow-hidden"
          }
        >
          {workMode === "text" ? (
            <textarea
              value={workText}
              onChange={(e) => handleWorkTextChange(e.target.value)}
              disabled={submitting || timedOut}
              placeholder={textPlaceholder}
              className={
                workHeight != null
                  ? "absolute inset-0 w-full h-full box-border border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 resize-none overflow-y-auto"
                  : "w-full h-full min-h-[280px] max-h-[920px] flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 resize-none"
              }
            />
          ) : (
            <div
              className={
                workHeight != null
                  ? "absolute inset-0 overflow-hidden"
                  : "overflow-hidden shrink-0"
              }
            >
              <Drawpad
                key={`test-scratch-${id}-${currentSlot}`}
                value={scratchpadData}
                onChange={handleScratchpadChange}
                disabled={submitting || timedOut}
                showHeading={false}
                className={workHeight != null ? "mt-0 h-full overflow-hidden" : "mt-0 overflow-hidden"}
                canvasHeight={workHeight ?? workAreaHeight}
                fillHeight={workHeight != null}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  function navigatorClass(slot) {
    const base =
      "min-w-[2.25rem] h-9 px-2 rounded-lg text-xs font-bold tabular-nums border transition";
    if (slot.slot === currentSlot) {
      return `${base} bg-teal-600 text-white border-teal-700`;
    }
    if (slot.answered) {
      return `${base} bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100`;
    }
    if (slot.assigned) {
      return `${base} bg-white text-slate-700 border-slate-200 hover:border-teal-300`;
    }
    return `${base} bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed`;
  }

  if (isAdminPreview && !selectedStudent) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <AppHeader
          onBack={() => navigate("/admin/tests")}
          onLogout={async () => {
            await logout();
            navigate("/");
          }}
        />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <AdminStudentBanner context="test" centered />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <QuillLoading fullscreen label="Loading test…" />
      </div>
    );
  }

  if (accessLocked && error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <AppHeader onBack={handleBack} onLogout={handleLogout} />
        <div className="max-w-lg mx-auto mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-8 text-center">
          <PadlockIcon className="w-10 h-10 mx-auto text-violet-600 mb-3" />
          <h2 className="text-xl font-semibold text-violet-950">Test locked</h2>
          <p className="text-violet-900/90 text-sm mt-3 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-6 w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-xl transition"
          >
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <AppHeader onBack={handleBack} onLogout={handleLogout} />
        <div className="max-w-lg mx-auto mt-4">
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-800 font-medium">{error}</p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-4 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            >
              ← {isAdminPreview ? "Back to Worksheets" : "Back to Tests"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <AppHeader onBack={handleBack} onLogout={handleLogout} />
        <div className="max-w-3xl mx-auto mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6">
          <h2 className="text-xl font-bold text-emerald-950 mb-2">
            {submitted.already ? "Test already submitted" : "Section complete"}
          </h2>
          {!inComposite && submitted.weighted_score != null ? (
            <>
              <p className="text-emerald-900 font-semibold tabular-nums">
                Weighted score:{" "}
                {formatWeightedTestScore(
                  submitted.weighted_score,
                  submitted.max_weighted_score,
                )}
              </p>
              {submitted.duration_seconds != null ? (
                <p className="text-sm text-emerald-800 mt-1">
                  Time: {formatDurationSeconds(submitted.duration_seconds)}
                </p>
              ) : null}
            </>
          ) : null}
          {inComposite ? (
            <>
              <p className="text-sm text-emerald-800 mt-1">
                This section is done. Your score will be shown after you submit the full
                assessment from the hub.
              </p>
              <p className="text-sm text-emerald-800 mt-3">
                Return to the assessment hub to continue other sections or submit the full
                assessment when every section is complete. Review for missed questions
                unlocks after the full assessment is submitted.
              </p>
              <button
                type="button"
                onClick={() => navigate(compositeHubPath())}
                className="inline-flex mt-4 rounded-xl bg-teal-100 border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-950 hover:bg-teal-200 transition"
              >
                Back to assessment hub
              </button>
            </>
          ) : submitted.review_id ? (
            <button
              type="button"
              onClick={() => navigate(`/student/tests/review/${submitted.review_id}`)}
              className="inline-flex mt-4 rounded-xl bg-amber-100 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200 transition"
            >
              Review {submitted.missed_count} missed question
              {submitted.missed_count === 1 ? "" : "s"}
            </button>
          ) : (
            <p className="text-sm text-emerald-800 mt-3">Perfect score — no review needed.</p>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <AppHeader onBack={handleBack} onLogout={handleLogout} />
        <p className="text-slate-600 mt-8">Could not start this test.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-2 py-3 sm:px-3 flex flex-col">
      <AppHeader onBack={handleBack} onLogout={handleLogout} />
      <div className="w-full flex flex-col flex-1 min-h-0">
          {isAdminPreview ? (
          <p className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900 shrink-0">
            Admin preview — timer off; answers won&apos;t lock the student&apos;s attempt when you leave.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-950">{session.title}</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {isPassageWindow ? unitLabels.capitalized : "Question"} {currentSlot} of {sittingCount}
              {passageTierLabel ? (
                <>
                  <span className="text-slate-400 mx-2">·</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      slotData?.tier === 1
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-violet-100 text-violet-800"
                    }`}
                  >
                    {passageTierLabel} passage
                  </span>
                </>
              ) : null}
              <span className="text-slate-400 mx-2">·</span>
              {answeredCount}/{sittingCount}{" "}
              {isPassageWindow ? unitLabels.plural : "answered"}
            </p>
          </div>
          {!isAdminPreview && remainingSeconds != null ? (
            <div
              className={`text-lg font-bold tabular-nums px-3 py-1 rounded-xl border ${
                remainingSeconds <= 60
                  ? "text-red-700 border-red-200 bg-red-50"
                  : "text-slate-800 border-slate-200 bg-white"
              }`}
            >
              {formatTestTimer(remainingSeconds)}
            </div>
          ) : null}
        </div>

        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shrink-0">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            {isPassageWindow ? unitLabels.navigator : "Question navigator"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => {
              const navigable = canNavigateToTestSlot(session, slot.slot, currentSlot);
              return (
              <button
                key={slot.slot}
                type="button"
                disabled={!slot.assigned || !navigable}
                onClick={() => goToSlot(slot.slot)}
                className={navigatorClass(slot)}
                title={
                  !slot.assigned
                    ? isPassageWindow
                      ? `Complete earlier ${unitLabels.plural} first`
                      : "Answer earlier questions first"
                    : !navigable
                      ? isPassageWindow
                        ? advanceHint || `Complete this ${unitLabels.singular} before moving on`
                        : advanceHint || "Complete this passage or data set first"
                      : isPassageWindow
                        ? slot.answered
                          ? `Review ${unitLabels.singular} ${slot.slot}`
                          : `${unitLabels.capitalized} ${slot.slot}`
                        : `Question ${slot.slot}`
                }
              >
                {slot.slot}
              </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 shrink-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              {!isPassageWindow ? (
                <button
                  type="button"
                  disabled={currentSlot <= 1}
                  onClick={() => goToSlot(currentSlot - 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Previous
                </button>
              ) : null}
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => goToSlot(currentSlot + 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next {isPassageWindow ? unitLabels.singular : ""} →
              </button>
            </div>
            <button
              type="button"
              disabled={!allAnswered || submitting || timedOut}
              onClick={() => handleSubmit(false)}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-40 transition"
            >
              {submitting ? "Submitting…" : "Submit test"}
            </button>
          </div>
          {submitError ? <p className="text-red-600 text-sm">{submitError}</p> : null}
          {!allAnswered && contextualTest && !currentUnitComplete && advanceHint ? (
            <p className="text-amber-800 text-xs">{advanceHint}</p>
          ) : null}
          {!allAnswered ? (
            <p className="text-slate-500 text-xs">
              {isPassageWindow
                ? `Answer all questions in every ${unitLabels.singular} to submit (${session?.questions_per_passage || passageQuestions.length} per ${unitLabels.singular}).`
                : `Answer all ${sittingCount} questions to submit.`}
            </p>
          ) : null}
        </div>

        {isPassageWindow && (passage || passageQuestions.length > 0) ? (
          isDataTest ? (
            <div className="space-y-3 mb-3">
              {passage ? (
                <WorksheetPassageContent passage={passage} embedded centered />
              ) : null}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                <div
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid shrink-0"
                  style={dataPanelGridStyle()}
                >
                  <div className="mb-4 shrink-0 min-h-[2.5rem]">
                    <p className="text-sm font-semibold text-slate-900">
                      {unitLabels.questionsHeading}
                    </p>
                  </div>
                  <div className="overflow-y-auto min-h-0 box-border">
                    {renderPassageQuestionList()}
                  </div>
                </div>
                {renderPassageScratchpadPanel({
                  noteLabel: `Notes for this ${unitLabels.singular} — not graded.`,
                  textPlaceholder: `Jot notes about this ${unitLabels.singular}…`,
                  fixedWorkHeight: DATA_WORK_AREA_HEIGHT,
                })}
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start mb-3 min-h-0 flex-1">
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col max-h-[calc(100dvh-12rem)] min-h-0">
              {passage ? (
                <div className="overflow-y-auto min-h-0 shrink mb-4 max-h-[min(42vh,28rem)] pr-1">
                  <WorksheetPassageContent passage={passage} embedded />
                </div>
              ) : null}
              <div className="shrink-0 border-t border-slate-100 pt-4 min-h-0 flex flex-col">
                {isRcPassageLayout ? renderRcPassageQuestionView() : (
                  <>
                    <p className="text-sm font-semibold text-slate-900 mb-3">
                      {unitLabels.questionsHeading}
                    </p>
                    {renderPassageQuestionList()}
                  </>
                )}
              </div>
            </div>

            {renderPassageScratchpadPanel({
              noteLabel: "Notes for this passage — not graded.",
              textPlaceholder: "Jot notes about this passage…",
            })}
          </div>
          )
        ) : question ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-start mb-3">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-auto max-h-[calc(100dvh-12rem)]">
              {question.passage ? (
                <div className="mb-4">
                  <WorksheetPassageContent passage={question.passage} embedded />
                </div>
              ) : null}
              <p className="text-slate-900 font-medium mb-4">{question.prompt}</p>
              <div className="flex flex-col gap-2">
                {(question.choices || []).map((choice) => {
                  const isSelected = selected === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={submitting || timedOut}
                      onClick={() => handleSelectChoice(choice)}
                      className={`border rounded-xl px-4 py-3 text-sm text-left transition ${
                        isSelected
                          ? "border-teal-500 bg-teal-50 text-slate-900"
                          : "border-slate-200 text-slate-800 hover:border-teal-300"
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>

            {scratchpadAllowed ? (
              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col max-h-[1000px]">
                <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Your work</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Jot notes or sketch — not graded.
                    </p>
                  </div>
                  {renderWorkModeToggle()}
                </div>
                <div
                  ref={workAreaRef}
                  className="flex flex-col min-h-[320px] max-h-[920px] overflow-hidden"
                >
                  {workMode === "text" ? (
                    <textarea
                      value={workText}
                      onChange={(e) => handleWorkTextChange(e.target.value)}
                      disabled={submitting || timedOut}
                      placeholder="Show your reasoning, calculations, or notes…"
                      className="w-full h-full min-h-[320px] max-h-[920px] flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 resize-none"
                    />
                  ) : (
                    <Drawpad
                      key={`test-scratch-${id}-${currentSlot}`}
                      value={scratchpadData}
                      onChange={handleScratchpadChange}
                      disabled={submitting || timedOut}
                      showHeading={false}
                      className="mt-0 flex-1 min-h-0 overflow-hidden"
                      canvasHeight={workAreaHeight}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-slate-500">
            {isPassageWindow ? `Loading ${unitLabels.singular}…` : "Loading question…"}
          </p>
        )}
      </div>
    </div>
  );
}
