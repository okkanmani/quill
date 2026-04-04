import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdComponents = {
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-amber-950 mt-8 mb-3 scroll-mt-44 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold text-amber-900 mt-6 mb-2 scroll-mt-44">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-amber-900 text-sm leading-relaxed mb-4 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-4 space-y-1.5 text-sm text-amber-900 leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-sm text-amber-900 leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="marker:text-amber-600">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-amber-950">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-semibold text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-amber-200" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-300 pl-4 my-4 text-amber-800 text-sm italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-5 rounded-xl border border-amber-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left text-amber-900">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-amber-100 text-amber-950 font-semibold">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-amber-100">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-amber-50/80">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 border-b border-amber-200">{children}</th>
  ),
  td: ({ children }) => <td className="px-4 py-2.5 align-top">{children}</td>,
  code: ({ className, children, inline, ...props }) => {
    if (inline) {
      return (
        <code
          className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.85em] font-mono text-amber-900"
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
    <pre className="my-4 p-4 rounded-xl border border-amber-200 bg-amber-50 overflow-x-auto text-xs font-mono text-amber-900 whitespace-pre">
      {children}
    </pre>
  ),
};

export default function LearnMarkdown({ markdown }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {markdown}
    </ReactMarkdown>
  );
}
