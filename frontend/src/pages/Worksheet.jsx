import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWorksheet, submitResult } from "../api";
import Drawpad from "../components/Drawpad";

export default function Worksheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worksheet, setWorksheet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
            : "border-amber-200"
        }`}
      >
        <p className="text-amber-900 font-medium mb-3">
          {index + 1}. {q.prompt}
        </p>
        {showScratchpad && <Drawpad />}
        {renderInput(q)}
        {submitted && !isCorrect(q) && q.type !== "multiple_choice" && (
          <p className="text-red-500 text-sm mt-2">
            Correct answer: {q.answer}
          </p>
        )}
      </div>
    );
  };

  const showScratchpad = worksheet?.scratchpad !== false;

  function renderInput(q) {
    if (q.type === "multiple_choice") {
      return (
        <div className="flex flex-col gap-2 mt-3">
          {q.choices.map((choice) => {
            const isSelected = answers[q.id] === choice;
            const isChoiceCorrect =
              choice.trim().toLowerCase() === q.answer.trim().toLowerCase();

            let choiceStyle = "border-amber-200 text-amber-800";
            if (submitted) {
              if (isChoiceCorrect)
                choiceStyle = "border-green-400 bg-green-50 text-green-800";
              else if (isSelected && !isChoiceCorrect)
                choiceStyle = "border-red-400 bg-red-50 text-red-800";
              else choiceStyle = "border-amber-100 text-amber-400";
            } else if (isSelected) {
              choiceStyle = "border-amber-500 bg-amber-50 text-amber-900";
            }

            return (
              <button
                key={choice}
                disabled={submitted}
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
        disabled={submitted}
        placeholder="Your answer..."
        className="w-full border border-amber-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-amber-50"
      />
    );
  }

  if (loading)
    return (
      <div className="min-h-screen bg-amber-50 p-6 text-amber-600">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-amber-50 p-6 text-red-500">{error}</div>
    );

  const passages = Array.isArray(worksheet.passages) ? worksheet.passages : [];
  const hasReadingPassages = passages.length > 0;

  return (
    <div className="min-h-screen bg-amber-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-amber-800">🪶 Quill</h1>
        <button
          onClick={() => navigate(-1)}
          className="text-amber-600 text-sm underline"
        >
          ← Back
        </button>
      </div>

      {/* Worksheet title */}
      <h2 className="text-xl font-semibold text-amber-900 mb-1">
        {worksheet.title}
      </h2>
      <p className="text-amber-500 text-sm capitalize mb-8">
        {worksheet.subject} · {worksheet.questions.length} questions
      </p>

      {/* Score banner */}
      {submitted && (
        <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4 mb-8 text-center">
          <p className="text-amber-900 font-semibold text-lg">
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
                  <div className="sticky top-4 z-10 bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-amber-800 font-semibold text-base mb-3">
                      📖 {passage.title}
                    </p>
                    <p className="text-amber-900 text-sm leading-relaxed whitespace-pre-line">
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
                  <p className="text-amber-700 font-semibold text-base">
                    🧠 Critical Reasoning
                  </p>
                  <p className="text-amber-400 text-xs mt-1">
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
      {!submitted && (
        <button
          onClick={handleSubmit}
          className="mt-8 w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-4 rounded-2xl shadow transition"
        >
          Submit Answers
        </button>
      )}

      {/* Back button after submit */}
      {submitted && (
        <button
          onClick={() => navigate(-1)}
          className="mt-8 w-full bg-amber-800 hover:bg-amber-900 text-white font-semibold py-4 rounded-2xl shadow transition"
        >
          Back to Worksheets
        </button>
      )}
    </div>
  );
}
