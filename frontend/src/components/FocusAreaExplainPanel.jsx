import { useState } from "react";
import { Link } from "react-router-dom";
import { generateFocusDiscussionReference } from "../api";
import Drawpad from "./Drawpad";
import { ScratchpadIcon, TextAnswerIcon } from "./ResponseModeIcons";
import {
  ICON_ACTION_ACTIVE_CLASS,
  ICON_ACTION_BUTTON_CLASS,
  ICON_ACTION_IDLE_CLASS,
} from "./rowActionButtonStyles";

const DEFAULT_NOTES = { mode: "text", text: "", scratchpad: "" };

function updateNotes(setByKey, selectionKey, patch) {
  setByKey((prev) => ({
    ...prev,
    [selectionKey]: {
      ...(prev[selectionKey] || DEFAULT_NOTES),
      ...patch,
    },
  }));
}

function ExplainModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Explanation mode">
      <button
        type="button"
        onClick={() => onChange("text")}
        title="Type explanation"
        aria-label="Type explanation"
        aria-pressed={mode === "text"}
        className={`${ICON_ACTION_BUTTON_CLASS} ${
          mode === "text" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
        }`}
      >
        <TextAnswerIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange("scratchpad")}
        title="Use scratchpad"
        aria-label="Use scratchpad"
        aria-pressed={mode === "scratchpad"}
        className={`${ICON_ACTION_BUTTON_CLASS} ${
          mode === "scratchpad" ? ICON_ACTION_ACTIVE_CLASS : ICON_ACTION_IDLE_CLASS
        }`}
      >
        <ScratchpadIcon />
      </button>
    </div>
  );
}

/** Teacher notes for discussing a focus area with a student. */
export default function FocusAreaExplainPanel({
  selectionKey,
  areaLabel,
  area = "",
  subjectKey = "",
  examples = [],
  grade = null,
  aiEnabled = true,
  apiKeyConfigured = false,
  needsDiscussion = true,
  reinforcing = false,
  onMarkDiscussed,
  markingDiscussed = false,
  generatingPractice = false,
  generatePracticeOnComplete = false,
  onGeneratePracticeOnCompleteChange,
}) {
  const [byKey, setByKey] = useState({});
  const [openByKey, setOpenByKey] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const notes = byKey[selectionKey] || DEFAULT_NOTES;
  const isOpen = openByKey[selectionKey] ?? false;
  const canGenerate = aiEnabled && apiKeyConfigured && examples.length > 0;

  async function handleGenerateFromAllExamples() {
    setGenerateError("");
    setGeneratingAll(true);
    try {
      const { reference } = await generateFocusDiscussionReference({
        subject: subjectKey,
        area,
        grade: grade || undefined,
        examples: examples.map((example) => ({
          question: example.question,
          answer: example.answer || "",
          expected: example.expected || "",
          choices: example.choices?.length ? example.choices : undefined,
        })),
      });
      setByKey((prev) => {
        const existing = prev[selectionKey] || DEFAULT_NOTES;
        const separator = existing.text.trim() ? "\n\n" : "";
        return {
          ...prev,
          [selectionKey]: {
            ...existing,
            mode: "text",
            text: existing.text.trim()
              ? `${existing.text.trim()}${separator}${reference}`
              : reference,
          },
        };
      });
      setOpenByKey((prev) => ({ ...prev, [selectionKey]: true }));
    } catch (err) {
      setGenerateError(err.message || "Could not generate reference.");
    } finally {
      setGeneratingAll(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Discuss
          </p>
          <h3 className="text-base font-semibold text-slate-900 mt-0.5">
            Explain {areaLabel}
          </h3>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOpen}
          aria-label={`${isOpen ? "Hide" : "Show"} explanation notes`}
          onClick={() =>
            setOpenByKey((prev) => ({
              ...prev,
              [selectionKey]: !isOpen,
            }))
          }
          className={`relative h-9 w-14 shrink-0 rounded-full transition-colors ${
            isOpen ? "bg-indigo-500" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-1 left-1 block h-7 w-7 rounded-full bg-white shadow transition-transform ${
              isOpen ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {examples.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateFromAllExamples}
            disabled={!canGenerate || generatingAll}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAll
              ? "Generating…"
              : `Generate AI reference from ${examples.length} example${examples.length === 1 ? "" : "s"}`}
          </button>
          {!aiEnabled ? (
            <span className="text-xs text-slate-500">AI disabled on server</span>
          ) : !apiKeyConfigured ? (
            <Link to="/admin/settings" className="text-xs font-semibold text-indigo-700 underline">
              Add API key
            </Link>
          ) : null}
        </div>
      ) : null}
      {generateError ? (
        <p className="text-xs text-red-700 mt-2">{generateError}</p>
      ) : null}

      {isOpen ? (
        <>
          <div className="flex justify-end mt-3">
            <ExplainModeToggle
              mode={notes.mode}
              onChange={(mode) => updateNotes(setByKey, selectionKey, { mode })}
            />
          </div>

          {notes.mode === "scratchpad" ? (
            <Drawpad
              key={`explain-scratch-${selectionKey}`}
              value={notes.scratchpad}
              onChange={(scratchpad) =>
                updateNotes(setByKey, selectionKey, { scratchpad })
              }
              showHeading={false}
              showTextTool
              className="mt-3"
              canvasHeight={1000}
            />
          ) : (
            <textarea
              value={notes.text}
              onChange={(e) =>
                updateNotes(setByKey, selectionKey, { text: e.target.value })
              }
              placeholder="Type notes or talking points to walk through with the student…"
              rows={6}
              className="w-full mt-3 border border-slate-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y min-h-[10rem]"
            />
          )}
          {needsDiscussion && aiEnabled && apiKeyConfigured ? (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generatePracticeOnComplete}
                  onChange={(e) => onGeneratePracticeOnCompleteChange?.(e.target.checked)}
                  disabled={markingDiscussed || generatingPractice}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-800 leading-relaxed">
                  <span className="font-semibold">Generate AI practice worksheet</span>
                  <span className="block text-xs text-slate-600 mt-1">
                    Optional — saves a worksheet to the student&apos;s Revision page. Uncheck
                    if you don&apos;t want practice after this discussion.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
          {needsDiscussion ? (
            <button
              type="button"
              disabled={markingDiscussed || generatingPractice}
              onClick={onMarkDiscussed}
              className="mt-4 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900 transition disabled:opacity-50"
            >
              {generatingPractice
                ? "Generating practice…"
                : markingDiscussed
                  ? reinforcing
                    ? "Marking reinforcement complete…"
                    : "Marking discussion complete…"
                  : reinforcing
                    ? "Mark reinforcement complete"
                    : "Mark discussion complete"}
            </button>
          ) : (
            <p className="mt-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Discussion complete — this focus area is in the discussed list.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
