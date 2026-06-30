const COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

function ChartLegend({ labels, values }) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-slate-700">
      {labels.map((label, i) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
            aria-hidden
          />
          <span>
            {label}
            {total > 0 ? (
              <span className="text-slate-500 tabular-nums">
                {" "}
                ({values[i]}
                {total > 0 && values.length <= 8
                  ? ` · ${Math.round((values[i] / total) * 100)}%`
                  : ""}
                )
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BarChart({ labels, values, xLabel, yLabel }) {
  const max = Math.max(...values, 1);
  const w = 360;
  const h = 200;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const gap = innerW / values.length;
  const barW = Math.min(40, gap * 0.65);

  return (
    <figure className="w-full" aria-label="Bar chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-lg mx-auto text-slate-600"
        role="img"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          const val = Math.round(max * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {val}
              </text>
            </g>
          );
        })}
        {values.map((v, i) => {
          const barH = (v / max) * innerH;
          const x = padL + gap * i + (gap - barW) / 2;
          const y = padT + innerH - barH;
          return (
            <g key={labels[i]}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="3"
                fill={COLORS[i % COLORS.length]}
              />
              <text
                x={x + barW / 2}
                y={h - padB + 14}
                textAnchor="middle"
                fontSize="10"
                fill="#334155"
              >
                {labels[i].length > 8 ? `${labels[i].slice(0, 7)}…` : labels[i]}
              </text>
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#0f172a"
              >
                {v}
              </text>
            </g>
          );
        })}
        {yLabel ? (
          <text
            x={12}
            y={padT + innerH / 2}
            textAnchor="middle"
            fontSize="10"
            fill="#64748b"
            transform={`rotate(-90 12 ${padT + innerH / 2})`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
      {xLabel ? (
        <p className="text-center text-xs text-slate-500 mt-1">{xLabel}</p>
      ) : null}
      <ChartLegend labels={labels} values={values} />
    </figure>
  );
}

function LineChart({ labels, values, xLabel, yLabel }) {
  const max = Math.max(...values, 1);
  const w = 360;
  const h = 200;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = padL + step * i;
    const y = padT + innerH - (v / max) * innerH;
    return { x, y, v, label: labels[i] };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <figure className="w-full" aria-label="Line graph">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-lg mx-auto text-slate-600"
        role="img"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          const val = Math.round(max * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {val}
              </text>
            </g>
          );
        })}
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="#fff" strokeWidth="1.5" />
            <text
              x={p.x}
              y={h - padB + 14}
              textAnchor="middle"
              fontSize="10"
              fill="#334155"
            >
              {p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label}
            </text>
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#0f172a"
            >
              {p.v}
            </text>
          </g>
        ))}
        {yLabel ? (
          <text
            x={12}
            y={padT + innerH / 2}
            textAnchor="middle"
            fontSize="10"
            fill="#64748b"
            transform={`rotate(-90 12 ${padT + innerH / 2})`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
      {xLabel ? (
        <p className="text-center text-xs text-slate-500 mt-1">{xLabel}</p>
      ) : null}
      <ChartLegend labels={labels} values={values} />
    </figure>
  );
}

function PieChart({ labels, values }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = 100;
  const cy = 100;
  const r = 72;
  let angle = -90;

  const slices = values.map((v, i) => {
    const sweep = (v / total) * 360;
    const start = angle;
    angle += sweep;
    const end = angle;
    const large = sweep > 180 ? 1 : 0;
    const rad = (deg) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(start));
    const y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(end));
    const y2 = cy + r * Math.sin(rad(end));
    const d =
      sweep >= 359.99
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, color: COLORS[i % COLORS.length], label: labels[i], v };
  });

  return (
    <figure className="w-full" aria-label="Pie chart">
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[220px] mx-auto"
        role="img"
      >
        {slices.map((s) => (
          <path key={s.label} d={s.d} fill={s.color} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <ChartLegend labels={labels} values={values} />
    </figure>
  );
}

export default function WorksheetPassageChart({ chart }) {
  if (!chart?.type || !Array.isArray(chart.labels) || !Array.isArray(chart.values)) {
    return null;
  }
  const { type, labels, values, xLabel, yLabel, title } = chart;
  if (labels.length === 0 || labels.length !== values.length) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 mt-3">
      {title ? (
        <p className="text-sm font-semibold text-slate-800 text-center mb-3">{title}</p>
      ) : null}
      {type === "bar" ? (
        <BarChart labels={labels} values={values} xLabel={xLabel} yLabel={yLabel} />
      ) : null}
      {type === "line" ? (
        <LineChart labels={labels} values={values} xLabel={xLabel} yLabel={yLabel} />
      ) : null}
      {type === "pie" ? <PieChart labels={labels} values={values} /> : null}
      {type !== "bar" && type !== "line" && type !== "pie" ? (
        <p className="text-sm text-red-600">Unsupported chart type: {type}</p>
      ) : null}
    </div>
  );
}
