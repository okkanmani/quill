import { useState } from "react";
import { Link } from "react-router-dom";
import { uploadWorksheet } from "../api";

export default function WorksheetUploadPanel() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const uploaded = [];
    const failed = [];

    try {
      for (const file of files) {
        try {
          const result = await uploadWorksheet(file);
          uploaded.push(result);
        } catch (err) {
          failed.push({
            name: file.name,
            message: err.message || "Upload failed",
          });
        }
      }

      if (uploaded.length > 0) {
        if (uploaded.length === 1) {
          const r = uploaded[0];
          setSuccess(
            `Uploaded ${r.id} — “${r.title}” (${r.question_count} questions).`,
          );
        } else {
          setSuccess(
            `Uploaded ${uploaded.length} worksheets: ${uploaded.map((r) => r.id).join(", ")}.`,
          );
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (failed.length > 0) {
        setError(failed.map((f) => `${f.name}: ${f.message}`).join(" "));
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <p className="text-slate-600 text-sm mb-6 leading-relaxed">
        Upload one or more worksheet JSON files. Each file becomes a worksheet
        students can open from their list.
      </p>

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}{" "}
          <Link to="/admin/worksheets" className="font-semibold underline">
            View worksheets
          </Link>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-w-xl">
        <h2 className="font-bold text-slate-900 mb-2">Upload JSON</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Select a worksheet export file. You can upload multiple files at once.
        </p>
        <label className="inline-flex items-center justify-center cursor-pointer">
          <span className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-3 transition">
            {uploading ? "Uploading…" : "Choose JSON file(s)"}
          </span>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      </section>
    </>
  );
}
