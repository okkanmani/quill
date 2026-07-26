import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { uploadWorksheet, validateWorksheetJson } from "../api";
import { WORKSHEET_EDITOR_TABS } from "../worksheetUploadFormatExamples";
import { CREATE_BODY, CREATE_SECTION_TITLE } from "../createTypography";

function initialEditorTexts() {
  return Object.fromEntries(
    WORKSHEET_EDITOR_TABS.map((tab) => [tab.id, tab.json]),
  );
}

function parseWorksheetJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { error: err.message || "Invalid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "JSON must be an object." };
  }
  return { data: parsed };
}

export default function WorksheetUploadPanel() {
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState(WORKSHEET_EDITOR_TABS[0].id);
  const [editorTexts, setEditorTexts] = useState(initialEditorTexts);
  const [editorParseError, setEditorParseError] = useState("");
  const [validationOk, setValidationOk] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  const busy = uploading || validating;

  const activeTab = useMemo(
    () => WORKSHEET_EDITOR_TABS.find((t) => t.id === activeEditorTab),
    [activeEditorTab],
  );

  function reportUploadResults(uploaded, failed) {
    if (uploaded.length > 0) {
      if (uploaded.length === 1) {
        const r = uploaded[0];
        setSuccess(
          `Uploaded ${r.id} — “${r.title}” (${r.question_count} questions).`,
        );
      } else {
        setSuccess(
          `Uploaded ${uploaded.length} worksheets: ${uploaded.map((r) => r.id).join(", ")}.`,
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (failed.length > 0) {
      setError(failed.map((f) => `${f.name}: ${f.message}`).join(" "));
    }
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    setSuccess("");
    setEditorParseError("");

    const uploaded = [];
    const failed = [];

    try {
      for (const file of files) {
        try {
          const result = await uploadWorksheet(file);
          uploaded.push(result);
        } catch (err) {
          failed.push({
            name: file.name,
            message: err.message || "Upload failed",
          });
        }
      }
      reportUploadResults(uploaded, failed);
    } finally {
      setUploading(false);
    }
  }

  async function handleEditorUpload() {
    const raw = editorTexts[activeEditorTab] ?? "";
    setEditorParseError("");
    setValidationOk(null);
    setValidationErrors([]);

    const parsedResult = parseWorksheetJson(raw);
    if (parsedResult.error) {
      setEditorParseError(parsedResult.error);
      return;
    }
    const parsed = parsedResult.data;

    const subject =
      typeof parsed.subject === "string" && parsed.subject.trim()
        ? parsed.subject.trim().toLowerCase()
        : "worksheet";
    const fileName = `upload-${subject}-${activeEditorTab}.json`;
    const file = new File([JSON.stringify(parsed, null, 2)], fileName, {
      type: "application/json",
    });

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const result = await uploadWorksheet(file);
      reportUploadResults([result], []);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleEditorValidate() {
    const raw = editorTexts[activeEditorTab] ?? "";
    setEditorParseError("");
    setValidationOk(null);
    setValidationErrors([]);

    const parsedResult = parseWorksheetJson(raw);
    if (parsedResult.error) {
      setEditorParseError(parsedResult.error);
      return;
    }

    setValidating(true);
    try {
      const result = await validateWorksheetJson(parsedResult.data);
      setValidationOk(result);
    } catch (err) {
      if (err.details?.length) {
        setValidationErrors(err.details);
      } else {
        setValidationErrors([err.message || "Validation failed"]);
      }
    } finally {
      setValidating(false);
    }
  }

  function resetActiveTabTemplate() {
    const tab = WORKSHEET_EDITOR_TABS.find((t) => t.id === activeEditorTab);
    if (!tab) return;
    setEditorTexts((prev) => ({ ...prev, [activeEditorTab]: tab.json }));
    setEditorParseError("");
    setValidationOk(null);
    setValidationErrors([]);
  }

  return (
    <>
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

      <p className={`${CREATE_BODY} mb-8 inline-flex flex-wrap items-center gap-x-1 gap-y-1`}>
        Upload{" "}
        <label
          className={`inline-flex shrink-0 items-center justify-center rounded-lg border w-7 h-7 align-middle transition ${
            busy
              ? "opacity-50 pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
              : "cursor-pointer border-slate-200 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
          }`}
          title={uploading ? "Uploading…" : "Upload JSON file(s) from this device"}
        >
          <span className="sr-only">Upload JSON file(s) from this device</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden
          >
            <path d="M12 3v12" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={handleFileUpload}
          />
        </label>{" "}
        file(s) from this device OR use the editor tool below.
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <h2 className={CREATE_SECTION_TITLE}>JSON editor</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Pick a template tab, paste or edit JSON, then upload. Each tab keeps its
            own draft until you reset it.
          </p>
        </div>

        <div
          className="flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-slate-100 bg-slate-50/80"
          role="tablist"
          aria-label="Worksheet JSON templates"
        >
          {WORKSHEET_EDITOR_TABS.map((tab) => {
            const selected = tab.id === activeEditorTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActiveEditorTab(tab.id);
                  setEditorParseError("");
                  setValidationOk(null);
                  setValidationErrors([]);
                }}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {activeTab?.description ? (
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              {activeTab.description}
            </p>
          ) : null}

          <textarea
            role="tabpanel"
            aria-label={`${activeTab?.label ?? "Worksheet"} JSON`}
            spellCheck={false}
            disabled={busy}
            value={editorTexts[activeEditorTab] ?? ""}
            onChange={(e) => {
              setEditorTexts((prev) => ({
                ...prev,
                [activeEditorTab]: e.target.value,
              }));
              if (editorParseError) setEditorParseError("");
              if (validationOk || validationErrors.length) {
                setValidationOk(null);
                setValidationErrors([]);
              }
            }}
            className="w-full min-h-[320px] font-mono text-[12px] leading-relaxed text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:opacity-60"
          />

          {editorParseError ? (
            <p className="mt-2 text-xs text-red-700">Invalid JSON: {editorParseError}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleEditorValidate}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-xs font-semibold px-3 py-1.5 transition"
            >
              {validating ? "Validating…" : "Validate"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleEditorUpload}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 transition"
            >
              {uploading ? "Uploading…" : "Upload JSON"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={resetActiveTabTemplate}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-xs font-semibold px-3 py-1.5 transition"
            >
              Reset tab to template
            </button>
          </div>

          {validationOk ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 leading-relaxed">
              Valid worksheet JSON — “{validationOk.title}” ({validationOk.subject},{" "}
              {validationOk.question_count} question
              {validationOk.question_count === 1 ? "" : "s"}
              {validationOk.is_test ? ", test" : ""}). Upload will assign a new worksheet id;
              nothing is saved until you upload.
            </div>
          ) : null}

          {validationErrors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <p className="font-semibold mb-1.5">Validation failed</p>
              <ul className="list-disc pl-4 space-y-1 leading-relaxed">
                {validationErrors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
