import { useState } from "react";
import {
  COLOR_THEMES,
  getStoredColorTheme,
  setStoredColorTheme,
} from "../themeUtils";

export default function ColorThemeSettings() {
  const [themeId, setThemeId] = useState(getStoredColorTheme);

  function handleSelect(nextThemeId) {
    setThemeId(setStoredColorTheme(nextThemeId));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Color theme</h2>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
        Choose how Quill looks on this device. The choice is saved in your browser
        and applies for both student and teacher views.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {COLOR_THEMES.map((theme) => {
          const selected = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelect(theme.id)}
              aria-pressed={selected}
              className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                selected
                  ? "border-indigo-400 bg-indigo-50/60 shadow-sm"
                  : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 shadow-inner"
                >
                  <span
                    className="h-full w-1/2"
                    style={{ backgroundColor: theme.swatch[0] }}
                  />
                  <span
                    className="h-full w-1/2"
                    style={{ backgroundColor: theme.swatch[1] }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    {theme.label}
                    {selected ? (
                      <span className="ml-2 text-xs font-semibold text-indigo-700">
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    {theme.description}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
