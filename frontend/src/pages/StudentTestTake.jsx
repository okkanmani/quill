import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTestSession,
  lockTestAttempt,
  logout,
  saveTestAnswer,
  submitTest,
} from "../api";
import AppHeader from "../components/AppHeader";
import QuillLoading from "../components/QuillLoading";
import { QuestionDifficultyStars } from "../components/DifficultyStars";
import PadlockIcon from "../components/PadlockIcon";
import { useStudentNavLinks } from "../useStudentNavLinks";
import { formatTestTimer, formatWeightedTestScore } from "../testUtils";
import { formatDurationSeconds } from "../worksheetUtils";

export default function StudentTestTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { navLinks } = useStudentNavLinks();

  const [session, setSession] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(1);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [accessLocked, setAccessLocked] = useState(false);
  const [attemptLocked, setAttemptLocked] = useState(false);

  const submittedRef = useRef(false);
  const testActiveRef = useRef(false);
  const worksheetIdRef = useRef(id);
  const autoSubmitStarted = useRef(false);

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
    if (testActiveRef.current && !submittedRef.current) {
      lockTestAttempt(worksheetIdRef.current);
    }
  }

  const loadSession = useCallback(
    async (slot) => {
      const data = await getTestSession(id, { slot, resume: true });
      setSession(data);
      setRemainingSeconds(data.remaining_seconds);
      setTimeExpired(Boolean(data.expired));
      if (data.completed) {
        setSubmitted({ already: true });
      }
      testActiveRef.current = !data.completed && !data.locked;
      return data;
    },
    [id],
  );

  useEffect(() => {
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
        } else {
          setError(err.message || "Could not load test.");
        }
      })
      .finally(() => setLoading(false));
  }, [id, loadSession]);

  useEffect(() => {
    if (remainingSeconds == null || submitted) return undefined;
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
  }, [remainingSeconds, submitted]);

  useEffect(() => {
    if (!session?.slots) return;
    const slotData = session.slots.find((s) => s.slot === currentSlot);
    setSelected(slotData?.given || "");
  }, [session, currentSlot]);

  async function handleSubmit(fromTimer = false) {
    if (submitted || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
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
    if (!timeExpired || submitted || autoSubmitStarted.current || !session) return;
    autoSubmitStarted.current = true;
    handleSubmit(true);
  }, [timeExpired, submitted, session]);

  useEffect(() => {
    const onBeforeUnload = () => leaveWithoutSubmit();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function goToSlot(slot) {
    if (!session || submitted) return;
    setSubmitError("");
    try {
      const data = await getTestSession(id, { slot, resume: true });
      setSession(data);
      setCurrentSlot(slot);
    } catch (err) {
      setSubmitError(err.message || "Could not open that question.");
    }
  }

  async function handleSelectChoice(choice) {
    if (submitted || submitting || timeExpired) return;
    setSelected(choice);
    setSubmitError("");
    try {
      const data = await saveTestAnswer(id, { slot: currentSlot, given: choice });
      setSession(data);
    } catch (err) {
      setSubmitError(err.message || "Could not save answer.");
    }
  }

  function handleBack() {
    leaveWithoutSubmit();
    navigate("/student/tests");
  }

  async function handleLogout() {
    leaveWithoutSubmit();
    await logout();
    navigate("/");
  }

  const slots = session?.slots || [];
  const slotData = slots.find((s) => s.slot === currentSlot);
  const question = slotData?.question;
  const sittingCount = session?.sitting_count || 20;
  const answeredCount = slots.filter((s) => s.answered).length;
  const allAnswered = answeredCount >= sittingCount;

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
        <AppHeader onBack={handleBack} trailing={`Hi, ${name}!`} onLogout={handleLogout} />
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
        <AppHeader onBack={handleBack} trailing={`Hi, ${name}!`} onLogout={handleLogout} />
        <div className="max-w-lg mx-auto mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800 font-medium">{error}</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            ← Back to Tests
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <AppHeader onBack={handleBack} trailing={`Hi, ${name}!`} onLogout={handleLogout} />
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
        <AppHeader onBack={handleBack} trailing={`Hi, ${name}!`} onLogout={handleLogout} />
        <p className="text-slate-600 mt-8">Could not start this test.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader onBack={handleBack} trailing={`Hi, ${name}!`} onLogout={handleLogout} />
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-950">{session.title}</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Question {currentSlot} of {sittingCount}
              <span className="text-slate-400 mx-2">·</span>
              {answeredCount}/{sittingCount} answered
            </p>
          </div>
          {remainingSeconds != null ? (
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

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Question navigator
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <button
                key={slot.slot}
                type="button"
                disabled={!slot.assigned}
                onClick={() => goToSlot(slot.slot)}
                className={navigatorClass(slot)}
                title={
                  slot.assigned
                    ? `Question ${slot.slot}`
                    : "Answer earlier questions first"
                }
              >
                {slot.slot}
              </button>
            ))}
          </div>
        </div>

        {question ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-slate-900 font-medium flex-1">{question.prompt}</p>
              <QuestionDifficultyStars stars={slotData?.tier || question.stars} />
            </div>
            <div className="flex flex-col gap-2">
              {(question.choices || []).map((choice) => {
                const isSelected = selected === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={submitting || timeExpired}
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
        ) : (
          <p className="text-slate-500">Loading question…</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <button
            type="button"
            disabled={currentSlot <= 1}
            onClick={() => goToSlot(currentSlot - 1)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            type="button"
            disabled={currentSlot >= sittingCount}
            onClick={() => goToSlot(currentSlot + 1)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Next →
          </button>
          <button
            type="button"
            disabled={!allAnswered || submitting || timeExpired}
            onClick={() => handleSubmit(false)}
            className="ml-auto rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-40 transition"
          >
            {submitting ? "Submitting…" : "Submit test"}
          </button>
        </div>

        {submitError ? <p className="text-red-600 text-sm mt-3">{submitError}</p> : null}
        {!allAnswered ? (
          <p className="text-slate-500 text-xs mt-2">
            Answer all {sittingCount} questions to submit.
          </p>
        ) : null}
      </div>
    </div>
  );
}
