import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLOR_THEMES,
  getStoredColorTheme,
  setStoredColorTheme,
} from "../themeUtils";

function ThemeColorSwatch({ swatch, className = "" }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-md border border-slate-200 shadow-inner ${className}`.trim()}
    >
      <span className="h-full w-1/2" style={{ backgroundColor: swatch[0] }} />
      <span className="h-full w-1/2" style={{ backgroundColor: swatch[1] }} />
    </span>
  );
}

export default function ColorThemeSettings() {
  const [themeId, setThemeId] = useState(getStoredColorTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const activeTheme = useMemo(
    () => COLOR_THEMES.find((theme) => theme.id === themeId) ?? COLOR_THEMES[0],
    [themeId],
  );

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

  function chooseTheme(nextThemeId) {
    setThemeId(setStoredColorTheme(nextThemeId));
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Color theme</h2>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
        Choose how Quill looks on this device. Saved in your browser for student
        and teacher views.
      </p>

      <div ref={rootRef} className="relative mt-4">
        <span id="color-theme-label" className="block text-sm font-semibold text-slate-800">
          Theme
        </span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby="color-theme-label"
          onClick={() => setOpen((value) => !value)}
          className="mt-1 flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-900 shadow-sm hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <ThemeColorSwatch swatch={activeTheme.swatch} />
          <span className="flex-1 font-medium">{activeTheme.label}</span>
          <span aria-hidden className="text-slate-400 text-xs">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open ? (
          <ul
            role="listbox"
            aria-labelledby="color-theme-label"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {COLOR_THEMES.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <li key={theme.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => chooseTheme(theme.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? "bg-indigo-50 text-indigo-950"
                        : "text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <ThemeColorSwatch swatch={theme.swatch} />
                    <span className="font-medium">{theme.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {activeTheme?.description ? (
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {activeTheme.description}
        </p>
      ) : null}
    </div>
  );
}
