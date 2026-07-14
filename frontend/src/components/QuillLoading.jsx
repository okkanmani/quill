const SIZE_CLASS = {
  sm: "text-2xl leading-none",
  md: "text-4xl leading-none",
  lg: "text-6xl leading-none",
};

/** Branded loading indicator using the Quill feather mark. */
export default function QuillLoading({
  label = "Loading…",
  size = "md",
  className = "",
  fullscreen = false,
  showLabel = true,
}) {
  const body = (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        aria-hidden="true"
        className={`quill-loading select-none ${SIZE_CLASS[size] || SIZE_CLASS.md}`}
      >
        🪶
      </span>
      {showLabel && label ? (
        <p className="text-slate-600 text-sm">{label}</p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-6">
        {body}
      </div>
    );
  }

  return body;
}
