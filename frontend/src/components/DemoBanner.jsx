import { IS_DEMO_MODE } from "../demoMode";

export default function DemoBanner() {
  if (!IS_DEMO_MODE) return null;

  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 shadow-sm">
      <p className="font-semibold">Demo environment</p>
      <p className="mt-1 leading-relaxed text-indigo-900/90">
        Explore with the sample accounts below. Worksheets, learn resources, and
        results are live; areas marked Preview are read-only.
      </p>
      <p className="mt-2 text-xs font-medium text-indigo-800/90">
        Admin: <span className="font-semibold">demo</span> /{" "}
        <span className="font-semibold">quill-demo</span>
        {" · "}
        Student: admin <span className="font-semibold">demo</span>, name{" "}
        <span className="font-semibold">Alex</span> or{" "}
        <span className="font-semibold">Sam</span>, password{" "}
        <span className="font-semibold">quill-demo</span>
      </p>
    </div>
  );
}
