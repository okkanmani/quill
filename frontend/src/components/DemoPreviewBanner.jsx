export default function DemoPreviewBanner({ blurb }) {
  if (!blurb) return null;

  return (
    <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
      <p className="font-semibold">Demo preview</p>
      <p className="mt-1 leading-relaxed">{blurb}</p>
    </div>
  );
}
