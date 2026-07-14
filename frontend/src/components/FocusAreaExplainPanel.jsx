import { useState } from "react";
import Drawpad from "./Drawpad";
import { ScratchpadIcon, TextAnswerIcon } from "./ResponseModeIcons";

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
  const baseBtn =
    "inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 transition";
  const active = "bg-indigo-100 text-indigo-900 border-indigo-300";
  const idle =
    "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-800";

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Explanation mode">
      <button
        type="button"
        onClick={() => onChange("text")}
        title="Type explanation"
        aria-label="Type explanation"
        aria-pressed={mode === "text"}
        className={`${baseBtn} ${mode === "text" ? active : idle}`}
      >
        <TextAnswerIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange("scratchpad")}
        title="Use scratchpad"
        aria-label="Use scratchpad"
        aria-pressed={mode === "scratchpad"}
        className={`${baseBtn} ${mode === "scratchpad" ? active : idle}`}
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
  needsDiscussion = true,
  onMarkDiscussed,
  markingDiscussed = false,
}) {
  const [byKey, setByKey] = useState({});
  const [openByKey, setOpenByKey] = useState({});
  const notes = byKey[selectionKey] || DEFAULT_NOTES;
  const isOpen = openByKey[selectionKey] ?? false;

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
          {needsDiscussion ? (
            <button
              type="button"
              disabled={markingDiscussed}
              onClick={onMarkDiscussed}
              className="mt-4 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900 transition disabled:opacity-50"
            >
              {markingDiscussed ? "Saving…" : "Mark discussion complete"}
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
