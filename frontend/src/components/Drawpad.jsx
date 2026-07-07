import { useRef, useEffect, useState, useCallback } from "react";

const BG = "#000000";
const INK = "#ffffff";

function paintBackground(ctx, canvas) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export default function Drawpad({
  value = "",
  onChange,
  disabled = false,
  showHeading = true,
  className = "mt-4",
  canvasHeight = 350,
} = {}) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const loadedValue = useRef(null);
  const [eraserMode, setEraserMode] = useState(false);

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

  function startDrawing(e) {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  }

  function draw(e) {
    if (disabled) return;
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = eraserMode ? BG : INK;
    ctx.lineWidth = eraserMode ? 28 : 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  }

  function stopDrawing(e) {
    if (disabled) return;
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    emitChange();
  }

  function clearCanvas() {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    paintBackground(ctx, canvas);
    emitChange();
  }

  return (
    <div className={className}>
      {showHeading ? (
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-indigo-500 text-xs">Scratch pad</span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEraserMode((v) => !v)}
              className={`rounded-lg p-1.5 border transition disabled:opacity-50 ${
                eraserMode
                  ? "bg-slate-200 border-indigo-400 text-slate-900"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              aria-pressed={eraserMode}
              aria-label={eraserMode ? "Switch to pen" : "Eraser"}
              title={eraserMode ? "Switch to pen" : "Eraser"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M16.24 3.56l4.95 4.95c.78.78.78 2.05 0 2.83L8.48 21.6a1.99 1.99 0 0 1-2.83 0L1.7 17.66c-.78-.78-.78-2.05 0-2.83L13.41 3.56a2 2 0 0 1 2.83 0zM4.22 15.22l2.56 2.56 8.49-8.49-2.56-2.56-8.49 8.49z" />
              </svg>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearCanvas}
              className="text-slate-500 text-xs underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      <div className="relative">
        {!showHeading ? (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 shadow-sm">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEraserMode((v) => !v)}
              className={`rounded-lg p-1.5 border transition disabled:opacity-50 ${
                eraserMode
                  ? "bg-slate-200 border-indigo-400 text-slate-900"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              aria-pressed={eraserMode}
              aria-label={eraserMode ? "Switch to pen" : "Eraser"}
              title={eraserMode ? "Switch to pen" : "Eraser"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M16.24 3.56l4.95 4.95c.78.78.78 2.05 0 2.83L8.48 21.6a1.99 1.99 0 0 1-2.83 0L1.7 17.66c-.78-.78-.78-2.05 0-2.83L13.41 3.56a2 2 0 0 1 2.83 0zM4.22 15.22l2.56 2.56 8.49-8.49-2.56-2.56-8.49 8.49z" />
              </svg>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearCanvas}
              className="text-slate-500 text-xs underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          width={800}
          height={canvasHeight}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full rounded-xl border border-slate-200 touch-none ${
            disabled ? "opacity-80" : ""
          }`}
          style={{ cursor: disabled ? "default" : eraserMode ? "cell" : "crosshair" }}
        />
      </div>
    </div>
  );
}
