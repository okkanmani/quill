import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createWorksheetFromBuilder,
  generateWorksheetDraft,
  getAdminSettings,
  listAdminStudents,
  logout,
} from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import {
  BUILDER_SUBJECTS,
  CHOICE_LABELS,
  GRADE_OPTIONS,
  STARS_OPTIONS,
  builderPayload,
  buildQuestionList,
  defaultQuestionCount,
  draftToBuilderQuestions,
  resizeQuestions,
  validateBuilderForm,
  validateBuilderParamsForAi,
} from "../questionBuilderUtils";

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

function QuestionCard({
  question,
  index,
  format,
  expanded,
  onToggle,
  onChange,
}) {
  const summary =
    question.prompt.trim() ||
    (format === "multiple_choice" ? "Empty multiple choice" : "Empty short answer");
  const complete =
    question.prompt.trim() &&
    (format === "multiple_choice"
      ? question.choices.every((c) => c.trim()) &&
        new Set(question.choices.map((c) => c.trim())).size === 4
      : question.answer.trim());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(index)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition"
      >
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">Question {index + 1}</span>
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
              placeholder="e.g. two-variable algebra, triangle area"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500 leading-relaxed">
              Be specific — use a narrow skill label (not just “algebra” or “geometry”).
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

export default function AdminQuestionBuilder() {
  const navigate = useNavigate();
  const initialGrade = Number(localStorage.getItem("studentGrade")) || 5;
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState(initialGrade);
  const [stars, setStars] = useState(2);
  const [format, setFormat] = useState("multiple_choice");
  const [questionCount, setQuestionCount] = useState(defaultQuestionCount(2));
  const [timed, setTimed] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [questions, setQuestions] = useState(() =>
    buildQuestionList(defaultQuestionCount(2), "multiple_choice"),
  );
  const [expanded, setExpanded] = useState(() => new Set([0]));
  const [buildUsingAi, setBuildUsingAi] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const recommendedCount = useMemo(() => defaultQuestionCount(stars), [stars]);
  const countMismatch = questionCount !== recommendedCount;

  function updateQuestion(index, patch) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function handleStarsChange(nextStars) {
    setStars(nextStars);
    const nextCount = defaultQuestionCount(nextStars);
    setQuestionCount(nextCount);
    setQuestions((prev) => resizeQuestions(prev, nextCount, format));
  }

  function handleFormatChange(nextFormat) {
    setFormat(nextFormat);
    if (nextFormat === "short_answer") setSubject("math");
    setQuestions(buildQuestionList(questionCount, nextFormat));
    setExpanded(new Set([0]));
  }

  function handleQuestionCountChange(raw) {
    const n = Math.max(1, Math.min(50, Number(raw) || 1));
    setQuestionCount(n);
    setQuestions((prev) => resizeQuestions(prev, n, format));
  }

  function toggleExpanded(index) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handlePublish() {
    setError("");
    setSuccess("");

    if (buildUsingAi) {
      const paramErrors = validateBuilderParamsForAi({
        subject,
        format,
        timed,
        timeLimitMinutes,
        questionCount,
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

      if (buildUsingAi) {
        setPublishPhase("Generating with AI…");
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

      setPublishPhase("Publishing…");
      const result = await createWorksheetFromBuilder(
        builderPayload({
          title: publishTitle,
          subject,
          stars,
          format,
          questionCount,
          timed,
          timeLimitMinutes,
          questions: publishQuestions,
        }),
      );
      setSuccess(
        buildUsingAi
          ? `AI generated and published ${result.id} — “${result.title}” (${result.question_count} questions).`
          : `Published ${result.id} — “${result.title}” (${result.question_count} questions).`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Could not publish worksheet.");
    } finally {
      setPublishing(false);
      setPublishPhase("");
    }
  }

  const canPublishWithAi = aiEnabled && apiKeyConfigured;
  const publishLabel = publishing
    ? publishPhase || "Publishing…"
    : buildUsingAi
      ? "Generate & publish"
      : "Publish worksheet";

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
      mainClassName="pb-28"
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            to="/admin/worksheets"
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            ← Back to worksheets
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-950 mb-1">Question builder</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Create a worksheet without JSON. Mark the correct MCQ answer with ✓ —
          choices are shuffled on publish.
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
          <h2 className="font-bold text-slate-900">Worksheet details</h2>

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
                onChange={(e) => setSubject(e.target.value)}
                disabled={format === "short_answer"}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-100"
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
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/50">
                <input
                  type="radio"
                  name="format"
                  checked={format === "short_answer"}
                  onChange={() => handleFormatChange("short_answer")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Short answer
                  </span>
                  <span className="block text-xs text-slate-600">
                    Manual grading · math only
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <label className="block text-sm font-semibold text-slate-800">
              Number of questions
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => handleQuestionCountChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              {countMismatch ? (
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
          </div>
        </section>

        {buildUsingAi ? (
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 mb-6">
            <h2 className="font-bold text-indigo-950 mb-2">AI generation</h2>
            <p className="text-sm text-indigo-900 leading-relaxed">
              Questions will be generated from the worksheet details above when you
              press Generate &amp; publish. Each question gets a specific area tag
              for focus analysis. Usage bills to your OpenAI account.
            </p>
            <label className="block mt-4 text-sm font-semibold text-indigo-950">
              Additional instructions{" "}
              <span className="font-normal text-indigo-800">(optional)</span>
              <textarea
                value={aiCustomPrompt}
                onChange={(e) => setAiCustomPrompt(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="e.g. Focus on word problems about money, use Canadian spelling, avoid decimals…"
                className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y min-h-[6rem]"
              />
            </label>
            <p className="text-xs text-indigo-800/80 mt-1">
              These notes are sent to the AI along with subject, grade, and difficulty.
            </p>
            {!canPublishWithAi ? (
              <p className="text-sm text-amber-900 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                {!aiEnabled ? (
                  "AI generation is disabled on this server."
                ) : (
                  <>
                    Add your OpenAI API key under{" "}
                    <Link to="/admin/settings" className="font-semibold underline">
                      Admin → Settings
                    </Link>{" "}
                    before publishing.
                  </>
                )}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="font-bold text-slate-900 px-1">
              Questions ({questions.length})
            </h2>
            {questions.map((q, i) => (
              <QuestionCard
                key={i}
                question={q}
                index={i}
                format={format}
                expanded={expanded.has(i)}
                onToggle={toggleExpanded}
                onChange={updateQuestion}
              />
            ))}
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 md:left-52 border-t border-slate-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {buildUsingAi ? (
            <p className="text-sm text-slate-600">
              AI will write {questionCount} {format === "multiple_choice" ? "multiple-choice" : "short-answer"} questions
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              {questions.filter((q) => q.prompt.trim()).length}/{questions.length}{" "}
              prompts filled
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <label
              className={`flex items-center gap-2 text-sm font-semibold ${
                aiEnabled ? "text-slate-800 cursor-pointer" : "text-slate-500"
              }`}
            >
              <input
                type="checkbox"
                checked={buildUsingAi}
                onChange={(e) => setBuildUsingAi(e.target.checked)}
                disabled={!aiEnabled}
                className="rounded border-slate-300"
              />
              Build using AI
            </label>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || (buildUsingAi && !aiEnabled)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-6 py-3 transition"
            >
              {publishLabel}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
