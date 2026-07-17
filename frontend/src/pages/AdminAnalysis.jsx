import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, getFocusAreasDiscussed, logout, markFocusAreaDiscussed, uploadFocusEvaluation } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentBanner from "../components/AdminStudentBanner";
import QuillLoading from "../components/QuillLoading";
import FocusAreaExplainPanel from "../components/FocusAreaExplainPanel";
import {
  focusAreasAnalysisWithDiscussion,
  formatAreaLabel,
  formatFocusExampleAnswer,
  formatFocusExampleChoices,
  isMissingFocusExampleAnswer,
} from "../analysisUtils";
import {
  readJsonFile,
  resolveResultForEvaluationUpload,
} from "../resultExportUtils";

function focusSelectionKey(subjectKey, area) {
  return `${subjectKey}::${area}`;
}

function parseFocusSelectionKey(key) {
  if (!key) return null;
  const splitAt = key.indexOf("::");
  if (splitAt <= 0) return null;
  return {
    subjectKey: key.slice(0, splitAt),
    area: key.slice(splitAt + 2),
  };
}

function findSelectedFocus(bySubject, selectedKey) {
  const parsed = parseFocusSelectionKey(selectedKey);
  if (!parsed) return null;
  const subject = bySubject.find((s) => s.subjectKey === parsed.subjectKey);
  if (!subject) return null;
  const focus =
    subject.needsDiscussion.find((f) => f.area === parsed.area) ||
    subject.alreadyDiscussed.find((f) => f.area === parsed.area);
  if (!focus) return null;
  return { subject, focus };
}

function FocusAreaChips({ areas, subjectKey, selectedKey, onSelectArea, muted = false }) {
  if (!areas.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {areas.map((focus) => {
        const key = focusSelectionKey(subjectKey, focus.area);
        const isSelected = selectedKey === key;
        const label = formatAreaLabel(focus.area);
        return (
          <button
            key={focus.area}
            type="button"
            onClick={() => onSelectArea(key)}
            aria-pressed={isSelected}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
              isSelected
                ? muted
                  ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                  : "bg-indigo-700 text-white border-indigo-800 shadow-sm"
                : muted
                  ? "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                  : "bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FocusExampleCard({ example, index, total }) {
  const [revealed, setRevealed] = useState(false);
  const choices = formatFocusExampleChoices(example.choices);
  const studentAnswer = formatFocusExampleAnswer(example.answer);
  const missingAnswer = isMissingFocusExampleAnswer(example.answer);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Example{total > 1 ? ` ${index + 1}` : ""}
      </p>
      <p className="text-sm text-slate-900 mt-2 leading-relaxed whitespace-pre-wrap">
        {example.question}
      </p>
      {choices ? (
        <p className="text-sm text-slate-700 mt-2 leading-relaxed">
          <span className="font-medium text-slate-600">Options: </span>
          {choices}
        </p>
      ) : null}
      <p className="text-sm text-red-800 mt-2">
        <span className="font-medium">Student answered: </span>
        <span className={missingAnswer ? "text-slate-500 italic" : undefined}>
          {studentAnswer}
        </span>
      </p>
      {example.expected ? (
        <div className="text-sm text-emerald-800 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">Correct answer:</span>
          {revealed ? (
            <span>{example.expected}</span>
          ) : (
            <span
              className="inline-block rounded px-2 py-0.5 bg-emerald-100/80 text-emerald-900/40 select-none tracking-widest font-mono text-xs"
              aria-hidden="true"
            >
              {"•".repeat(Math.min(Math.max(example.expected.length, 6), 16))}
            </span>
          )}
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
            aria-pressed={revealed}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FocusAreaDetailPanel({
  selection,
  selectionKey,
  onMarkDiscussed,
  markingDiscussed,
}) {
  const { subject, focus } = selection;
  const examples = focus.examples || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {subject.subjectLabel}
      </p>
      <h2 className="text-xl font-semibold text-slate-950 mt-1">
        {formatAreaLabel(focus.area)}
      </h2>
      {focus.needsDiscussion === false ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mt-2">
          Discussed
        </p>
      ) : (
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mt-2">
          Needs discussion
        </p>
      )}
      {examples.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {examples.map((example, index) => (
            <FocusExampleCard
              key={`${focus.area}-${example.question_id || index}`}
              example={example}
              index={index}
              total={examples.length}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600 mt-4 leading-relaxed">
          No sample wrong answers recorded for this area yet.
        </p>
      )}
      <FocusAreaExplainPanel
        selectionKey={selectionKey}
        areaLabel={focus.area}
        needsDiscussion={focus.needsDiscussion !== false}
        onMarkDiscussed={onMarkDiscussed}
        markingDiscussed={markingDiscussed}
      />
    </div>
  );
}

function SubjectBlock({ subject, selectedKey, onSelectArea }) {
  const { needsDiscussion, alreadyDiscussed } = subject;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <p className="text-lg font-semibold text-slate-900">{subject.subjectLabel}</p>
      {needsDiscussion.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Needs discussion
          </p>
          <FocusAreaChips
            areas={needsDiscussion}
            subjectKey={subject.subjectKey}
            selectedKey={selectedKey}
            onSelectArea={onSelectArea}
          />
        </div>
      ) : null}
      {alreadyDiscussed.length > 0 ? (
        <div className={needsDiscussion.length > 0 ? "mt-4" : "mt-3"}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Discussed
          </p>
          <FocusAreaChips
            areas={alreadyDiscussed}
            subjectKey={subject.subjectKey}
            selectedKey={selectedKey}
            onSelectArea={onSelectArea}
            muted
          />
        </div>
      ) : null}
    </div>
  );
}

export default function AdminAnalysis() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [discussed, setDiscussed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [markingDiscussed, setMarkingDiscussed] = useState(false);
  const uploadInputRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getResults(), getFocusAreasDiscussed()])
      .then(([resultData, discussedData]) => {
        setError("");
        setResults(resultData);
        setDiscussed(discussedData);
      })
      .catch(() => setError("Could not load analysis data."))
      .finally(() => setLoading(false));
  }, []);

  const bySubject = useMemo(
    () => focusAreasAnalysisWithDiscussion(results, discussed),
    [results, discussed],
  );
  const uploadedCount = results.filter((r) => r.focus_evaluation).length;
  const selection = useMemo(
    () => findSelectedFocus(bySubject, selectedKey),
    [bySubject, selectedKey],
  );

  useEffect(() => {
    if (bySubject.length === 0) {
      setSelectedKey("");
      return;
    }
    if (selectedKey && !findSelectedFocus(bySubject, selectedKey)) {
      setSelectedKey("");
    }
  }, [bySubject, selectedKey]);

  async function handleMarkDiscussed() {
    if (!selection) return;
    setMarkingDiscussed(true);
    setError("");
    try {
      const updated = await markFocusAreaDiscussed({
        subject: selection.subject.subjectKey,
        area: selection.focus.area,
      });
      setDiscussed((prev) => {
        const next = prev.filter(
          (row) =>
            !(
              row.subject === updated.subject &&
              row.area === updated.area
            ),
        );
        return [...next, updated];
      });
      setUploadMessage(`Marked “${selection.focus.area}” as discussed.`);
    } catch (err) {
      setError(err.message || "Could not save discussion status.");
    } finally {
      setMarkingDiscussed(false);
    }
  }

  async function handleUploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadMessage("");
    setError("");
    try {
      const data = await readJsonFile(file);
      const resolved = resolveResultForEvaluationUpload(data, results);
      if (resolved.error) {
        throw new Error(resolved.error);
      }
      const updated = await uploadFocusEvaluation(resolved.result.id, data);
      setResults((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setUploadMessage(
        `Evaluation uploaded for “${updated.title || updated.worksheet_id}”.`,
      );
    } catch (err) {
      setError(err.message || "Could not upload evaluation JSON.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const studentName = localStorage.getItem("studentName");

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
    >
      <div className="max-w-6xl">
          <AdminStudentBanner />
          <AdminStudentSwitcher />

          <h1 className="text-2xl font-bold text-slate-950 mb-2">Analysis</h1>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <p className="text-slate-700 text-sm leading-relaxed">
              {studentName
                ? `Focus areas for ${studentName} — from analyzed worksheet results.`
                : "Focus areas from analyzed worksheet results."}
              {" "}
              Use <strong className="font-semibold">Analyze</strong> on the Results page
              for worksheets with specific question area tags. You can still upload
              evaluation JSON here for older worksheets without areas.
            </p>
            {!loading ? (
              <>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleUploadFile}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M12 21V9m0 0l4 4m-4-4l-4-4" />
                    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  {uploading ? "Uploading…" : "Upload evaluation"}
                </button>
              </>
            ) : null}
          </div>

          {uploadMessage && (
            <p className="text-green-700 text-sm mb-4">{uploadMessage}</p>
          )}

          {loading && <QuillLoading label="Loading analysis…" />}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {!loading && !error && results.length === 0 && (
            <p className="text-slate-600">
              No submissions yet — analysis will appear after worksheets are graded.
            </p>
          )}

          {!loading && !error && results.length > 0 && uploadedCount === 0 && (
            <p className="text-slate-600">
              No analyzed results yet — use Analyze on the Results page after a
              worksheet is graded, or upload evaluation JSON for untagged worksheets.
            </p>
          )}

          {!loading && !error && bySubject.length > 0 && (
            <div
              className={`grid gap-6 items-start ${
                selection ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
              }`}
            >
              <div className={selection ? "lg:col-span-1" : undefined}>
                <div className="flex flex-col gap-4">
                  {bySubject.map((subject) => (
                    <SubjectBlock
                      key={subject.subjectKey}
                      subject={subject}
                      selectedKey={selectedKey}
                      onSelectArea={setSelectedKey}
                    />
                  ))}
                </div>
              </div>
              {selection ? (
                <div className="lg:col-span-2 lg:sticky lg:top-6">
                  <FocusAreaDetailPanel
                    selection={selection}
                    selectionKey={selectedKey}
                    onMarkDiscussed={handleMarkDiscussed}
                    markingDiscussed={markingDiscussed}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
    </AppShell>
  );
}
