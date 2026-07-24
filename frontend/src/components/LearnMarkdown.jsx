import React from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import LearnFigure, { isLearnFigureElement } from "./LearnFigure";

/** Allow pasted draft images (data URLs) in preview; keep default sanitization elsewhere. */
function learnMarkdownUrlTransform(url) {
  const value = String(url || "");
  if (/^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(value)) {
    return value;
  }
  if (/^learn:pending:[a-f0-9-]+$/i.test(value)) {
    return value;
  }
  return defaultUrlTransform(value);
}

function buildMdComponents(eagerImages) {
  return {
    h2: ({ children }) => (
      <h2 className="text-lg font-bold text-slate-950 mt-8 mb-3 scroll-mt-44 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-bold text-slate-900 mt-6 mb-2 scroll-mt-44">
        {children}
      </h3>
    ),
    p: ({ children }) => {
      const kids = React.Children.toArray(children);
      if (kids.length === 1 && isLearnFigureElement(kids[0])) {
        return kids[0];
      }
      return (
        <p className="text-slate-900 text-sm leading-relaxed mb-4 last:mb-0">{children}</p>
      );
    },
    ul: ({ children }) => (
      <ul className="list-disc pl-5 mb-4 space-y-1.5 text-sm text-slate-900 leading-relaxed">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-sm text-slate-900 leading-relaxed">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="marker:text-slate-600">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-950">{children}</strong>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="font-semibold text-slate-800 underline decoration-indigo-400 underline-offset-2 hover:text-slate-950"
      >
        {children}
      </a>
    ),
    img: ({ src, alt, title }) => (
      <LearnFigure src={src} alt={alt} title={title} eager={eagerImages} />
    ),
    hr: () => <hr className="my-8 border-slate-200" />,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-slate-300 pl-4 my-4 text-slate-800 text-sm italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm text-left text-slate-900">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-100 text-slate-950 font-semibold">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    ),
    tr: ({ children }) => <tr className="hover:bg-slate-50/80">{children}</tr>,
    th: ({ children }) => (
      <th className="px-4 py-2.5 border-b border-slate-200">{children}</th>
    ),
    td: ({ children }) => <td className="px-4 py-2.5 align-top">{children}</td>,
    code: ({ className, children, inline, ...props }) => {
      if (inline) {
        return (
          <code
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] font-mono text-slate-900"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-4 p-4 rounded-xl border border-slate-200 bg-slate-50 overflow-x-auto text-xs font-mono text-slate-900 whitespace-pre">
        {children}
      </pre>
    ),
  };
}

export default function LearnMarkdown({ markdown, eagerImages = false }) {
  const components = React.useMemo(
    () => buildMdComponents(eagerImages),
    [eagerImages],
  );
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      urlTransform={learnMarkdownUrlTransform}
    >
      {markdown}
    </ReactMarkdown>
  );
}
