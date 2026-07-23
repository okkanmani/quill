import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTestSession,
  lockTestAttempt,
  logout,
  saveTestAnswer,
  saveTestScratchpad,
  submitTest,
} from "../api";
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
import { useStudentNavLinks } from "../useStudentNavLinks";
import { formatTestTimer, formatWeightedTestScore } from "../testUtils";
import {
  isCurrentContextUnitComplete,
  contextualAdvanceHint,
  isContextualTest,
  canNavigateToTestSlot,
} from "../testTakeUtils";
import { formatDurationSeconds } from "../worksheetUtils";

const MAX_WORK_AREA_HEIGHT = 1000;
const MIN_WORK_AREA_HEIGHT = 320;

export default function StudentTestTake() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [attemptLocked, setAttemptLocked] = useState(false);
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

  function leaveWithoutSubmit() {
    if (isAdminPreview) return;
    if (testActiveRef.current && !submittedRef.current) {
      lockTestAttempt(worksheetIdRef.current);
    }
  }

  const loadSession = useCallback(
    async (slot) => {
      const data = await getTestSession(id, { slot, resume: true, preview: isAdminPreview });
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
    [id, isAdminPreview],
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
    setAttemptLocked(false);
    setSession(null);
    autoSubmitStarted.current = false;

    loadSession(1)
      .catch((err) => {
        if (err.status === 423) {
          const msg = err.message || "";
          if (
            msg.toLowerCase().includes("access") ||
            msg.toLowerCase().includes("unlock") ||
            msg.toLowerCase().includes("locked")
          ) {
            setAccessLocked(true);
          } else {
            setAttemptLocked(true);
          }
          setError(msg);
        } else if (err.message?.includes("already submitted")) {
          setSubmitted({ already: true });
        } else if (isAdminPreview && err.status === 400) {
          setError(err.message || "Choose a student first.");
        } else {
          setError(err.message || "Could not load test.");
        }
      })
      .finally(() => setLoading(false));
  }, [id, loadSession, isAdminPreview, selectedStudent]);

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
    if (session.is_rc) {
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
      const result = await submitTest(id);
      testActiveRef.current = false;
      setSubmitted(result);
    } catch (err) {
      if (fromTimer) {
        setSubmitError("Time expired but submit failed — contact your teacher.");
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
    const onBeforeUnload = () => leaveWithoutSubmit();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (workSaveTimer.current) {
        clearTimeout(workSaveTimer.current);
      }
    };
  }, []);

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
      const data = await getTestSession(id, { slot, resume: true, preview: isAdminPreview });
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
      const data = await saveTestAnswer(id, { slot: currentSlot, given: choice });
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
      });
      setSession(data);
    } catch (err) {
      setSubmitError(err.message || "Could not save answer.");
    }
  }

  function handleBack() {
    leaveWithoutSubmit();
    navigate(isAdminPreview ? "/admin/worksheets" : "/student/tests");
  }

  async function handleLogout() {
    leaveWithoutSubmit();
    await logout();
    navigate("/");
  }

  const slots = session?.slots || [];
  const slotData = slots.find((s) => s.slot === currentSlot);
  const question = slotData?.question;
  const passageQuestions = slotData?.questions || [];
  const passage = slotData?.passage;
  const isRc = Boolean(session?.is_rc);
  const sittingCount = session?.sitting_count || 20;
  const answeredCount = isRc
    ? slots.filter((s) => s.answered).length
    : slots.filter((s) => s.answered).length;
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
  }, [scratchpadAllowed, workMode, question, passageQuestions.length, currentSlot, isRc]);

  function renderWorkModeToggle() {
    const baseBtn =
      "inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 transition disabled:opacity-40 disabled:pointer-events-none";
    const active = "bg-indigo-100 text-indigo-900 border-indigo-300";
    const idle =
      "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-800";
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
          className={`${baseBtn} ${workMode === "text" ? active : idle}`}
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
          className={`${baseBtn} ${workMode === "scratchpad" ? active : idle}`}
        >
          <ScratchpadIcon />
        </button>
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
          onBack={() => navigate("/admin/worksheets")}
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

  if ((accessLocked || attemptLocked) && error) {
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
            {submitted.already ? "Test already submitted" : "Test submitted"}
          </h2>
          {submitted.weighted_score != null ? (
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
          {submitted.review_id ? (
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
              {isRc ? "Passage" : "Question"} {currentSlot} of {sittingCount}
              <span className="text-slate-400 mx-2">·</span>
              {answeredCount}/{sittingCount} {isRc ? "passages" : "answered"}
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
            {isRc ? "Passage navigator" : "Question navigator"}
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
                    ? isRc
                      ? "Complete earlier passages first"
                      : "Answer earlier questions first"
                    : !navigable
                      ? isRc
                        ? advanceHint || "Complete this passage before moving on"
                        : advanceHint || "Complete this passage or data set first"
                      : isRc
                        ? slot.answered
                          ? `Review passage ${slot.slot}`
                          : `Passage ${slot.slot}`
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
              {!isRc ? (
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
                Next {isRc ? "passage" : ""} →
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
              {isRc
                ? `Answer all questions in every passage to submit (${session?.questions_per_passage || passageQuestions.length} per passage).`
                : `Answer all ${sittingCount} questions to submit.`}
            </p>
          ) : null}
        </div>

        {isRc && (passage || passageQuestions.length > 0) ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start mb-3">
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-auto max-h-[calc(100dvh-12rem)]">
              {passage ? (
                <div className="mb-4">
                  <WorksheetPassageContent passage={passage} embedded />
                </div>
              ) : null}
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">
                  Questions for this passage
                </p>
              </div>
              <div className="space-y-6">
                {passageQuestions.map((passageQuestion, index) => {
                  const qid = passageQuestion.id;
                  const selectedChoice = passageResponses[qid] || "";
                  return (
                    <div key={qid} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
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
            </div>

            {scratchpadAllowed ? (
              <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col max-h-[1000px]">
                <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Your work</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Notes for this passage — not graded.
                    </p>
                  </div>
                  {renderWorkModeToggle()}
                </div>
                <div
                  ref={workAreaRef}
                  className="flex flex-col min-h-[280px] max-h-[920px] overflow-hidden"
                >
                  {workMode === "text" ? (
                    <textarea
                      value={workText}
                      onChange={(e) => handleWorkTextChange(e.target.value)}
                      disabled={submitting || timedOut}
                      placeholder="Jot notes about this passage…"
                      className="w-full h-full min-h-[280px] max-h-[920px] flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 resize-none"
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
            {isRc ? "Loading passage…" : "Loading question…"}
          </p>
        )}
      </div>
    </div>
  );
}
