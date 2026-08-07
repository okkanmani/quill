import { QuillMark } from "./QuillLogo";

const SIZE_CLASS = {
  sm: 28,
  md: 48,
  lg: 72,
};

/** Branded loading indicator — static frame, spinning nib. */
export default function QuillLoading({
  label = "Loading…",
  size = "md",
  className = "",
  fullscreen = false,
  showLabel = true,
}) {
  const markSize = SIZE_CLASS[size] || SIZE_CLASS.md;

  const body = (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-slate-800 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <QuillMark
        size={markSize}
        animateNib
        className="select-none"
      />
      {showLabel && label ? (
        <p className="text-slate-600 text-sm">{label}</p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        {body}
      </div>
    );
  }

  return body;
}
