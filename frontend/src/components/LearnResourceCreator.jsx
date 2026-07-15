import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { generateAndPublishLearnResource, getAdminSettings } from "../api";
import { BUILDER_SUBJECTS, GRADE_OPTIONS } from "../questionBuilderUtils";

export default function LearnResourceCreator() {
  const initialGrade = Number(localStorage.getItem("studentGrade")) || 5;
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState(initialGrade);
  const [curriculum, setCurriculum] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setAiEnabled(Boolean(data.ai_enabled));
        setApiKeyConfigured(Boolean(data.openai_key_configured));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setError("");
    setSuccess(null);

    if (!curriculum.trim()) {
      setError("Curriculum is required (e.g. NCERT, Ontario, Common Core).");
      return;
    }
    if (!sectionTitle.trim()) {
      setError("Topic is required — what should this resource cover?");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateAndPublishLearnResource({
        subject,
        grade,
        curriculum: curriculum.trim(),
        section_title: sectionTitle.trim(),
        custom_prompt: customPrompt.trim(),
      });
      setSuccess(result);
      setSectionTitle("");
      setCustomPrompt("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Could not generate learning resource.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  if (!apiKeyConfigured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 max-w-xl">
        <h2 className="font-bold text-amber-950 mb-2">OpenAI API key required</h2>
        <p className="text-sm text-amber-900 leading-relaxed mb-4">
          The learning resource creator is AI-only. Add your OpenAI API key under
          Settings before generating content. Usage bills to your OpenAI account.
        </p>
        <Link
          to="/admin/settings"
          className="inline-flex rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 transition"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  if (!aiEnabled) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 max-w-xl">
        <h2 className="font-bold text-slate-900 mb-2">AI disabled</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          AI generation is turned off on this server. Contact whoever runs this
          deployment to enable it.
        </p>
      </div>
    );
  }

  const learnLink = success
    ? `/student/learn/${success.subject_key}#${success.section_id}`
    : null;

  return (
    <>
      <p className="text-slate-600 text-sm mb-6 leading-relaxed">
        Generate a student-facing learning resource with AI and publish it to
        Learning Resources. Pick grade, subject, and curriculum — content is
        grouped into a collection for that combination.
      </p>

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Published “{success.title}”.{" "}
          <Link to={learnLink} className="font-semibold underline">
            View in Learning Resources
          </Link>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-xl">
        <h2 className="font-bold text-slate-900">Resource details</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm font-semibold text-slate-800">
            Subject
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {BUILDER_SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Grade
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
          Curriculum
          <input
            type="text"
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value)}
            placeholder="e.g. NCERT, Ontario, Common Core"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Resources for the same subject, grade, and curriculum appear in one
            collection.
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Topic
          <input
            type="text"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            placeholder="e.g. Fractions — adding unlike denominators"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Additional instructions{" "}
          <span className="font-normal text-slate-500">(optional)</span>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. Include two worked examples, use metric units, keep vocabulary simple…"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y min-h-[5rem]"
          />
        </label>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-6 py-3 transition"
        >
          {generating ? "Generating & publishing…" : "Generate & publish"}
        </button>
      </section>
    </>
  );
}
