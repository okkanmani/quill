import { useEffect, useId, useRef, useState } from "react";
import { listQuestionBankAreas } from "../api";

export default function AreaCombobox({
  subject,
  value,
  onChange,
  disabled = false,
  placeholder = "e.g. fractions, algebra",
  className = "",
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const debounceRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [nearMatches, setNearMatches] = useState([]);
  const [caseVariant, setCaseVariant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!subject || !open) return undefined;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      listQuestionBankAreas({ subject, q: value })
        .then(({ areas, nearMatches: near, caseVariant: variant }) => {
          setSuggestions(areas);
          setNearMatches(near);
          setCaseVariant(variant);
          setActiveIndex(areas.length ? 0 : -1);
        })
        .catch(() => {
          setSuggestions([]);
          setNearMatches([]);
          setCaseVariant(null);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [subject, value, open]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectSuggestion(area) {
    onChange(area);
    setOpen(false);
    setActiveIndex(-1);
    setNearMatches([]);
    setCaseVariant(null);
  }

  function handleKeyDown(event) {
    if (!open || !suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const trimmed = value.trim();
  const showList = open && subject && (loading || suggestions.length > 0);
  const showCaseVariant = Boolean(trimmed && caseVariant && caseVariant !== trimmed);
  const filteredNearMatches = nearMatches.filter(
    (area) => area.toLowerCase() !== trimmed.toLowerCase(),
  );
  const showNearMatches = trimmed && filteredNearMatches.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        disabled={disabled || !subject}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Looking up areas…</li>
          ) : (
            suggestions.map((area, index) => (
              <li key={area} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(area)}
                  className={`w-full px-3 py-2 text-left text-sm transition ${
                    index === activeIndex
                      ? "bg-indigo-50 text-indigo-900"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {area}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {!subject ? (
        <p className="mt-1 text-xs text-slate-500">Choose a subject first.</p>
      ) : null}
      {showCaseVariant ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="font-medium">{caseVariant}</span> already exists with different
          capitalization.{" "}
          <button
            type="button"
            onClick={() => selectSuggestion(caseVariant)}
            className="font-semibold text-amber-900 underline hover:text-amber-950"
          >
            Use existing
          </button>
        </div>
      ) : null}
      {showNearMatches ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-medium mb-1.5">Similar areas already in the bank:</p>
          <div className="flex flex-wrap gap-1.5">
            {filteredNearMatches.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => selectSuggestion(area)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100 transition"
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {subject && open && !loading && trimmed && !suggestions.length && !showNearMatches && !showCaseVariant ? (
        <p className="mt-1 text-xs text-slate-500">
          No matching areas — type a new topic name.
        </p>
      ) : null}
    </div>
  );
}
