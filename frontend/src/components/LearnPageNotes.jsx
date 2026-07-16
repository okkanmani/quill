import { useEffect, useRef, useState } from "react";
import { generateLearnPageNote, saveLearnPageNote } from "../api";

const NOTES_WIDTH_CLASS = "w-52";
const NOTES_COLLAPSED_WIDTH_CLASS = "w-5";

function NotesPanelContent({
  readOnly,
  aiUsed,
  generating,
  saving,
  savedHint,
  body,
  setBody,
  handleGenerate,
  error,
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2.5 shrink-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
          {readOnly ? "Student notes" : "My notes"}
        </p>
        {saving ? (
          <span className="text-[10px] text-slate-400">Saving…</span>
        ) : savedHint ? (
          <span className="text-[10px] text-emerald-600">Saved</span>
        ) : null}
      </div>

      <div className="overflow-y-auto p-3 space-y-2">
        {!readOnly && !aiUsed ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
          >
            {generating ? "Generating…" : "Generate with AI"}
          </button>
        ) : !readOnly && aiUsed ? (
          <p className="text-[10px] text-slate-500 leading-snug">
            AI notes used for this page. You can edit below.
          </p>
        ) : readOnly ? (
          <p className="text-[10px] text-slate-500 leading-snug">
            Viewing notes for the selected student.
          </p>
        ) : null}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          readOnly={readOnly}
          rows={12}
          placeholder={readOnly ? "No notes yet." : "Write your notes here…"}
          className={`w-full min-h-[12rem] resize-y rounded-lg border border-slate-300 px-2.5 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
            readOnly ? "bg-slate-100 cursor-default" : "bg-white"
          }`}
        />

        {error ? (
          <p className="text-[11px] text-red-600 leading-snug">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function LearnPageNotes({
  subjectKey,
  sectionId,
  pageIndex,
  pageMarkdown,
  sectionTitle,
  subjectTitle,
  note,
  onNoteUpdate,
  readOnly = false,
  collapsed = false,
  onToggleCollapsed,
}) {
  const [body, setBody] = useState(note?.body ?? "");
  const [aiUsed, setAiUsed] = useState(Boolean(note?.ai_used));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState(false);
  const skipSaveRef = useRef(true);
  const hintTimerRef = useRef(null);

  const notesWidthClass = collapsed ? NOTES_COLLAPSED_WIDTH_CLASS : NOTES_WIDTH_CLASS;

  useEffect(() => {
    setBody(note?.body ?? "");
    setAiUsed(Boolean(note?.ai_used));
    skipSaveRef.current = true;
  }, [note?.body, note?.ai_used, sectionId, pageIndex]);

  useEffect(() => {
    if (readOnly) return undefined;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return undefined;
    }
    if (!subjectKey || !sectionId) return undefined;

    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError("");
      try {
        const saved = await saveLearnPageNote(
          subjectKey,
          sectionId,
          pageIndex,
          body,
        );
        onNoteUpdate(saved);
        setSavedHint(true);
        if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = window.setTimeout(() => setSavedHint(false), 1800);
      } catch (err) {
        setError(err.message || "Could not save notes.");
      } finally {
        setSaving(false);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [body, subjectKey, sectionId, pageIndex, onNoteUpdate, readOnly]);

  useEffect(
    () => () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    },
    [],
  );

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const saved = await generateLearnPageNote(
        subjectKey,
        sectionId,
        pageIndex,
        {
          pageMarkdown,
          sectionTitle,
          subjectTitle,
        },
      );
      skipSaveRef.current = true;
      setBody(saved.body);
      setAiUsed(Boolean(saved.ai_used));
      onNoteUpdate(saved);
    } catch (err) {
      setError(err.message || "Could not generate notes.");
    } finally {
      setGenerating(false);
    }
  }

  const panelProps = {
    readOnly,
    aiUsed,
    generating,
    saving,
    savedHint,
    body,
    setBody,
    handleGenerate,
    error,
  };

  return (
    <>
      {/* Desktop: sidebar-style rail outside the page card */}
      <div className="relative hidden lg:block shrink-0 self-start">
        <div
          className={`overflow-x-hidden border-l border-slate-200 bg-white transition-[width] duration-200 ease-out ${notesWidthClass}`}
        >
          <div className={`relative ${NOTES_WIDTH_CLASS}`}>
            <div
              className={
                collapsed ? "invisible pointer-events-none select-none" : undefined
              }
              aria-hidden={collapsed}
            >
              <NotesPanelContent {...panelProps} />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Show notes" : "Hide notes"}
          title={collapsed ? "Show notes" : "Hide notes"}
          className="absolute top-3 left-0 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center bg-white text-base font-bold leading-none text-slate-600 hover:text-slate-900 transition"
        >
          {collapsed ? "‹" : "›"}
        </button>
      </div>

      {/* Mobile: notes below the page */}
      <aside className="lg:hidden mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <NotesPanelContent {...panelProps} />
      </aside>
    </>
  );
}
