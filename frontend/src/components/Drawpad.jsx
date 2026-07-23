import { useRef, useEffect, useState, useCallback } from "react";

const BG = "#000000";
const INK = "#ffffff";
const TEXT_FONT = "24px system-ui, sans-serif";
const TEXT_LINE_HEIGHT = 28;
const MAX_CANVAS_HEIGHT = 1000;
const MIN_CANVAS_HEIGHT = 200;

function paintBackground(ctx, canvas) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function TextToolIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 4h14v3h-5v13h-4V7H5V4z" />
    </svg>
  );
}

function EraserIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.24 3.56l4.95 4.95c.78.78.78 2.05 0 2.83L8.48 21.6a1.99 1.99 0 0 1-2.83 0L1.7 17.66c-.78-.78-.78-2.05 0-2.83L13.41 3.56a2 2 0 0 1 2.83 0zM4.22 15.22l2.56 2.56 8.49-8.49-2.56-2.56-8.49 8.49z" />
    </svg>
  );
}

function PenIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function toolButtonClass(active) {
  return `rounded-lg p-1.5 border transition disabled:opacity-50 ${
    active
      ? "bg-slate-200 border-indigo-400 text-slate-900"
      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
  }`;
}

export default function Drawpad({
  value = "",
  onChange,
  disabled = false,
  showHeading = true,
  showTextTool = false,
  className = "mt-4",
  canvasHeight = 350,
  fillHeight = false,
} = {}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textInputRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const loadedValue = useRef(null);
  const [tool, setTool] = useState("pen");
  const [textDraft, setTextDraft] = useState(null);
  const effectiveHeight = Math.min(
    MAX_CANVAS_HEIGHT,
    Math.max(MIN_CANVAS_HEIGHT, Number(canvasHeight) || 350),
  );

  const emitChange = useCallback(() => {
    if (!onChange || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    loadedValue.current = data;
    onChange(data);
  }, [onChange, disabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (value && value === loadedValue.current) {
      return;
    }

    setTextDraft(null);

    if (!value) {
      paintBackground(ctx, canvas);
      loadedValue.current = "";
      return;
    }

    loadedValue.current = value;
    const img = new Image();
    img.onload = () => {
      paintBackground(ctx, canvas);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const saved = loadedValue.current;
    if (saved) {
      const img = new Image();
      img.onload = () => {
        paintBackground(ctx, canvas);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = saved;
      return;
    }
    paintBackground(ctx, canvas);
  }, [effectiveHeight]);

  useEffect(() => {
    if (textDraft && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textDraft]);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function commitTextDraft() {
    if (!textDraft) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const valueText = textDraft.value.trim();
    if (valueText) {
      const ctx = canvas.getContext("2d");
      ctx.font = TEXT_FONT;
      ctx.fillStyle = INK;
      ctx.textBaseline = "top";
      valueText.split("\n").forEach((line, index) => {
        ctx.fillText(line, textDraft.x, textDraft.y + index * TEXT_LINE_HEIGHT);
      });
      emitChange();
    }
    setTextDraft(null);
  }

  function cancelTextDraft() {
    setTextDraft(null);
  }

  function selectTool(nextTool) {
    if (nextTool !== "text") {
      commitTextDraft();
    }
    setTool(nextTool);
  }

  function toggleEraser() {
    commitTextDraft();
    setTool((current) => (current === "eraser" ? "pen" : "eraser"));
  }

  function placeText(e) {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const pos = getPos(e, canvas);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const containerRect = container.getBoundingClientRect();

    setTextDraft({
      x: pos.x,
      y: pos.y,
      left: clientX - containerRect.left,
      top: clientY - containerRect.top,
      value: "",
    });
  }

  function handleCanvasDown(e) {
    if (disabled) return;
    if (showTextTool && tool === "text") {
      e.preventDefault();
      if (textDraft) {
        commitTextDraft();
      }
      placeText(e);
      return;
    }
    startDrawing(e);
  }

  function startDrawing(e) {
    if (disabled || tool === "text") return;
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  }

  function draw(e) {
    if (disabled || tool === "text") return;
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? BG : INK;
    ctx.lineWidth = tool === "eraser" ? 28 : 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  }

  function stopDrawing(e) {
    if (disabled || tool === "text") return;
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    emitChange();
  }

  function clearCanvas() {
    if (disabled) return;
    cancelTextDraft();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    paintBackground(ctx, canvas);
    emitChange();
  }

  function renderToolbar(compact) {
    return (
      <div
        className={
          compact
            ? "absolute top-2 right-2 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 shadow-sm"
            : "flex items-center gap-3 shrink-0"
        }
      >
        {showTextTool ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => selectTool("pen")}
              className={toolButtonClass(tool === "pen")}
              aria-pressed={tool === "pen"}
              aria-label="Pen"
              title="Pen"
            >
              <PenIcon />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => selectTool("eraser")}
              className={toolButtonClass(tool === "eraser")}
              aria-pressed={tool === "eraser"}
              aria-label="Eraser"
              title="Eraser"
            >
              <EraserIcon />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => selectTool("text")}
              className={toolButtonClass(tool === "text")}
              aria-pressed={tool === "text"}
              aria-label="Text"
              title="Text"
            >
              <TextToolIcon />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={toggleEraser}
            className={toolButtonClass(tool === "eraser")}
            aria-pressed={tool === "eraser"}
            aria-label={tool === "eraser" ? "Switch to pen" : "Eraser"}
            title={tool === "eraser" ? "Switch to pen" : "Eraser"}
          >
            <EraserIcon />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={clearCanvas}
          className="text-slate-500 text-xs underline disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    );
  }

  const canvasCursor = disabled
    ? "default"
    : tool === "text"
      ? "text"
      : tool === "eraser"
        ? "cell"
        : "crosshair";

  return (
    <div className={`${className}${fillHeight ? " h-full" : ""}`}>
      {showHeading ? (
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-indigo-500 text-xs">Scratch pad</span>
          {renderToolbar(false)}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={`relative overflow-hidden${fillHeight ? " h-full" : ""}`}
      >
        {!showHeading ? renderToolbar(true) : null}
        <canvas
          ref={canvasRef}
          width={800}
          height={effectiveHeight}
          onMouseDown={handleCanvasDown}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleCanvasDown}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full rounded-xl border border-slate-700 touch-none bg-black ${
            disabled ? "opacity-80" : ""
          }`}
          style={{
            cursor: canvasCursor,
            backgroundColor: BG,
            maxHeight: MAX_CANVAS_HEIGHT,
            ...(fillHeight
              ? { height: effectiveHeight, width: "100%", display: "block" }
              : null),
          }}
        />
        {textDraft ? (
          <textarea
            ref={textInputRef}
            value={textDraft.value}
            onChange={(e) =>
              setTextDraft((draft) => ({ ...draft, value: e.target.value }))
            }
            onBlur={commitTextDraft}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelTextDraft();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitTextDraft();
              }
            }}
            rows={1}
            placeholder="Type here"
            className="absolute z-20 min-w-[8rem] max-w-[min(20rem,90%)] resize-none rounded border border-dashed border-white/80 bg-black/80 px-2 py-1 text-sm leading-relaxed text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            style={{
              left: textDraft.left,
              top: textDraft.top,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
