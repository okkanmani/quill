import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, submitWriting } from "../api";
import AppShell from "../components/AppShell";
import { useStudentNavLinks } from "../useStudentNavLinks";
import { countWords, formatWordCount } from "../writingUtils";

export default function StudentWriting() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { navLinks } = useStudentNavLinks();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const wordCount = useMemo(() => countWords(body), [body]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await submitWriting({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setSuccess("Writing submitted. View it under Your Results.");
    } catch (err) {
      setError(err.message || "Could not submit writing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell navLinks={navLinks} trailing={`Hi, ${name}!`} onLogout={handleLogout}>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Writing</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Write about a book, a chapter, or anything your teacher asked you to
          reflect on. Submitted writing appears under Your Results.
        </p>

        {success ? (
          <p className="text-emerald-800 text-sm mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="text-red-600 text-sm mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          <label className="block text-sm font-semibold text-slate-800">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 — Charlotte’s Web"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              maxLength={200}
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Your writing
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder="Start writing here…"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y min-h-[280px]"
              required
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 tabular-nums">
              {formatWordCount(wordCount)}
            </p>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 text-sm transition"
            >
              {submitting ? "Submitting…" : "Submit writing"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
