import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { generateTestDraft, getAdminSettings } from "../api";
import QuillLoading from "./QuillLoading";
import { QuestionDifficultyStars } from "./DifficultyStars";
import {
  BUILDER_SUBJECTS,
  CHOICE_LABELS,
  DEFAULT_SITTING_COUNT,
  DEFAULT_TIME_LIMIT_MINUTES,
  GRADE_OPTIONS,
  MAX_SITTING_COUNT,
  MIN_SITTING_COUNT,
  TEST_TIERS,
  buildTestBuilderPreview,
  countQuestionsByTier,
  draftToTestBuilderQuestions,
  emptyTestQuestion,
  isTestQuestionComplete,
  minimumBankSize,
  validateTestBuilder,
} from "../testBuilderUtils";

function TierBankStatus({ sittingCount, tierCounts, adaptive }) {
  if (!adaptive) {
    const total = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);
    const ready = total >= sittingCount;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Fixed-order bank</p>
        <p className="text-xs text-slate-600 mt-1">
          Tier labels still affect scoring weight. You need {sittingCount} questions total.
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

function TestQuestionCard({ question, index, expanded, onToggle, onChange, onRemove }) {
  const complete = isTestQuestionComplete(question);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition"
      >
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">Question {index + 1}</span>
          <span className="block text-sm text-slate-600 truncate mt-0.5">
            {question.prompt.trim() || "No prompt yet"}
            {" · "}
            {TEST_TIERS.find((tier) => tier.value === Number(question.tier))?.shortLabel}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-2">
          <QuestionDifficultyStars stars={question.tier} />
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
        <div className="p-4 border-t border-slate-100 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-slate-800">
              Difficulty tier
              <select
                value={question.tier}
                onChange={(e) => onChange({ tier: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {TEST_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label} ({tier.weight})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              Topic area <span className="font-normal text-slate-500">(optional)</span>
              <input
                type="text"
                value={question.area}
                onChange={(e) => onChange({ area: e.target.value })}
                placeholder="e.g. fractions, algebra"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-800">
            Prompt
            <textarea
              value={question.prompt}
              onChange={(e) => onChange({ prompt: e.target.value })}
              rows={3}
              placeholder="What should the student answer?"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm resize-y min-h-[4.5rem]"
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              Choices — mark the correct answer
            </p>
            {CHOICE_LABELS.map((label, choiceIndex) => {
              const selected = Number(question.correctIndex) === choiceIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ correctIndex: choiceIndex })}
                    className={`shrink-0 w-9 h-9 rounded-full border text-sm font-bold transition ${
                      selected
                        ? "bg-teal-600 border-teal-700 text-white"
                        : "bg-white border-slate-300 text-slate-500 hover:border-teal-400"
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
                      onChange({ choices: next });
                    }}
                    placeholder={`Choice ${label}`}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="text-sm font-semibold text-red-700 hover:text-red-900"
            >
              Remove question
            </button>
          </div>
        </div>
      ) : null}
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
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(DEFAULT_TIME_LIMIT_MINUTES);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [buildUsingAi, setBuildUsingAi] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lockOnPublish, setLockOnPublish] = useState(true);
  const [questions, setQuestions] = useState(() => [
    emptyTestQuestion(1),
    emptyTestQuestion(2),
    emptyTestQuestion(3),
  ]);
  const [activeTierFilter, setActiveTierFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState("");

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

  const canUseAi = aiEnabled && apiKeyConfigured && !editId;
  const tierCounts = useMemo(() => countQuestionsByTier(questions), [questions]);
  const bankMinimum = minimumBankSize(sittingCount, adaptiveEnabled);

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
        adaptive: adaptiveEnabled,
      }),
    [title, subject, sittingCount, timeLimitMinutes, questions, adaptiveEnabled],
  );

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

  function addQuestion(tier = 2) {
    const question = emptyTestQuestion(tier);
    setQuestions((prev) => [...prev, question]);
    setExpandedIds((prev) => new Set(prev).add(question.id));
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
    });
    setErrors(nextErrors);
    setNotice(
      nextErrors.length === 0
        ? "Validation passed. Publish API wiring is next — this skeleton stops here for now."
        : "",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      });
      const generated = draftToTestBuilderQuestions(draft);
      if (!title.trim() && draft.title) {
        setTitle(draft.title);
      }
      setQuestions(generated);
      setExpandedIds(new Set(generated.slice(0, 3).map((question) => question.id)));
      setNotice(
        `Generated ${generated.length} questions. Review and edit below before publishing.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors([err.message || "Could not generate test questions."]);
    } finally {
      setGenerating(false);
    }
  }

  if (settingsLoading) {
    return <QuillLoading label="Loading test builder…" />;
  }

  return (
    <div className="min-w-0">
      <p className="text-slate-600 text-sm mb-4 leading-relaxed">
        {editId
          ? `Editing ${editId}. Loading existing tests is not wired yet — this is the builder skeleton.`
          : adaptiveEnabled
            ? "Build an adaptive timed test. Students answer one sitting; difficulty adjusts by tier after each question."
            : "Build a fixed-order timed test. All questions are assigned at the start — tier labels affect scoring weight only."}
      </p>

      <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950 leading-relaxed">
        <p className="font-semibold">
          {adaptiveEnabled ? "How adaptive tests work" : "How fixed-order tests work"}
        </p>
        <ul className="mt-2 space-y-1 list-disc pl-5 text-teal-900/90">
          {adaptiveEnabled ? (
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
              <li>Difficulty does not change mid-test based on answers.</li>
              <li>Scoring is still weighted by each question&apos;s tier.</li>
              <li>You need at least {sittingCount} questions total in the bank.</li>
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
              onChange={(e) => setSubject(e.target.value)}
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
            Sitting size
            <input
              type="number"
              min={MIN_SITTING_COUNT}
              max={MAX_SITTING_COUNT}
              value={sittingCount}
              onChange={(e) => setSittingCount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Questions per attempt ({MIN_SITTING_COUNT}–{MAX_SITTING_COUNT})
            </span>
          </label>

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
              ? "tier changes after each answer"
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Question bank</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {adaptiveEnabled
                ? `Add at least ${sittingCount} questions per tier (${bankMinimum} total minimum).`
                : `Add at least ${bankMinimum} questions for one sitting.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          disabled
          className="rounded-xl bg-slate-200 text-slate-500 text-sm font-bold px-5 py-2.5 cursor-not-allowed"
          title="Publish API wiring comes next"
        >
          Publish test
        </button>
        <p className="text-xs text-slate-500">
          Skeleton only — publish and edit-load will connect to the API next.
        </p>
        <Link
          to="/admin/worksheets"
          className="ml-auto text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          View worksheets →
        </Link>
      </div>
    </div>
  );
}
