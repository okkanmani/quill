import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  abandonCompositeAttempt,
  getCompositeHub,
  logout,
  startCompositeAttempt,
  submitCompositeAttempt,
} from "../api";
import AppShell from "../components/AppShell";
import ContentBadge from "../components/ContentBadge";
import PadlockIcon from "../components/PadlockIcon";
import QuillLoading from "../components/QuillLoading";
import SubjectBadge from "../components/SubjectBadge";
import { LOCK_STATUS_BADGE_CLASS } from "../components/rowActionButtonStyles";
import { formatSubjectLabel } from "../subjectUtils";
import { formatWeightedTestScore } from "../testUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { useStudentNavLinks } from "../useStudentNavLinks";

const SECTION_STATUS = {
  not_started: { label: "Not started", className: "bg-slate-100 text-slate-700 border-slate-200" },
  in_progress: { label: "In progress", className: "bg-sky-100 text-sky-900 border-sky-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  blocked: { label: "Unavailable", className: "bg-amber-100 text-amber-900 border-amber-200" },
};

function sectionAction(section, hub) {
  if (hub.completed_at) return null;
  if (!hub.attempt_id) return null;
  if (section.status === "completed") return null;
  if (section.status === "blocked") {
    return { label: "Unavailable", disabled: true };
  }
  if (section.status === "in_progress") return { label: "Continue", disabled: false };
  return { label: "Start", disabled: false };
}

function SectionRow({ section, hub, onNavigateSection, showScores }) {
  const action = sectionAction(section, hub);
  const statusMeta = SECTION_STATUS[section.status] || SECTION_STATUS.not_started;

  function handleOpen() {
    if (!action || action.disabled) return;
    onNavigateSection(section.worksheet_id);
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-slate-900 font-semibold">{section.title}</p>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SubjectBadge subject={section.subject} />
            {section.time_limit_minutes ? (
              <span className="text-sm text-slate-500">{section.time_limit_minutes} min</span>
            ) : null}
            {showScores && section.status === "completed" && section.weighted_score != null ? (
              <span className="text-sm font-semibold text-teal-900 tabular-nums">
                {formatWeightedTestScore(section.weighted_score, section.max_weighted_score)}
              </span>
            ) : null}
            {showScores && section.status === "completed" && section.duration_seconds != null ? (
              <span className="text-sm text-slate-500">
                {formatDurationSeconds(section.duration_seconds)}
              </span>
            ) : null}
          </div>
          {section.status === "blocked" ? (
            <p className="text-xs text-amber-800 mt-2">
              This section could not be opened for this sitting. Ask your teacher to reset
              the assessment.
            </p>
          ) : null}
        </div>
        {action ? (
          <button
            type="button"
            onClick={handleOpen}
            disabled={action.disabled}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              action.disabled
                ? "border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                : "border border-teal-200 bg-teal-50 text-teal-950 hover:bg-teal-100"
            }`}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function CompositeExitDialog({
  inProgressSectionCount,
  exiting,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composite-exit-title"
      >
        <h2 id="composite-exit-title" className="text-lg font-bold text-slate-950 mb-2">
          Leave this assessment?
        </h2>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          <p>
            Each section is one timed sitting. If you leave now, any section you have
            started will be <strong>auto-submitted</strong> with your current answers and
            scored.
          </p>
          {inProgressSectionCount > 0 ? (
            <p>
              You have <strong>{inProgressSectionCount}</strong> section
              {inProgressSectionCount === 1 ? "" : "s"} in progress that will be submitted
              now.
            </p>
          ) : (
            <p>You have not started a section yet, so nothing will be submitted.</p>
          )}
          <p>
            You can come back later to start sections you have not opened, but you cannot
            redo a section that was auto-submitted.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={exiting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
          >
            Stay on assessment
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={exiting}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 transition disabled:opacity-60"
          >
            {exiting ? "Leaving…" : "Leave assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompositeDisclaimer({ hub, starting, onBack, onContinue }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
      <h2 className="text-xl font-bold text-slate-950 mb-3">Before you begin</h2>
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          This assessment has <strong>{hub.sections.length} timed sections</strong>, one per
          subject. Open each section from this page when you are ready.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Each section has its own timer and must be finished in one sitting.</li>
          <li>
            If you back out of a section or leave this assessment, your work is
            auto-submitted and scored based on whatever you answered.
          </li>
          <li>Scores are hidden until you submit the full assessment from this page.</li>
          <li>After the full assessment is submitted, you can review missed questions per section.</li>
          <li>
            If you already took one of these tests on its own, that result stays on your
            subject tests page. This assessment uses a separate sitting for each section.
          </li>
        </ul>
      </div>

      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Sections in this assessment
        </p>
        <ol className="space-y-2">
          {hub.sections.map((section, index) => (
            <li key={section.worksheet_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-slate-500 tabular-nums w-5">{index + 1}.</span>
              <SubjectBadge subject={section.subject} />
              <span className="text-slate-900 font-medium">{section.title}</span>
              {section.time_limit_minutes ? (
                <span className="text-slate-500">· {section.time_limit_minutes} min</span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={starting}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={starting}
          className="rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 transition"
        >
          {starting ? "Starting…" : "Continue to assessment"}
        </button>
      </div>
    </div>
  );
}

export default function StudentCompositeHub() {
  const { compositeId } = useParams();
  const navigate = useNavigate();
  const { navLinks } = useStudentNavLinks();
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accessLocked, setAccessLocked] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [exiting, setExiting] = useState(false);

  const loadHub = useCallback(async () => {
    setError("");
    setAccessLocked(false);
    const data = await getCompositeHub(compositeId);
    setHub(data);
    return data;
  }, [compositeId]);

  useEffect(() => {
    setLoading(true);
    loadHub()
      .catch((err) => {
        if (err.status === 423) {
          setAccessLocked(true);
        }
        setError(err.message || "Could not load this assessment.");
      })
      .finally(() => setLoading(false));
  }, [loadHub]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleConfirmStart() {
    setStarting(true);
    setActionError("");
    try {
      const data = await startCompositeAttempt(compositeId);
      setHub(data);
      setShowDisclaimer(false);
    } catch (err) {
      setActionError(err.message || "Could not start assessment.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmitComposite() {
    setSubmitting(true);
    setActionError("");
    try {
      const data = await submitCompositeAttempt(compositeId);
      setHub(data);
    } catch (err) {
      setActionError(err.message || "Could not submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  function openSection(worksheetId) {
    if (!hub?.attempt_id) return;
    const params = new URLSearchParams({
      composite_attempt_id: String(hub.attempt_id),
      composite_id: compositeId,
    });
    navigate(`/student/tests/${worksheetId}?${params.toString()}`);
  }

  function handleBackToList() {
    const active = Boolean(hub?.attempt_id && !hub?.completed_at);
    if (active) {
      setShowExitConfirm(true);
      return;
    }
    navigate("/student/tests?tab=composite");
  }

  async function handleConfirmExit() {
    setExiting(true);
    setActionError("");
    try {
      await abandonCompositeAttempt(compositeId);
      navigate("/student/tests?tab=composite");
    } catch (err) {
      setActionError(err.message || "Could not leave assessment.");
      setShowExitConfirm(false);
    } finally {
      setExiting(false);
    }
  }

  const completedCount = hub?.sections?.filter((s) => s.status === "completed").length || 0;
  const inProgressSectionCount =
    hub?.sections?.filter((s) => s.status === "in_progress").length || 0;
  const sectionTotal = hub?.sections?.length || 0;
  const scoresVisible = Boolean(hub?.completed_at);
  const inProgress = Boolean(hub?.attempt_id && !hub?.completed_at);

  return (
    <AppShell navLinks={navLinks} onLogout={handleLogout}>
      <div className="max-w-3xl">
        <button
          type="button"
          onClick={handleBackToList}
          className="mb-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← Composite tests
        </button>

        {loading ? <QuillLoading label="Loading assessment…" /> : null}

        {!loading && accessLocked ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`${LOCK_STATUS_BADGE_CLASS} bg-violet-100 border-violet-200 text-violet-700`}
              >
                <PadlockIcon />
              </span>
              <h1 className="text-xl font-bold text-violet-950">Assessment locked</h1>
            </div>
            <p className="text-sm text-violet-900">
              {error || "Ask your teacher to unlock this assessment."}
            </p>
          </div>
        ) : null}

        {!loading && !accessLocked && error && !hub ? (
          <p className="text-red-500">{error}</p>
        ) : null}

        {!loading && hub ? (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-start gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-950">{hub.title}</h1>
                <ContentBadge label="Composite" />
              </div>
              {!showDisclaimer ? (
                <p className="text-slate-600 text-sm leading-relaxed">
                  {inProgress
                    ? "Complete each subject section, then submit the full assessment here. Individual scores are shown only after you submit."
                    : `Multi-subject assessment with ${hub.sections.length} section${hub.sections.length === 1 ? "" : "s"}: ${hub.sections.map((s) => formatSubjectLabel(s.subject)).join(", ")}.`}
                </p>
              ) : null}
              {inProgress ? (
                <p className="text-sm font-semibold text-slate-700 mt-3 tabular-nums">
                  Progress: {completedCount} / {sectionTotal} sections complete
                </p>
              ) : null}
            </div>

            {actionError ? <p className="text-red-500 text-sm mb-4">{actionError}</p> : null}

            {showDisclaimer ? (
              <CompositeDisclaimer
                hub={hub}
                starting={starting}
                onBack={() => setShowDisclaimer(false)}
                onContinue={handleConfirmStart}
              />
            ) : null}

            {!showDisclaimer && !hub.attempt_id && !hub.completed_at ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 mb-6">
                <p className="text-sm text-teal-950 mb-4">
                  When you are ready, review the instructions and begin. Each section must
                  be completed in one sitting — backing out auto-submits your answers.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDisclaimer(true)}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 transition"
                >
                  Start assessment
                </button>
              </div>
            ) : null}

            {!showDisclaimer && hub.completed_at && hub.overall ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 mb-6">
                <h2 className="text-lg font-bold text-emerald-950 mb-1">Assessment submitted</h2>
                <p className="text-emerald-900 font-semibold tabular-nums">
                  Overall score:{" "}
                  {formatWeightedTestScore(
                    hub.overall.weighted_score,
                    hub.overall.max_weighted_score,
                  )}
                </p>
                {hub.overall.duration_seconds != null ? (
                  <p className="text-sm text-emerald-800 mt-1">
                    Total time: {formatDurationSeconds(hub.overall.duration_seconds)}
                  </p>
                ) : null}
                <p className="text-sm text-emerald-800 mt-3">
                  Section scores are below. Review links for missed questions appear on each
                  subject test.
                </p>
              </div>
            ) : null}

            {!showDisclaimer && hub.can_submit ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 mb-6">
                <p className="text-sm text-amber-950 mb-3">
                  All sections are complete. Submit the full assessment to see your overall
                  score and unlock review for missed questions.
                </p>
                <button
                  type="button"
                  onClick={handleSubmitComposite}
                  disabled={submitting}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 transition"
                >
                  {submitting ? "Submitting…" : "Submit assessment"}
                </button>
              </div>
            ) : null}

            {!showDisclaimer ? (
              <ol className="space-y-4">
                {hub.sections.map((section) => (
                  <SectionRow
                    key={section.worksheet_id}
                    section={section}
                    hub={hub}
                    onNavigateSection={openSection}
                    showScores={scoresVisible}
                  />
                ))}
              </ol>
            ) : null}
          </>
        ) : null}

        {showExitConfirm ? (
          <CompositeExitDialog
            inProgressSectionCount={inProgressSectionCount}
            exiting={exiting}
            onCancel={() => setShowExitConfirm(false)}
            onConfirm={handleConfirmExit}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
