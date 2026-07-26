import { RESULTS_CATEGORY_TITLE } from "../resultsTypography";

/** Top-level grouping on the admin Results page. */
export default function ResultsPageCategory({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={RESULTS_CATEGORY_TITLE}>{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
