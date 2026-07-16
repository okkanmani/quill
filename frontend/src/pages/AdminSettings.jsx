import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearAdminOpenAiKey,
  getAdminSettings,
  logout,
  saveAdminOpenAiKey,
} from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AccountSettings from "../components/AccountSettings";
import ColorThemeSettings from "../components/ColorThemeSettings";
import FontSettings from "../components/FontSettings";
import QuillLoading from "../components/QuillLoading";

export default function AdminSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    getAdminSettings()
      .then((data) => {
        setConfigured(Boolean(data.openai_key_configured));
        setAiEnabled(Boolean(data.ai_enabled));
        setError("");
      })
      .catch(() => setError("Could not load settings."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await saveAdminOpenAiKey(apiKey.trim());
      setApiKey("");
      setConfigured(true);
      setMessage("API key saved. It is encrypted on the server and never shown again.");
    } catch (ex) {
      setError(ex.message || "Could not save API key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    const ok = window.confirm("Remove your saved OpenAI API key?");
    if (!ok) return;
    setMessage("");
    setError("");
    try {
      await clearAdminOpenAiKey();
      setConfigured(false);
      setMessage("API key removed.");
    } catch (ex) {
      setError(ex.message || "Could not remove API key.");
    }
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
    >
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Settings</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Manage your account, appearance, and OpenAI API key for AI generation.
        </p>

        {loading ? <QuillLoading label="Loading settings…" /> : null}
        {message ? (
          <p className="text-emerald-800 text-sm mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-red-600 text-sm mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            {error}
          </p>
        ) : null}

        {!loading ? (
          <div className="space-y-6">
            <AccountSettings />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">OpenAI API key</h2>
                <span
                  className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${
                    configured
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-900 border-amber-200"
                  }`}
                >
                  {configured ? "Configured" : "Not set"}
                </span>
              </div>

              {!aiEnabled ? (
                <p className="text-sm text-slate-600 leading-relaxed">
                  AI worksheet generation is disabled on this server (set{" "}
                  <code className="text-xs bg-slate-100 px-1 rounded">QUILL_AI_ENABLED=0</code>{" "}
                  to turn off).
                </p>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  Once saved, use Create → Question builder or Learning resource to
                  generate worksheets and learning content with AI.
                </p>
              )}

              <p className="text-sm text-slate-600 leading-relaxed">
                Create a key at{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline"
                >
                  platform.openai.com
                </a>
                . Prepaid billing applies — typically a few cents per worksheet
                draft with a small model. A new API key uses the same account
                quota; add payment or credits at{" "}
                <a
                  href="https://platform.openai.com/settings/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline"
                >
                  Billing settings
                </a>{" "}
                if you see quota errors.
              </p>

              <form onSubmit={handleSave} className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">
                  {configured ? "Replace API key" : "API key"}
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    autoComplete="off"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving || !apiKey.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl px-5 py-2.5 text-sm"
                  >
                    {saving ? "Saving…" : configured ? "Replace key" : "Save key"}
                  </button>
                  {configured ? (
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 font-semibold rounded-xl px-5 py-2.5 text-sm"
                    >
                      Remove key
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <ColorThemeSettings />
            <FontSettings />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
