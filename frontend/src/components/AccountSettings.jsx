import { useState } from "react";
import { updateAdminAccount } from "../api";

export default function AccountSettings() {
  const initialName = localStorage.getItem("adminName") || "";

  const [username, setUsername] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const trimmedName = username.trim();
    const nameChanged = trimmedName !== savedName.trim();
    const passwordChanged = Boolean(newPassword);

    if (!currentPassword) {
      setError("Enter your current password to save changes.");
      return;
    }
    if (!nameChanged && !passwordChanged) {
      setError("Change your username and/or enter a new password.");
      return;
    }
    if (passwordChanged && newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    if (passwordChanged && newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        current_password: currentPassword,
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(passwordChanged ? { new_password: newPassword } : {}),
      };
      const data = await updateAdminAccount(payload);

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      if (data.admin_name) localStorage.setItem("adminName", data.admin_name);

      setUsername(data.admin_name);
      setSavedName(data.admin_name);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(data.message || "Account updated.");
    } catch (err) {
      setError(err.message || "Could not update account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Account</h2>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
        Update your admin login username or password. Your current password is
        required to save any changes.
      </p>

      {message ? (
        <p className="text-emerald-800 text-sm mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-red-600 text-sm mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold text-slate-800">
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Leave blank to keep current"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Leave blank to keep current"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl px-5 py-2.5 text-sm"
        >
          {saving ? "Updating…" : "Update"}
        </button>
      </form>
    </div>
  );
}
