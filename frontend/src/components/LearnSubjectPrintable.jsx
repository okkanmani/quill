import LearnMarkdown from "./LearnMarkdown";
import { formatLearnGradeCurriculum } from "../learnPrintGroups";

/** Full-section layout for print / Save as PDF (not line-paginated UI). */
export default function LearnSubjectPrintable({
  collectionTitle,
  collectionDescription,
  grade,
  curriculum,
  groups,
  scope = "collection",
}) {
  const groupList =
    groups?.length > 0 ? groups : [{ id: "", title: "", sections: [] }];

  const sectionOnly =
    scope === "section" &&
    groupList.length === 1 &&
    (groupList[0].sections || []).length === 1;

  if (sectionOnly) {
    const group = groupList[0];
    const section = group.sections[0];
    const gradeCurriculum = formatLearnGradeCurriculum(grade, curriculum);
    return (
      <article className="learn-print-document learn-md text-sm text-slate-900">
        <header className="mb-8 pb-6 border-b border-slate-200">
          {collectionTitle ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              {collectionTitle}
            </p>
          ) : null}
          {gradeCurriculum ? (
            <p className="text-sm text-slate-600 mb-2">{gradeCurriculum}</p>
          ) : null}
          {group.title ? (
            <p className="text-sm font-semibold text-slate-700 mb-2">{group.title}</p>
          ) : null}
          <h1 className="text-2xl font-bold text-slate-950">{section.title}</h1>
        </header>
        <LearnMarkdown markdown={section.markdown || ""} eagerImages />
      </article>
    );
  }

  return (
    <article className="learn-print-document learn-md text-sm text-slate-900">
      <header className="mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-950 mb-2">{collectionTitle}</h1>
        {collectionDescription ? (
          <p className="text-slate-700 leading-relaxed">{collectionDescription}</p>
        ) : null}
      </header>

      {groupList.map((group, gi) => (
        <div key={group.id || `print-group-${gi}`} className="mb-10 last:mb-0">
          {group.title ? (
            <h2 className="text-lg font-bold text-slate-950 mb-4 pb-2 border-b border-slate-200">
              {group.title}
            </h2>
          ) : null}
          <div className="space-y-8">
            {(group.sections || []).map((section) => (
              <section key={section.id}>
                {group.title ? (
                  <h3 className="text-base font-bold text-slate-950 mb-3">
                    {section.title}
                  </h3>
                ) : (
                  <h2 className="text-lg font-bold text-slate-950 mb-3">
                    {section.title}
                  </h2>
                )}
                <LearnMarkdown markdown={section.markdown || ""} eagerImages />
              </section>
            ))}
          </div>
        </div>
      ))}
    </article>
  );
}
