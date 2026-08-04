import { useEffect, useMemo, useRef, useState } from "react";
import {
  FONT_OPTIONS,
  getFontOption,
  getStoredFont,
  setStoredFont,
} from "../fontUtils";
import {
  CREATE_FIELD_LABEL,
  WS_BODY,
  WS_BODY_MUTED,
  WS_SECTION_TITLE,
} from "../adminHubTypography";

function FontPreview({ stack, className = "" }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 ${className}`.trim()}
      style={{ fontFamily: stack }}
    >
      Aa
    </span>
  );
}

export default function FontSettings() {
  const [fontId, setFontId] = useState(getStoredFont);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const activeFont = useMemo(() => getFontOption(fontId), [fontId]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function chooseFont(nextFontId) {
    setFontId(setStoredFont(nextFontId));
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className={WS_SECTION_TITLE}>Font</h2>
      <p className={`${WS_BODY} mt-1 leading-relaxed`}>
        Choose the typeface for Quill on this device. Saved for your account on
        this browser.
      </p>

      <div ref={rootRef} className="relative mt-4">
        <span id="font-label" className={CREATE_FIELD_LABEL}>
          Typeface
        </span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby="font-label"
          onClick={() => setOpen((value) => !value)}
          className="mt-1 flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-900 shadow-sm hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          style={{ fontFamily: activeFont.stack }}
        >
          <FontPreview stack={activeFont.stack} />
          <span className="flex-1 font-medium">{activeFont.label}</span>
          <span aria-hidden className="text-slate-400 text-xs">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open ? (
          <ul
            role="listbox"
            aria-labelledby="font-label"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {FONT_OPTIONS.map((font) => {
              const selected = font.id === fontId;
              return (
                <li key={font.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => chooseFont(font.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? "bg-indigo-50 text-indigo-950"
                        : "text-slate-900 hover:bg-slate-50"
                    }`}
                    style={{ fontFamily: font.stack }}
                  >
                    <FontPreview stack={font.stack} />
                    <span className="font-medium">{font.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {activeFont?.description ? (
        <p
          className={`${WS_BODY_MUTED} mt-2 leading-relaxed`}
          style={{ fontFamily: activeFont.stack }}
        >
          {activeFont.description}
        </p>
      ) : null}
    </div>
  );
}
