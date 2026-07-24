import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import LearnSubjectPrintable from "./LearnSubjectPrintable";
import { printLearnSubjectDocument } from "../learnPrintUtils";

export default function LearnSubjectPdfButton({ title, description, groups }) {
  const printRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setError("");
    setBusy(true);
    try {
      const ok = await printLearnSubjectDocument(
        printRef.current,
        title || "Learning resource",
      );
      if (!ok) {
        setError(
          "Print failed in this preview. Open http://localhost:5173 in Chrome or Safari and try again.",
        );
      }
    } catch {
      setError("Could not prepare PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          title="Opens your browser print dialog — choose Save as PDF"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition"
        >
          {busy ? "Preparing…" : "Download PDF"}
        </button>
        {error ? (
          <p className="text-xs text-red-700">{error}</p>
        ) : (
          <p className="text-xs text-slate-500">
            Open in Chrome or Safari → Print → Save as PDF. If date/URL still appear, disable
            “Headers and footers” in the print dialog.
          </p>
        )}
      </div>

      {createPortal(
        <div
          ref={printRef}
          className="learn-print-host fixed top-0 -left-[10000px] w-[42rem] max-w-full pointer-events-none"
          aria-hidden
        >
          <LearnSubjectPrintable
            title={title}
            description={description}
            groups={groups}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
