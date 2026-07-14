const SIZE_CLASS = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

/** Branded loading indicator using the Quill logo. */
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
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        className={`quill-loading ${SIZE_CLASS[size] || SIZE_CLASS.md}`}
      />
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
