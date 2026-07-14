import { useState } from "react";
import Drawpad from "./Drawpad";

const DEFAULT_NOTES = { scratchpad: "" };

function updateNotes(setByKey, selectionKey, patch) {
  setByKey((prev) => ({
    ...prev,
    [selectionKey]: {
      ...(prev[selectionKey] || DEFAULT_NOTES),
      ...patch,
    },
  }));
}

/** Ephemeral teacher notes for discussing a focus area with a student. */
export default function FocusAreaExplainPanel({ selectionKey, areaLabel }) {
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
        <Drawpad
          key={`explain-scratch-${selectionKey}`}
          value={notes.scratchpad}
          onChange={(scratchpad) =>
            updateNotes(setByKey, selectionKey, { scratchpad })
          }
          showHeading={false}
          showTextTool
          className="mt-4"
          canvasHeight={1000}
        />
      ) : null}
    </div>
  );
}
