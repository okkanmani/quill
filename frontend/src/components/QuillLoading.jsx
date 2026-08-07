import { QuillMark } from "./QuillLogo";

const SIZE_CLASS = {
  sm: 28,
  md: 48,
  lg: 72,
  xl: 104,
};

/** Branded loading indicator — static frame, spinning nib. */
export default function QuillLoading({
  label = "Loading…",
  size = "md",
  className = "",
  fullscreen = false,
  page = false,
  showLabel = true,
}) {
  const resolvedSize = fullscreen || page ? "xl" : size;
  const markSize = SIZE_CLASS[resolvedSize] || SIZE_CLASS.md;

  const body = (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`.trim()}
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
        <p className="quill-loading-label">{label}</p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return <div className="quill-loading-screen">{body}</div>;
  }

  if (page) {
    return <div className="quill-loading-page">{body}</div>;
  }

  return body;
}
