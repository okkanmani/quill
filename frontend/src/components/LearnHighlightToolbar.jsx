import { LEARN_HIGHLIGHT_COLORS } from "../learnHighlightUtils";

export default function LearnHighlightToolbar({
  activeColor,
  onActiveColorChange,
  eraserActive,
  onEraserActiveChange,
  disabled = false,
  disabledHint = "",
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1.5${disabled ? " opacity-70" : ""}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Highlight
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {LEARN_HIGHLIGHT_COLORS.map((color) => {
          const selected = !eraserActive && activeColor === color.id;
          return (
            <button
              key={color.id}
              type="button"
              disabled={disabled}
              aria-label={`${color.label} highlight`}
              title={`${color.label} highlight`}
              aria-pressed={selected}
              onClick={() => {
                onEraserActiveChange(false);
                onActiveColorChange(color.id);
              }}
              className={`h-6 w-6 rounded-full border border-slate-300/80 ${color.swatchClass} transition disabled:cursor-not-allowed ${
                selected ? "ring-2 ring-offset-1" : "hover:scale-105"
              }`}
            />
          );
        })}
        <button
          type="button"
          disabled={disabled}
          aria-label="Eraser"
          title="Remove highlight"
          aria-pressed={eraserActive}
          onClick={() => onEraserActiveChange(!eraserActive)}
          className={`ml-1 inline-flex h-7 items-center rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed ${
            eraserActive
              ? "border-slate-800 bg-slate-800 text-white"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Eraser
        </button>
      </div>
      {disabled && disabledHint ? (
        <span className="text-[10px] text-slate-500 leading-snug">{disabledHint}</span>
      ) : null}
    </div>
  );
}
