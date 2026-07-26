import { useState } from "react";
import { updateAdminAccount } from "../api";
import {
  ADMIN_HUB_ALERT_ERROR,
  ADMIN_HUB_ALERT_SUCCESS,
  CREATE_FIELD_LABEL,
  CREATE_PUBLISH_BUTTON,
  WS_BODY,
  WS_SECTION_TITLE,
} from "../adminHubTypography";

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
      <h2 className={WS_SECTION_TITLE}>Account</h2>
      <p className={`${WS_BODY} mt-1 leading-relaxed`}>
        Update your admin login username or password. Your current password is
        required to save any changes.
      </p>

      {message ? (
        <p className={`${ADMIN_HUB_ALERT_SUCCESS} mt-4 mb-0`}>{message}</p>
      ) : null}
      {error ? (
        <p className={`${ADMIN_HUB_ALERT_ERROR} mt-4 mb-0`}>{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className={CREATE_FIELD_LABEL}>
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

        <label className={CREATE_FIELD_LABEL}>
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

        <label className={CREATE_FIELD_LABEL}>
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

        <label className={CREATE_FIELD_LABEL}>
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

        <button type="submit" disabled={saving} className={CREATE_PUBLISH_BUTTON}>
          {saving ? "Updating…" : "Update"}
        </button>
      </form>
    </div>
  );
}
