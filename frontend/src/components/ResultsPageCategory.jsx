/** Top-level grouping on the admin Results page. */
export default function ResultsPageCategory({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
