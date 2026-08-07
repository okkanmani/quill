import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  completeTestReview,
  getTestReview,
  logout,
  saveTestReviewNotes,
} from "../api";
import AppShell from "../components/AppShell";
import StatusToast from "../components/StatusToast";
import Drawpad from "../components/Drawpad";
import QuillLoading from "../components/QuillLoading";
import WorksheetPassageContent from "../components/WorksheetPassageContent";
import { QuestionDifficultyStars } from "../components/DifficultyStars";
import { ScratchpadIcon, TextAnswerIcon } from "../components/ResponseModeIcons";
import {
  ICON_ACTION_ACTIVE_CLASS,
  ICON_ACTION_BUTTON_CLASS,
  ICON_ACTION_IDLE_CLASS,
} from "../components/rowActionButtonStyles";
import { useStudentNavLinks } from "../useStudentNavLinks";
import { useAutoDismissToast } from "../useAutoDismissToast";

function NotesModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Notes mode">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("text")}
        aria-pressed={mode === "text"}
        className={`${ICON_ACTION_BUTTON_CLASS} ${
          mode === "text" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
        }`}
      >
        <TextAnswerIcon />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("scratchpad")}
        aria-pressed={mode === "scratchpad"}
        className={`${ICON_ACTION_BUTTON_CLASS} ${
          mode === "scratchpad" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
        }`}
      >
        <ScratchpadIcon />
      </button>
    </div>
  );
}

export default function StudentTestReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { navLinks } = useStudentNavLinks();

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState("");
  useAutoDismissToast(message, setMessage);

  useEffect(() => {
    setLoading(true);
    getTestReview(id)
      .then((data) => {
        setError("");
        setReview(data);
      })
      .catch(() => setError("Could not load review session."))
      .finally(() => setLoading(false));
  }, [id]);

  function updateQuestionNotes(questionId, patch) {
    setReview((prev) => {
      if (!prev) return prev;
      const questions = (prev.questions || []).map((q) => {
        if (String(q.question_id) !== String(questionId)) return q;
        const notes = { ...(q.notes || { mode: "text", text: "", scratchpad: "" }), ...patch };
        return { ...q, notes };
      });
      return { ...prev, questions };
    });
  }

  async function persistNotes(nextReview) {
    setSaving(true);
    try {
      const saved = await saveTestReviewNotes(id, nextReview?.questions || []);
      setReview(saved);
    } catch (err) {
      setError(err.message || "Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkComplete() {
    setCompleting(true);
    setError("");
    try {
      if (review && !review.done) {
        await saveTestReviewNotes(id, review.questions || []);
      }
      const done = await completeTestReview(id);
      setReview((prev) => (prev ? { ...prev, ...done, done: true } : prev));
      setMessage("Review marked complete.");
    } catch (err) {
      setError(err.message || "Could not complete review.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const readOnly = Boolean(review?.done);

  return (
    <AppShell navLinks={navLinks} onLogout={handleLogout}>
      <div className="max-w-3xl">
        <Link
          to="/student/tests"
          className="inline-flex items-center text-sm font-semibold text-teal-700 hover:text-teal-900 mb-4"
        >
          ← Back to Tests
        </Link>

        {loading && <QuillLoading page label="Loading review…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && review ? (
          <>
            <h1 className="text-2xl font-bold text-slate-950 mb-1">{review.title}</h1>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Work through the questions you missed. Add notes or scratchpad work to
              prepare for discussion with your teacher. This is separate from the
              regular Analysis flow.
            </p>

            <div className="flex flex-col gap-5">
              {(review.questions || []).map((q, index) => {
                const notes = q.notes || { mode: "text", text: "", scratchpad: "" };
                const mode = notes.mode === "scratchpad" ? "scratchpad" : "text";
                return (
                  <div
                    key={q.question_id || index}
                    className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"
                  >
                    {q.passage ? (
                      <div className="mb-4">
                        <WorksheetPassageContent passage={q.passage} embedded />
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-medium text-slate-900 flex-1">
                        {index + 1}. {q.prompt}
                      </p>
                      <QuestionDifficultyStars stars={q.tier} />
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm mb-4">
                      <p>
                        <span className="font-semibold text-red-800">Your answer:</span>{" "}
                        {q.given || "—"}
                      </p>
                      <p className="mt-1">
                        <span className="font-semibold text-emerald-800">Correct:</span>{" "}
                        {q.expected}
                      </p>
                    </div>

                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Discussion notes
                    </p>
                    <div className="flex items-start gap-3">
                      {!readOnly ? (
                        <NotesModeToggle
                          mode={mode}
                          disabled={readOnly}
                          onChange={(next) => {
                            updateQuestionNotes(q.question_id, {
                              mode: next,
                            });
                          }}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        {mode === "scratchpad" ? (
                          readOnly && notes.scratchpad ? (
                            <img
                              src={notes.scratchpad}
                              alt="Scratchpad notes"
                              className="max-w-full rounded-xl border border-slate-200"
                            />
                          ) : (
                            <Drawpad
                              value={notes.scratchpad || ""}
                              onChange={(dataUrl) => {
                                updateQuestionNotes(q.question_id, { scratchpad: dataUrl });
                              }}
                              showHeading={false}
                              disabled={readOnly}
                            />
                          )
                        ) : (
                          <textarea
                            value={notes.text || ""}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateQuestionNotes(q.question_id, { text: e.target.value })
                            }
                            rows={4}
                            placeholder="What was tricky? What should you remember for next time?"
                            className="quill-field-textarea w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!readOnly ? (
              <button
                type="button"
                disabled={completing || saving}
                onClick={handleMarkComplete}
                className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition"
              >
                {completing ? "Saving…" : "Mark discussion review complete"}
              </button>
            ) : (
              <p className="mt-6 text-sm font-semibold text-emerald-800">
                Review complete — great work preparing for follow-up.
              </p>
            )}
          </>
        ) : null}
      </div>

      <StatusToast message={message} />
    </AppShell>
  );
}
