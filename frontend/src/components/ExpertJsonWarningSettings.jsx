import { useEffect, useState } from "react";
import { getAdminSettings, saveAdminPreferences } from "../api";

export default function ExpertJsonWarningSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setEnabled(data.expert_json_warning_enabled !== false);
      })
      .catch(() => setError("Could not load expert mode preference."))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    setError("");
    try {
      await saveAdminPreferences({ expert_json_warning_enabled: next });
      setEnabled(next);
    } catch (ex) {
      setError(ex.message || "Could not update preference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-950">Expert mode warning</h2>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            When enabled, opening Create → Upload JSON shows a reminder that the JSON tool
            is for expert use and skips some builder safeguards.
          </p>
          {error ? (
            <p className="text-sm text-red-700 mt-2">{error}</p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Expert mode warning ${enabled ? "on" : "off"}`}
          disabled={loading || saving}
          onClick={handleToggle}
          className={`relative h-9 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-indigo-500" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-1 left-1 block h-7 w-7 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
