import WorksheetPassageChart from "./WorksheetPassageChart";

function PassageTable({ table }) {
  const headers = table?.headers;
  const rows = table?.rows;
  if (!Array.isArray(headers) || headers.length === 0 || !Array.isArray(rows)) {
    return null;
  }
  return (
    <div className="overflow-x-auto mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left text-slate-900">
        <thead className="bg-slate-100 text-slate-950 font-semibold">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 border-b border-slate-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50/80">
              {(Array.isArray(row) ? row : []).map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 align-top tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WorksheetPassageContent({ passage }) {
  const body = passage.body ?? passage.text ?? "";
  const hasChart = passage.chart?.type && passage.chart?.labels?.length;
  const hasTable = passage.table?.headers?.length;
  const icon = hasChart ? "📊" : "📖";

  return (
    <div className="sticky top-4 z-10 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-slate-800 font-semibold text-base mb-3">
        {icon} {passage.title}
      </p>
      {body.trim() ? (
        <p className="text-slate-900 text-sm leading-relaxed whitespace-pre-line">
          {body}
        </p>
      ) : null}
      {hasTable ? <PassageTable table={passage.table} /> : null}
      {hasChart ? <WorksheetPassageChart chart={passage.chart} /> : null}
    </div>
  );
}
