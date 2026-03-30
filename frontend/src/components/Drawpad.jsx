import { useRef, useEffect, useState } from "react";

const BG = "#000000";
const INK = "#ffffff";

export default function Drawpad() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [eraserMode, setEraserMode] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

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
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  }

  function draw(e) {
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
    e.preventDefault();
    drawing.current = false;
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-1 gap-2">
        <span className="text-amber-500 text-xs">Scratch pad</span>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setEraserMode((v) => !v)}
            className={`rounded-lg p-1.5 border transition ${
              eraserMode
                ? "bg-amber-200 border-amber-400 text-amber-900"
                : "bg-white border-amber-200 text-amber-600 hover:border-amber-300"
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
            onClick={clearCanvas}
            className="text-amber-400 text-xs underline"
          >
            Clear
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={350}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full rounded-xl border border-amber-200 touch-none"
        style={{ cursor: eraserMode ? "cell" : "crosshair" }}
      />
    </div>
  );
}
