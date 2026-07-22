import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  getWorksheet,
  getWorksheetDraft,
  getWorksheetMyResult,
  getTimedSession,
  lockTimedWorksheet,
  saveWorksheetDraft,
  saveWorksheetContextToBank,
  saveWorksheetQuestionToBank,
  submitResult,
  logout,
} from "../api";
import AppHeader from "../components/AppHeader";
import Drawpad from "../components/Drawpad";
import QuillLoading from "../components/QuillLoading";
import {
  DifficultyStars,
  QuestionDifficultyStars,
} from "../components/DifficultyStars";
import WorksheetPassageContent from "../components/WorksheetPassageContent";
import {
  ScratchpadIcon,
  TextAnswerIcon,
} from "../components/ResponseModeIcons";
import { normalizeSubjectKey } from "../subjectUtils";
import {
  isWorksheetPassageBankReady,
  worksheetPassageToBankPayload,
  worksheetPublishedQuestionToBankPayload,
} from "../worksheetUtils";

function scratchpadsVisibleByDefault(worksheet) {
  if (worksheet?.scratchpad === false) return false;
  return normalizeSubjectKey(worksheet?.subject) !== "data";
}

function isManualEvaluation(worksheet) {
  return worksheet?.evaluation === "manual";
}

function parseStoredAnswer(raw) {
  if (raw == null) {
    return { given: "", mode: "text", scratchpad: "" };
  }
  if (typeof raw === "string") {
    return { given: raw, mode: "text", scratchpad: "" };
  }
  if (typeof raw === "object") {
    const mode = raw.mode === "scratchpad" || raw.response_mode === "scratchpad"
      ? "scratchpad"
      : "text";
    return {
      given: raw.given ?? "",
      mode,
      scratchpad: raw.scratchpad ?? "",
    };
  }
  return { given: "", mode: "text", scratchpad: "" };
}

function buildDraftPayload(questions, answers, responseModes, scratchpadData) {
  const out = {};
  for (const q of questions) {
    out[q.id] = {
      mode: responseModes[q.id] || "text",
      given: answers[q.id] || "",
    };
    if (scratchpadData[q.id]) {
      out[q.id].scratchpad = scratchpadData[q.id];
    }
  }
  return out;
}

function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timedSessionStorageKey(worksheetId) {
  return `quill-timed-session-${worksheetId}`;
}

export default function Worksheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdminPreview = localStorage.getItem("role") === "admin";
  const [worksheet, setWorksheet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [responseModes, setResponseModes] = useState({});
  const [scratchpadData, setScratchpadData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [resultStatus, setResultStatus] = useState(null);
  const [savedAnswers, setSavedAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scratchpadsVisible, setScratchpadsVisible] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [timedLocked, setTimedLocked] = useState(false);
  const [accessLocked, setAccessLocked] = useState(false);
  const [accessLockMessage, setAccessLockMessage] = useState("");
  const [savingToBankQuestionId, setSavingToBankQuestionId] = useState(null);
  const [savingToBankPassageId, setSavingToBankPassageId] = useState(null);
  const [bankNotice, setBankNotice] = useState("");
  const autoSubmitStarted = useRef(false);
  const submittedRef = useRef(false);
  const timedActiveRef = useRef(false);
  const worksheetIdRef = useRef(id);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  useEffect(() => {
    worksheetIdRef.current = id;
  }, [id]);

  useEffect(() => {
    timedActiveRef.current = false;
  }, [id]);

  function leaveWithoutSubmit() {
    sessionStorage.removeItem(timedSessionStorageKey(worksheetIdRef.current));
    if (
      timedActiveRef.current &&
      !submittedRef.current &&
      !isAdminPreview
    ) {
      lockTimedWorksheet(worksheetIdRef.current);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    setAccessLocked(false);
    setAccessLockMessage("");
    autoSubmitStarted.current = false;
    setSubmitting(false);

    async function load() {
      try {
        const data = await getWorksheet(id);
        if (data.is_test) {
          navigate(`/student/tests/${id}`, { replace: true });
          return;
        }
        const existing = !isAdminPreview
          ? await getWorksheetMyResult(id).catch(() => null)
          : null;

        setWorksheet(data);
        setScratchpadsVisible(scratchpadsVisibleByDefault(data));

        const initial = {};
        const initialModes = {};
        const initialScratchpads = {};
        data.questions.forEach((q) => {
          initial[q.id] = "";
          initialModes[q.id] = "text";
          initialScratchpads[q.id] = "";
        });

        if (existing) {
          for (const row of existing.answers || []) {
            const parsed = parseStoredAnswer(row);
            initial[row.question_id] = parsed.given;
            initialModes[row.question_id] = parsed.mode;
            initialScratchpads[row.question_id] = parsed.scratchpad;
          }
          setSubmitted(true);
          setResultStatus(existing.status || "evaluated");
          setSavedAnswers(existing.answers || []);
          if (
            existing.status === "evaluated" &&
            typeof existing.score === "number"
          ) {
            setScore(existing.score);
          }
        } else if (!isAdminPreview) {
          if (data.timed) {
            try {
              const resume =
                sessionStorage.getItem(timedSessionStorageKey(id)) === "1";
              const session = await getTimedSession(id, resume);
              sessionStorage.setItem(timedSessionStorageKey(id), "1");
              timedActiveRef.current = true;
              setRemainingSeconds(session.remaining_seconds);
              if (session.expired) {
                setTimeExpired(true);
              }
            } catch (e) {
              if (e.status === 423) {
                setTimedLocked(true);
              } else {
                throw e;
              }
            }
          } else {
            const draft = await getWorksheetDraft(id).catch(() => null);
            if (draft?.answers) {
              data.questions.forEach((q) => {
                const parsed = parseStoredAnswer(draft.answers[q.id]);
                initial[q.id] = parsed.given;
                initialModes[q.id] = parsed.mode;
                initialScratchpads[q.id] = parsed.scratchpad;
              });
              setDraftSavedAt(draft.saved_at);
            }
          }
        }

        setAnswers(initial);
        setResponseModes(initialModes);
        setScratchpadData(initialScratchpads);
      } catch (e) {
        const msg = e.message || "";
        if (
          e.status === 403 &&
          msg.toLowerCase().includes("test")
        ) {
          navigate(`/student/tests/${id}`, { replace: true });
          return;
        }
        if (e.status === 423 && !isAdminPreview) {
          setAccessLocked(true);
          setAccessLockMessage(
            msg || "This worksheet is locked. Ask your teacher to unlock it.",
          );
        } else {
          setError(msg || "Could not load worksheet.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, isAdminPreview, navigate]);

  const handleSubmit = useCallback(
    async (autoFromTimer = false) => {
      if (!worksheet || submitted || autoSubmitStarted.current || submitting) {
        return;
      }
      autoSubmitStarted.current = true;
      setSubmitting(true);
      setSubmitError("");
      const manual = isManualEvaluation(worksheet);

      if (manual) {
        const answers_payload = worksheet.questions.map((q) => {
          const mode = responseModes[q.id] || "text";
          const payload = {
            question_id: q.id,
            prompt: q.prompt,
            given: answers[q.id] || "",
            response_mode: mode,
          };
          if (scratchpadData[q.id]) {
            payload.scratchpad = scratchpadData[q.id];
          }
          return payload;
        });
        try {
          await submitResult({
            worksheet_id: id,
            title: worksheet.title,
            total: worksheet.questions.length,
            answers: answers_payload,
          });
          sessionStorage.removeItem(timedSessionStorageKey(id));
          setSubmitted(true);
          setResultStatus("pending");
          setSavedAnswers(
            answers_payload.map((a) => ({ ...a, correct: null })),
          );
        } catch (e) {
          autoSubmitStarted.current = false;
          setSubmitting(false);
          setSubmitError(e.message || "Failed to submit.");
        }
        return;
      }

      let correct = 0;
      const answers_payload = worksheet.questions.map((q) => {
        const given = (answers[q.id] || "").trim().toLowerCase();
        const expected = (q.answer || "").trim().toLowerCase();
        const isRight = given === expected;
        if (isRight) correct++;
        return {
          question_id: q.id,
          prompt: q.prompt,
          given: answers[q.id],
          correct: isRight,
          expected: q.answer,
          ...(q.area ? { area: q.area } : {}),
        };
      });

      setScore(correct);
      setSubmitted(true);
      setResultStatus("evaluated");

      try {
        await submitResult({
          worksheet_id: id,
          title: worksheet.title,
          score: correct,
          total: worksheet.questions.length,
          answers: answers_payload,
        });
        sessionStorage.removeItem(timedSessionStorageKey(id));
      } catch (e) {
        autoSubmitStarted.current = false;
        setSubmitting(false);
        setSubmitted(false);
        setResultStatus(null);
        setScore(null);
        setSubmitError(e.message || "Failed to submit.");
      }
    },
    [answers, id, responseModes, scratchpadData, submitted, submitting, worksheet],
  );

  useEffect(() => {
    if (
      !loading &&
      worksheet &&
      timeExpired &&
      !submitted &&
      !isAdminPreview &&
      !autoSubmitStarted.current
    ) {
      handleSubmit(true);
    }
  }, [loading, worksheet, timeExpired, submitted, isAdminPreview, handleSubmit]);

  useEffect(() => {
    if (
      submitted ||
      remainingSeconds === null ||
      remainingSeconds <= 0 ||
      isAdminPreview
    ) {
      return;
    }
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (prev !== null && prev <= 1 && !autoSubmitStarted.current) {
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted, remainingSeconds, isAdminPreview, handleSubmit]);

  function handleAnswerChange(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setDraftMessage("");
  }

  function handleResponseModeChange(questionId, mode) {
    setResponseModes((prev) => ({ ...prev, [questionId]: mode }));
    setDraftMessage("");
  }

  function handleScratchpadChange(questionId, dataUrl) {
    setScratchpadData((prev) => ({ ...prev, [questionId]: dataUrl }));
    setDraftMessage("");
  }

  async function handleSaveDraft(exitAfter = false) {
    if (!worksheet || worksheet.timed || submitted || isAdminPreview) return;
    setSavingDraft(true);
    setDraftMessage("");
    try {
      const payload = buildDraftPayload(
        worksheet.questions,
        answers,
        responseModes,
        scratchpadData,
      );
      const result = await saveWorksheetDraft(id, payload);
      setDraftSavedAt(result.saved_at);
      setDraftMessage("Progress saved.");
      if (exitAfter) navigate(-1);
    } catch (e) {
      setDraftMessage(e.message || "Could not save progress.");
    } finally {
      setSavingDraft(false);
    }
  }

  function savedRow(questionId) {
    return savedAnswers.find((a) => a.question_id === questionId);
  }

  function isAutoCorrect(question) {
    return (
      (answers[question.id] || "").trim().toLowerCase() ===
      (question.answer || "").trim().toLowerCase()
    );
  }

  function questionBorderClass(q) {
    if (!submitted) return "border-slate-200";
    if (isManualEvaluation(worksheet)) {
      if (resultStatus === "pending") return "border-slate-200";
      const row = savedRow(q.id);
      if (row?.correct) return "border-green-300";
      if (row?.correct === false) return "border-red-300";
      return "border-slate-200";
    }
    return isAutoCorrect(q) ? "border-green-300" : "border-red-300";
  }

  function renderResponseModeToggle(q, locked) {
    const mode = responseModes[q.id] || "text";
    const baseBtn =
      "inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 transition disabled:opacity-40 disabled:pointer-events-none";
    const active = "bg-indigo-100 text-indigo-900 border-indigo-300";
    const idle =
      "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-800";

    return (
      <div className="flex flex-col gap-2 shrink-0" role="group" aria-label="Answer mode">
        <button
          type="button"
          disabled={locked}
          onClick={() => handleResponseModeChange(q.id, "text")}
          title="Type answer"
          aria-label="Type answer"
          aria-pressed={mode === "text"}
          className={`${baseBtn} ${mode === "text" ? active : idle}`}
        >
          <TextAnswerIcon />
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => handleResponseModeChange(q.id, "scratchpad")}
          title="Use scratchpad"
          aria-label="Use scratchpad"
          aria-pressed={mode === "scratchpad"}
          className={`${baseBtn} ${mode === "scratchpad" ? active : idle}`}
        >
          <ScratchpadIcon />
        </button>
      </div>
    );
  }

  function renderInput(q) {
    const locked = submitted || isAdminPreview;
    const manual = isManualEvaluation(worksheet);

    if (q.type === "multiple_choice") {
      return (
        <div className="flex flex-col gap-2 mt-3">
          {q.choices.map((choice) => {
            const isSelected = answers[q.id] === choice;
            const isChoiceCorrect =
              choice.trim().toLowerCase() ===
              (q.answer || "").trim().toLowerCase();

            let choiceStyle = "border-slate-200 text-slate-800";
            if (submitted && !isManualEvaluation(worksheet)) {
              if (isChoiceCorrect)
                choiceStyle = "border-green-400 bg-green-50 text-green-800";
              else if (isSelected && !isChoiceCorrect)
                choiceStyle = "border-red-400 bg-red-50 text-red-800";
              else choiceStyle = "border-slate-100 text-slate-400";
            } else if (isSelected) {
              choiceStyle = "border-indigo-500 bg-slate-50 text-slate-900";
            }

            return (
              <button
                key={choice}
                disabled={locked}
                onClick={() => handleAnswerChange(q.id, choice)}
                className={`border rounded-xl px-4 py-3 text-sm text-left transition ${choiceStyle}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      );
    }

    if (manual) {
      const mode = responseModes[q.id] || "text";

      let answerField;
      if (mode === "scratchpad") {
        if (locked) {
          answerField =
            scratchpadData[q.id] || savedRow(q.id)?.scratchpad ? (
              <img
                src={scratchpadData[q.id] || savedRow(q.id)?.scratchpad}
                alt="Your scratchpad work"
                className="max-w-full rounded-xl border border-slate-200 bg-black"
              />
            ) : (
              <p className="text-sm text-slate-500 italic">
                No scratchpad work saved.
              </p>
            );
        } else {
          answerField = (
            <Drawpad
              key={`scratch-${id}-${q.id}`}
              value={scratchpadData[q.id] || ""}
              onChange={(dataUrl) => handleScratchpadChange(q.id, dataUrl)}
              showHeading={false}
              className="mt-0"
            />
          );
        }
      } else {
        answerField = (
          <textarea
            value={answers[q.id]}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={locked}
            placeholder="Type your answer and show your reasoning..."
            rows={4}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 resize-y min-h-[6rem]"
          />
        );
      }

      return (
        <div className="mt-3 flex items-start gap-3">
          {!locked ? renderResponseModeToggle(q, locked) : null}
          <div className="min-w-0 flex-1">{answerField}</div>
        </div>
      );
    }

    return (
      <textarea
        value={answers[q.id]}
        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
        disabled={locked}
        placeholder="Type your answer and show your reasoning..."
        rows={4}
        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 mt-3 resize-y min-h-[6rem]"
      />
    );
  }

  function isMcqBankReady(question) {
    if (question.type !== "multiple_choice") return false;
    const choices = (question.choices || []).map((c) => String(c || "").trim());
    if (choices.length !== 4 || !choices.every(Boolean)) return false;
    if (new Set(choices).size !== 4) return false;
    return Boolean(String(question.prompt || "").trim() && String(question.answer || "").trim());
  }

  async function handleSaveContextToBank(passage, passageQuestions) {
    if (!worksheet || !isWorksheetPassageBankReady(passage)) return;
    const mcqQuestions = passageQuestions.filter((q) => isMcqBankReady(q));
    if (mcqQuestions.length === 0) return;

    setSavingToBankPassageId(passage.id);
    setBankNotice("");

    try {
      const result = await saveWorksheetContextToBank({
        subject: worksheet.subject,
        stars: Number(mcqQuestions[0]?.stars) || Number(worksheet.difficulty_min) || 2,
        source: "imported",
        passage: worksheetPassageToBankPayload(passage),
        questions: mcqQuestions.map(worksheetPublishedQuestionToBankPayload),
      });

      const created = result.created_count || 0;
      const skipped = result.skipped_duplicate_count || 0;
      const passageNote = result.created_passage ? " Data set added to the bank." : "";
      if (created === 0 && skipped > 0) {
        setBankNotice(`All ${skipped} question${skipped === 1 ? "" : "s"} from this context are already in the question bank.`);
      } else {
        setBankNotice(
          `Saved ${created} question${created === 1 ? "" : "s"} to the question bank.${skipped ? ` ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.` : ""}${passageNote}`,
        );
      }
    } catch (err) {
      setBankNotice(err.message || "Could not save to the question bank.");
    } finally {
      setSavingToBankPassageId(null);
    }
  }

  async function handleSaveQuestionToBank(question) {
    if (!worksheet || !isMcqBankReady(question)) return;

    setSavingToBankQuestionId(question.id);
    setBankNotice("");

    try {
      const result = await saveWorksheetQuestionToBank({
        subject: worksheet.subject,
        stars: Number(question.stars) || Number(worksheet.difficulty_min) || 2,
        source: "imported",
        question: worksheetPublishedQuestionToBankPayload(question),
        passage: null,
      });

      if (result.duplicate) {
        setBankNotice("That question is already in the question bank.");
      } else {
        const passageNote = result.created_passage ? " Passage added to the bank." : "";
        setBankNotice(`Question saved to the question bank.${passageNote}`);
      }
    } catch (err) {
      setBankNotice(err.message || "Could not save question to the bank.");
    } finally {
      setSavingToBankQuestionId(null);
    }
  }

  const renderQuestion = (q, index) => {
    const row = savedRow(q.id);
    const showEvalFeedback =
      isManualEvaluation(worksheet) &&
      resultStatus === "evaluated" &&
      row?.correct === false &&
      row?.expected;

    return (
      <div
        key={q.id}
        className={`bg-white border rounded-2xl p-5 shadow-sm ${questionBorderClass(q)}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-slate-900 font-medium flex-1 whitespace-pre-line">
            {index + 1}. {q.prompt}
          </p>
          <div className="shrink-0 flex items-center gap-2">
            {isAdminPreview && !hasReadingPassages && q.type === "multiple_choice" ? (
              <button
                type="button"
                onClick={() => handleSaveQuestionToBank(q)}
                disabled={!isMcqBankReady(q) || savingToBankQuestionId === q.id}
                title={
                  isMcqBankReady(q)
                    ? "Save to question bank"
                    : "This question is not ready to save to the bank"
                }
                aria-label="Save question to question bank"
                className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
                  isMcqBankReady(q) && savingToBankQuestionId !== q.id
                    ? "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
                    : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                }`}
              >
                {savingToBankQuestionId === q.id ? "…" : "+"}
              </button>
            ) : null}
            <QuestionDifficultyStars stars={q.stars} />
          </div>
        </div>
        {isAdminPreview && q.type === "short_answer" && q.answer ? (
          <p className="text-xs text-slate-500 mb-2">
            Reference answer (admin only):{" "}
            <span className="font-medium text-slate-700">{q.answer}</span>
          </p>
        ) : null}
        {!isManualEvaluation(worksheet) &&
        scratchpadAllowed &&
        scratchpadsVisible ? (
          <Drawpad key={`scratch-${id}-${q.id}`} showHeading={false} />
        ) : null}
        {renderInput(q)}
        {submitted &&
          !isManualEvaluation(worksheet) &&
          !isAutoCorrect(q) && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm">
              <p>
                <span className="text-red-700 font-semibold">Correct answer</span>
                <span className="block mt-0.5 text-slate-900">{q.answer}</span>
              </p>
            </div>
          )}
        {showEvalFeedback ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm">
            <p>
              <span className="text-red-700 font-semibold">Expected answer</span>
              <span className="block mt-0.5 text-slate-900">{row.expected}</span>
            </p>
          </div>
        ) : null}
        {submitted &&
        isManualEvaluation(worksheet) &&
        resultStatus === "evaluated" &&
        row?.correct ? (
          <p className="mt-3 text-sm font-semibold text-green-700">Marked correct</p>
        ) : null}
      </div>
    );
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <QuillLoading fullscreen label="Loading worksheet…" />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-red-500">{error}</div>
    );

  function handleBack() {
    leaveWithoutSubmit();
    navigate(-1);
  }

  async function handleLogoutNav() {
    leaveWithoutSubmit();
    await logout();
    navigate("/");
  }

  if ((timedLocked || accessLocked) && !isAdminPreview) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <AppHeader onBack={handleBack} onLogout={handleLogoutNav} />
        <div className="max-w-lg mx-auto mt-12 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-4xl mb-4" aria-hidden>
            🔒
          </p>
          <h2 className="text-xl font-semibold text-rose-950">Worksheet locked</h2>
          <p className="text-rose-900/80 text-sm mt-3 leading-relaxed">
            {accessLocked
              ? accessLockMessage
              : "You left this timed worksheet before submitting. Ask your teacher to unlock it so you can try again."}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-6 w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-xl transition"
          >
            Back to worksheets
          </button>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    leaveWithoutSubmit();
    await logout();
    navigate("/");
  }

  const passages = Array.isArray(worksheet.passages) ? worksheet.passages : [];
  const hasReadingPassages = passages.length > 0;
  const scratchpadAllowed = worksheet?.scratchpad !== false;
  const manual = isManualEvaluation(worksheet);
  const isTimed = Boolean(worksheet?.timed);
  const canSave = !isTimed && !submitted && !isAdminPreview;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader onBack={handleBack} onLogout={handleLogout} />

      {isAdminPreview && (
        <div className="mb-6 rounded-xl border border-slate-300 bg-slate-100/80 px-4 py-3 text-sm text-slate-900">
          You are viewing this worksheet as an admin (read-only). Students can
          submit answers from their own login.
          {manual ? (
            <span className="block mt-1 text-slate-700">
              This worksheet uses manual evaluation — mark submissions from the
              admin Results page.
            </span>
          ) : null}
          {isTimed ? (
            <span className="block mt-1 text-slate-700">
              Timed worksheet — students cannot save progress.
            </span>
          ) : null}
          <span className="block mt-1 text-slate-700">
            Use <span className="font-semibold">+</span> on a {hasReadingPassages ? "passage or data set" : "multiple-choice question"} to save it to the question bank.
          </span>
        </div>
      )}

      {isAdminPreview && bankNotice ? (
        <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          {bankNotice}{" "}
          <Link to="/admin/question-bank" className="font-semibold underline">
            Open question bank
          </Link>
        </div>
      ) : null}

      {isTimed && !submitted && remainingSeconds !== null && !isAdminPreview ? (
        <div
          className={`sticky top-0 z-10 mb-6 rounded-2xl border px-4 py-3 text-center shadow-sm ${
            remainingSeconds <= 60
              ? "bg-rose-50 border-rose-300"
              : "bg-white border-slate-200"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Time remaining
          </p>
          <p
            className={`text-3xl font-bold tabular-nums mt-1 ${
              remainingSeconds <= 60 ? "text-rose-700" : "text-slate-900"
            }`}
          >
            {formatTimer(remainingSeconds)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Your answers submit automatically when time runs out. Use Back
            before submitting only if you are done — it will lock this worksheet.
          </p>
        </div>
      ) : null}

      <h2 className="text-xl font-semibold text-slate-900 mb-1">
        {worksheet.title}
      </h2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-8">
        <p className="text-indigo-500 capitalize">
          {worksheet.subject} · {worksheet.questions.length} questions
        </p>
        {isTimed && worksheet.time_limit_minutes ? (
          <span className="text-rose-700 text-xs font-semibold rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5">
            Timed · {worksheet.time_limit_minutes} min
          </span>
        ) : null}
        {manual ? (
          <span className="text-amber-700 text-xs font-semibold rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5">
            Written answers · type or scratchpad per question
          </span>
        ) : null}
        <DifficultyStars
          min={worksheet.difficulty_min}
          max={worksheet.difficulty_max}
          size="lg"
        />
      </div>

      {scratchpadAllowed && !manual && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Scratch pads</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Each question has its own space to jot work.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scratchpadsVisible}
              onClick={() => setScratchpadsVisible((v) => !v)}
              className={`relative h-9 w-14 shrink-0 rounded-full transition-colors ${
                scratchpadsVisible ? "bg-indigo-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-1 left-1 block h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  scratchpadsVisible ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {submitted && manual && resultStatus === "pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 text-center">
          <p className="text-amber-950 font-semibold text-lg">
            Submitted — awaiting review
          </p>
        </div>
      )}

      {submitted && (!manual || resultStatus === "evaluated") && score != null && (
        <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 mb-8 text-center">
          <p className="text-slate-900 font-semibold text-lg">
            You got {score} out of {worksheet.questions.length} correct!
          </p>
        </div>
      )}

      {submitError ? (
        <p className="text-red-600 text-sm mb-4">{submitError}</p>
      ) : null}

      <div className="flex flex-col gap-8">
        {hasReadingPassages ? (
          <>
            {passages.map((passage) => {
              const passageQuestions = worksheet.questions.filter(
                (q) => q.passage_id === passage.id,
              );
              const bankReady =
                isWorksheetPassageBankReady(passage) &&
                passageQuestions.some((q) => isMcqBankReady(q));
              const saveToBankButton = isAdminPreview ? (
                <button
                  type="button"
                  onClick={() => handleSaveContextToBank(passage, passageQuestions)}
                  disabled={!bankReady || savingToBankPassageId === passage.id}
                  title={
                    bankReady
                      ? "Save this passage and all its questions to the question bank"
                      : "Complete the passage/data set and its MCQ questions before saving"
                  }
                  aria-label="Save passage to question bank"
                  className={`w-9 h-9 rounded-lg border text-sm font-bold transition ${
                    bankReady && savingToBankPassageId !== passage.id
                      ? "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {savingToBankPassageId === passage.id ? "…" : "+"}
                </button>
              ) : null;

              return (
                <div key={passage.id} className="flex flex-col gap-4">
                  <WorksheetPassageContent
                    passage={passage}
                    headerAction={saveToBankButton}
                  />
                  <div className="flex flex-col gap-4">
                    {passageQuestions.map((q) => {
                      const index = worksheet.questions.indexOf(q);
                      return renderQuestion(q, index);
                    })}
                  </div>
                </div>
              );
            })}
            {worksheet.questions.some((q) => !q.passage_id) ? (
              <div className="flex flex-col gap-4">
                {worksheet.questions
                  .filter((q) => !q.passage_id)
                  .map((q) => {
                    const index = worksheet.questions.indexOf(q);
                    return renderQuestion(q, index);
                  })}
              </div>
            ) : null}
          </>
        ) : (
          worksheet.questions.map((q, index) => renderQuestion(q, index))
        )}
      </div>

      {canSave ? (
        <div className="mt-8 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={savingDraft}
              onClick={() => handleSaveDraft(false)}
              className="flex-1 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 font-semibold py-3 rounded-2xl transition"
            >
              {savingDraft ? "Saving…" : "Save progress"}
            </button>
            <button
              type="button"
              disabled={savingDraft}
              onClick={() => handleSaveDraft(true)}
              className="flex-1 bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-200 disabled:opacity-60 font-semibold py-3 rounded-2xl transition"
            >
              Save & exit
            </button>
          </div>
          {draftSavedAt ? (
            <p className="text-center text-xs text-slate-500">
              Last saved {new Date(draftSavedAt).toLocaleString()}
            </p>
          ) : null}
          {draftMessage ? (
            <p className="text-center text-sm text-slate-700">{draftMessage}</p>
          ) : null}
        </div>
      ) : null}

      {!submitted && !isAdminPreview && (
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="mt-4 w-full bg-indigo-500 hover:bg-slate-600 text-white font-semibold py-4 rounded-2xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit Answers"}
        </button>
      )}

      {submitted && (
        <button
          onClick={() => navigate(-1)}
          className="mt-8 w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-4 rounded-2xl shadow transition"
        >
          Back to Worksheets
        </button>
      )}
    </div>
  );
}
