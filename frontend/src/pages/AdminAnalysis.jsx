import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, logout, uploadFocusEvaluation } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentBanner from "../components/AdminStudentBanner";
import QuillLoading from "../components/QuillLoading";
import FocusAreaExplainPanel from "../components/FocusAreaExplainPanel";
import {
  focusAreasAnalysis,
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
  const focus = subject.focusAreas.find((f) => f.area === parsed.area);
  if (!focus) return null;
  return { subject, focus };
}

function FocusExampleCard({ example, index, total }) {
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
        <p className="text-sm text-emerald-800 mt-2">
          <span className="font-medium">Correct answer: </span>
          {example.expected}
        </p>
      ) : null}
    </div>
  );
}

function FocusAreaDetailPanel({ selection, selectionKey }) {
  const { subject, focus } = selection;
  const examples = focus.examples || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {subject.subjectLabel}
      </p>
      <h2 className="text-xl font-semibold text-slate-950 mt-1">{focus.area}</h2>
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
      <FocusAreaExplainPanel selectionKey={selectionKey} areaLabel={focus.area} />
    </div>
  );
}

function SubjectBlock({ subject, selectedKey, onSelectArea }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <p className="text-lg font-semibold text-slate-900">{subject.subjectLabel}</p>
      <p className="text-sm text-slate-700 mt-3 leading-relaxed">
        {subject.focusAreas.map((focus, index) => {
          const key = focusSelectionKey(subject.subjectKey, focus.area);
          const isSelected = selectedKey === key;
          return (
            <span key={focus.area}>
              {index > 0 ? ", " : null}
              <button
                type="button"
                onClick={() => onSelectArea(key)}
                className={`font-medium underline-offset-2 hover:underline ${
                  isSelected
                    ? "text-indigo-800 underline"
                    : "text-indigo-600"
                }`}
              >
                {focus.area}
              </button>
            </span>
          );
        })}
      </p>
    </div>
  );
}

export default function AdminAnalysis() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const uploadInputRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getResults()
      .then((data) => {
        setError("");
        setResults(data);
      })
      .catch(() => setError("Could not load analysis data."))
      .finally(() => setLoading(false));
  }, []);

  const bySubject = useMemo(() => focusAreasAnalysis(results), [results]);
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
      onBack={() => navigate("/admin")}
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
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
    </AppShell>
  );
}
