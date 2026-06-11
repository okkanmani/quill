import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWorksheet, submitResult, logout } from "../api";
import AppHeader from "../components/AppHeader";
import Drawpad from "../components/Drawpad";
import {
  DifficultyStars,
  QuestionDifficultyStars,
} from "../components/DifficultyStars";

export default function Worksheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdminPreview = localStorage.getItem("role") === "admin";
  const [worksheet, setWorksheet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scratchpadsVisible, setScratchpadsVisible] = useState(true);

  useEffect(() => {
    setScratchpadsVisible(true);
    setLoading(true);
    getWorksheet(id)
      .then((data) => {
        setWorksheet(data);
        const initial = {};
        data.questions.forEach((q) => (initial[q.id] = ""));
        setAnswers(initial);
      })
      .catch(() => setError("Could not load worksheet."))
      .finally(() => setLoading(false));
  }, [id]);

  function handleAnswerChange(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    let correct = 0;
    const answers_payload = worksheet.questions.map((q) => {
      const given = answers[q.id].trim().toLowerCase();
      const expected = q.answer.trim().toLowerCase();
      const isRight = given === expected;
      if (isRight) correct++;
      return {
        question_id: q.id,
        prompt: q.prompt,
        given: answers[q.id],
        correct: isRight,
        expected: q.answer,
      };
    });

    setScore(correct);
    setSubmitted(true);

    try {
      await submitResult({
        worksheet_id: id,
        title: worksheet.title,
        score: correct,
        total: worksheet.questions.length,
        answers: answers_payload,
      });
    } catch {
      console.error("Failed to save result — will retry on next submit");
    }
  }

  function isCorrect(question) {
    return (
      answers[question.id].trim().toLowerCase() ===
      question.answer.trim().toLowerCase()
    );
  }

  const renderQuestion = (q, index) => {
    return (
      <div
        key={q.id}
        className={`bg-white border rounded-2xl p-5 shadow-sm ${
          submitted
            ? isCorrect(q)
              ? "border-green-300"
              : "border-red-300"
            : "border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-slate-900 font-medium flex-1">
            {index + 1}. {q.prompt}
          </p>
          <QuestionDifficultyStars stars={q.stars} />
        </div>
        {scratchpadAllowed && scratchpadsVisible && (
          <Drawpad key={`scratch-${id}-${q.id}`} showHeading={false} />
        )}
        {renderInput(q)}
        {submitted && !isCorrect(q) && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm space-y-2">
            <p className="text-slate-900">
              <span className="text-red-700 font-semibold">Question</span>
              <span className="block mt-0.5">{q.prompt}</span>
            </p>
            <p>
              <span className="text-red-700 font-semibold">Correct answer</span>
              <span className="block mt-0.5 text-slate-900">{q.answer}</span>
            </p>
          </div>
        )}
      </div>
    );
  };

  function renderInput(q) {
    if (q.type === "multiple_choice") {
      return (
        <div className="flex flex-col gap-2 mt-3">
          {q.choices.map((choice) => {
            const isSelected = answers[q.id] === choice;
            const isChoiceCorrect =
              choice.trim().toLowerCase() === q.answer.trim().toLowerCase();

            let choiceStyle = "border-slate-200 text-slate-800";
            if (submitted) {
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
                disabled={submitted || isAdminPreview}
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

    return (
      <input
        type="text"
        value={answers[q.id]}
        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
        disabled={submitted || isAdminPreview}
        placeholder="Your answer..."
        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
      />
    );
  }

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-600">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-red-500">{error}</div>
    );

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const passages = Array.isArray(worksheet.passages) ? worksheet.passages : [];
  const hasReadingPassages = passages.length > 0;
  const scratchpadAllowed = worksheet?.scratchpad !== false;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

      {isAdminPreview && (
        <div className="mb-6 rounded-xl border border-slate-300 bg-slate-100/80 px-4 py-3 text-sm text-slate-900">
          You are viewing this worksheet as an admin (read-only). Students can
          submit answers from their own login.
        </div>
      )}

      {/* Worksheet title */}
      <h2 className="text-xl font-semibold text-slate-900 mb-1">
        {worksheet.title}
      </h2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-8">
        <p className="text-indigo-500 capitalize">
          {worksheet.subject} · {worksheet.questions.length} questions
        </p>
        <DifficultyStars
          min={worksheet.difficulty_min}
          max={worksheet.difficulty_max}
          size="lg"
        />
      </div>

      {scratchpadAllowed && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Scratch pads</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Each question has its own space to jot work. Toggle off to hide all
                of them at once.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scratchpadsVisible}
              aria-label={
                scratchpadsVisible
                  ? "Hide scratch pads below every question"
                  : "Show scratch pads below every question"
              }
              onClick={() => setScratchpadsVisible((v) => !v)}
              className={`relative h-9 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                scratchpadsVisible ? "bg-indigo-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-1 left-1 block h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  scratchpadsVisible ? "translate-x-5" : "translate-x-0"
                }`}
                aria-hidden
              />
            </button>
          </div>
        </div>
      )}

      {/* Score banner */}
      {submitted && (
        <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 mb-8 text-center">
          <p className="text-slate-900 font-semibold text-lg">
            You got {score} out of {worksheet.questions.length} correct!
          </p>
        </div>
      )}

      {/* Questions: exactly one layout — reading (passages + optional CR) OR flat list */}
      <div className="flex flex-col gap-8">
        {hasReadingPassages ? (
          <>
            {passages.map((passage) => {
              const passageQuestions = worksheet.questions.filter(
                (q) => q.passage_id === passage.id,
              );
              return (
                <div key={passage.id} className="flex flex-col gap-4">
                  <div className="sticky top-4 z-10 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-slate-800 font-semibold text-base mb-3">
                      📖 {passage.title}
                    </p>
                    <p className="text-slate-900 text-sm leading-relaxed whitespace-pre-line">
                      {passage.body}
                    </p>
                  </div>
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
                <div>
                  <p className="text-slate-700 font-semibold text-base">
                    🧠 Critical Reasoning
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Use what you have read and your own reasoning to answer
                    these questions.
                  </p>
                </div>
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

      {/* Submit button */}
      {!submitted && !isAdminPreview && (
        <button
          onClick={handleSubmit}
          className="mt-8 w-full bg-indigo-500 hover:bg-slate-600 text-white font-semibold py-4 rounded-2xl shadow transition"
        >
          Submit Answers
        </button>
      )}

      {/* Back button after submit */}
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
