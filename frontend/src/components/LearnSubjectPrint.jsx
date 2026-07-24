import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import LearnSubjectPrintable from "./LearnSubjectPrintable";
import { groupsForSection } from "../learnPrintGroups";
import { printLearnSubjectDocument } from "../learnPrintUtils";

/**
 * One off-screen print host for the learn subject page. Triggers set payload, then print.
 */
export function LearnSubjectPrintHost({ printRequest, onPrintDone }) {
  const printRef = useRef(null);

  useEffect(() => {
    if (!printRequest) return undefined;

    let cancelled = false;

    (async () => {
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      if (cancelled || !printRef.current) {
        onPrintDone?.();
        return;
      }
      try {
        await printLearnSubjectDocument(
          printRef.current,
          printRequest.documentTitle || "Learning resource",
        );
      } finally {
        if (!cancelled) onPrintDone?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [printRequest, onPrintDone]);

  if (!printRequest) return null;

  return createPortal(
    <div
      ref={printRef}
      className="learn-print-host fixed top-0 -left-[10000px] w-[42rem] max-w-full pointer-events-none"
      aria-hidden
    >
      <LearnSubjectPrintable
        collectionTitle={printRequest.collectionTitle}
        collectionDescription={printRequest.collectionDescription}
        grade={printRequest.grade}
        curriculum={printRequest.curriculum}
        groups={printRequest.groups}
        scope={printRequest.scope}
      />
    </div>,
    document.body,
  );
}

export function LearnSubjectPdfTrigger({
  label = "PDF",
  title = "Opens Print → Save as PDF in your browser",
  disabled = false,
  busy = false,
  variant = "compact",
  onClick,
}) {
  const className =
    variant === "link"
      ? "font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 disabled:opacity-60"
      : "shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={className}
    >
      {busy ? "…" : label}
    </button>
  );
}

export function buildSectionPrintRequest({
  collectionTitle,
  collectionDescription,
  groups,
  sectionId,
  sectionTitle,
  grade,
  curriculum,
}) {
  return {
    scope: "section",
    collectionTitle,
    collectionDescription: "",
    grade,
    curriculum,
    groups: groupsForSection(groups, sectionId),
    documentTitle: sectionTitle
      ? `${sectionTitle} — ${collectionTitle || "Learning resource"}`
      : collectionTitle || "Learning resource",
  };
}

export function buildCollectionPrintRequest({
  collectionTitle,
  collectionDescription,
  groups,
  grade,
  curriculum,
}) {
  return {
    scope: "collection",
    collectionTitle,
    collectionDescription,
    grade,
    curriculum,
    groups,
    documentTitle: collectionTitle || "Learning resource",
  };
}

export function useLearnSubjectPrint() {
  const [printRequest, setPrintRequest] = useState(null);
  const [busy, setBusy] = useState(false);

  const clearPrint = useCallback(() => {
    setPrintRequest(null);
    setBusy(false);
  }, []);

  function requestPrint(config) {
    if (busy) return;
    setBusy(true);
    setPrintRequest(config);
  }

  return {
    printRequest,
    busy,
    requestPrint,
    clearPrint,
  };
}
