import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateAndPublishLearnResource,
  getAdminSettings,
  publishLearnResource,
} from "../api";
import LearnMarkdownEditor from "./LearnMarkdownEditor";
import QuillLoading from "./QuillLoading";
import {
  expandPendingLearnImagesInMarkdown,
  markdownHasPendingLearnImages,
} from "../learnImageMarkdown";
import { forgetPendingLearnImagesInMarkdown } from "../learnPendingImages";
import { learnSectionReaderUrl, sectionForReaderUrl } from "../learnTopics";
import { BUILDER_SUBJECTS, GRADE_OPTIONS } from "../questionBuilderUtils";
import {
  CREATE_BODY,
  CREATE_FIELD_LABEL,
  CREATE_PUBLISH_BUTTON,
  CREATE_SECTION_TITLE,
  CREATE_STICKY_ACTION_BAR,
  CREATE_STICKY_ACTION_LINK,
} from "../createTypography";

export default function LearnResourceCreator() {
  const initialGrade = Number(localStorage.getItem("studentGrade")) || 5;

  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState(initialGrade);
  const [curriculum, setCurriculum] = useState("");
  const [topic, setTopic] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [buildUsingAi, setBuildUsingAi] = useState(false);

  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAdminSettings()
      .then((data) => {
        if (cancelled) return;
        setAiEnabled(Boolean(data.ai_enabled));
        setApiKeyConfigured(Boolean(data.openai_key_configured));
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

  const canUseAi = aiEnabled && apiKeyConfigured;

  async function handlePublish() {
    setError("");
    setSuccess(null);

    if (!curriculum.trim()) {
      setError("Curriculum is required (e.g. NCERT, Ontario, Common Core).");
      return;
    }
    if (!sectionTitle.trim()) {
      setError("Sub-topic is required.");
      return;
    }

    if (!buildUsingAi && !markdown.trim()) {
      setError("Content is required.");
      return;
    }

    setPublishing(true);
    try {
      const markdownForPublish = expandPendingLearnImagesInMarkdown(markdown.trim());
      const result = buildUsingAi
        ? await generateAndPublishLearnResource({
            subject,
            grade,
            curriculum: curriculum.trim(),
            section_title: sectionTitle.trim(),
            topic: topic.trim(),
            custom_prompt: customPrompt.trim(),
          })
        : await publishLearnResource({
            subject,
            grade,
            curriculum: curriculum.trim(),
            section_title: sectionTitle.trim(),
            topic: topic.trim(),
            markdown: markdownForPublish,
          });

      setSuccess({ ...result, published_topic: topic.trim() });
      forgetPendingLearnImagesInMarkdown(markdown);
      setTopic("");
      setSectionTitle("");
      setMarkdown("");
      setCustomPrompt("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err.message ||
          (buildUsingAi
            ? "Could not generate learning resource."
            : "Could not publish learning resource."),
      );
    } finally {
      setPublishing(false);
    }
  }

  if (settingsLoading) {
    return <QuillLoading page label="Loading learning resource builder…" />;
  }

  const learnLink = success
    ? learnSectionReaderUrl(
        sectionForReaderUrl(
          success.subject_key,
          success.section_id,
          success.published_topic,
        ),
      )
    : null;

  const publishLabel = publishing
    ? buildUsingAi
      ? "Generating & publishing…"
      : markdownHasPendingLearnImages(markdown)
        ? "Uploading images & publishing…"
        : "Publishing…"
    : buildUsingAi
      ? "Generate & publish"
      : "Publish resource";

  return (
    <div className="min-w-0">
      <p className={`${CREATE_BODY} mb-4`}>
        Publish one learning section at a time — a focused sub-topic students read in one
        sitting. Optional topic groups sections (e.g. Calculus → Limits). Leave topic blank
        to place the section under Miscellaneous. This is not a course generator.
      </p>

      <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950 leading-relaxed">
        <p className="font-semibold">One section = one slice</p>
        <ul className="mt-2 space-y-1 list-disc pl-5 text-teal-900/90">
          <li>
            Collections group by subject, grade, and curriculum; topics organize sections
            inside a collection.
          </li>
          <li>
            Example: topic <span className="font-medium">Calculus</span>, sub-topic{" "}
            <span className="font-medium">Limits — intuitive idea</span>.
          </li>
          <li>Students see topics and sections on the Learn page and in the reader contents.</li>
        </ul>
      </div>

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Published &ldquo;{success.title}&rdquo;.{" "}
          <Link to={learnLink} className="font-semibold underline">
            View in Learning Resources
          </Link>
          {!buildUsingAi ? (
            <>
              {" "}
              &middot;{" "}
              <Link
                to={`/admin/create/learn/edit/${success.subject_key}/${success.section_id}`}
                className="font-semibold underline"
              >
                Continue editing
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className={CREATE_SECTION_TITLE}>Resource details</h2>
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

        <label className={CREATE_FIELD_LABEL}>
          Topic{" "}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Calculus"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Groups related sections. If empty, this section goes under Miscellaneous.
          </span>
        </label>

        <label className={CREATE_FIELD_LABEL}>
          Sub-topic{" "}
          <span className="font-normal text-slate-500">(required)</span>
          <input
            type="text"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            placeholder="e.g. Limits — intuitive idea of getting closer"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Shown as the section heading — one focused slice, not a whole course.
          </span>
        </label>

        {buildUsingAi ? (
          <p className="text-sm text-indigo-950 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 leading-relaxed">
            AI writes one section (~500–800 words) for the sub-topic only. Naming the topic
            and sub-topic yourself gives the best results.
          </p>
        ) : null}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className={CREATE_FIELD_LABEL}>
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

          <label className={CREATE_FIELD_LABEL}>
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

          <label className={`${CREATE_FIELD_LABEL} sm:col-span-2 lg:col-span-1`}>
            Curriculum
            <input
              type="text"
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              placeholder="e.g. NCERT, Ontario, Common Core"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>

        {buildUsingAi ? (
          <label className={CREATE_FIELD_LABEL}>
            AI instructions{" "}
            <span className="font-normal text-slate-500">(optional)</span>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Include two worked examples, use metric units…"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm resize-y min-h-[4.5rem] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6 space-y-4">
        <h2 className={CREATE_SECTION_TITLE}>Content</h2>
        {buildUsingAi ? (
          <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
            Use &ldquo;Generate &amp; publish&rdquo; to create content with AI from the
            details above.
          </p>
        ) : (
          <LearnMarkdownEditor
            title={sectionTitle}
            markdown={markdown}
            onTitleChange={setSectionTitle}
            onMarkdownChange={setMarkdown}
            hideTitle
            embedded
            borderless
          />
        )}
      </section>

      <div className={CREATE_STICKY_ACTION_BAR}>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || (buildUsingAi && !canUseAi)}
          className={CREATE_PUBLISH_BUTTON}
        >
          {publishLabel}
        </button>
        <Link
          to="/student/learn"
          className={CREATE_STICKY_ACTION_LINK}
        >
          View learning resources →
        </Link>
      </div>
    </div>
  );
}
