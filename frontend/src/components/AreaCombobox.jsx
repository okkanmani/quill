import { useEffect, useId, useMemo, useRef, useState } from "react";
import { listQuestionBankAreas } from "../api";

function buildDropdownItems(areas, nearMatches, caseVariant, trimmed) {
  const seen = new Set();
  const items = [];

  for (const area of areas) {
    const key = area.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ area, badge: null });
  }

  if (caseVariant && caseVariant !== trimmed) {
    const key = caseVariant.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ area: caseVariant, badge: "existing" });
    }
  }

  for (const area of nearMatches) {
    const key = area.toLowerCase();
    if (key === trimmed.toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    items.push({ area, badge: "similar" });
  }

  return items;
}

function AreaBadge({ badge }) {
  if (!badge) return null;
  const label = badge === "similar" ? "Similar" : "Existing";
  return (
    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
      {label}
    </span>
  );
}

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

  const trimmed = value.trim();
  const dropdownItems = useMemo(
    () => buildDropdownItems(suggestions, nearMatches, caseVariant, trimmed),
    [suggestions, nearMatches, caseVariant, trimmed],
  );

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
          const items = buildDropdownItems(areas, near, variant, value.trim());
          setActiveIndex(items.length ? 0 : -1);
        })
        .catch(() => {
          setSuggestions([]);
          setNearMatches([]);
          setCaseVariant(null);
          setActiveIndex(-1);
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
    if (!open || !dropdownItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % dropdownItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? dropdownItems.length - 1 : prev - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(dropdownItems[activeIndex].area);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showList = open && subject && (loading || dropdownItems.length > 0);

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
            dropdownItems.map((item, index) => (
              <li
                key={`${item.badge || "match"}-${item.area}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(item.area)}
                  className={`w-full px-3 py-2 text-left text-sm transition flex items-center justify-between gap-2 ${
                    index === activeIndex
                      ? "bg-indigo-50 text-indigo-900"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0 truncate">{item.area}</span>
                  <AreaBadge badge={item.badge} />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {!subject ? (
        <p className="mt-1 text-xs text-slate-500">Choose a subject first.</p>
      ) : null}
      {subject && open && !loading && trimmed && !dropdownItems.length ? (
        <p className="mt-1 text-xs text-slate-500">
          No matching areas — type a new topic name.
        </p>
      ) : null}
    </div>
  );
}
