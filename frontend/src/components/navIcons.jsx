/** Outline icons for AppShell sidebar nav (stroke matches app controls). */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function IconResults(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M22 20H2" />
    </svg>
  );
}

function IconAnalysis(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-5 4 3 5-7" />
    </svg>
  );
}

function IconWorksheets(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

function IconQuestionBank(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  );
}

function IconCreate(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconStudents(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettings(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconLearn(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M12 21V7" />
      <path d="M12 7c-1.5-2.5-4-4-7-4v14c3 0 5.5 1.5 7 4" />
      <path d="M12 7c1.5-2.5 4-4 7-4v14c-3 0-5.5 1.5-7 4" />
    </svg>
  );
}

function IconWriting(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconLatest(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19h14" />
      <path d="M8 22h8" />
    </svg>
  );
}

function IconRevision(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function IconTests(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

const EXACT = {
  "/admin": IconHome,
  "/admin/results": IconResults,
  "/admin/analysis": IconAnalysis,
  "/admin/worksheets": IconWorksheets,
  "/admin/question-bank": IconQuestionBank,
  "/admin/create": IconCreate,
  "/admin/students": IconStudents,
  "/admin/settings": IconSettings,
  "/student": IconHome,
  "/student/worksheets": IconWorksheets,
  "/student/writing": IconWriting,
  "/student/results": IconResults,
  "/student/latest": IconLatest,
  "/student/revision": IconRevision,
  "/student/tests": IconTests,
  "/student/learn": IconLearn,
  "/student/settings": IconSettings,
};

function normalizeNavPath(to) {
  const raw = (to || "").split("?")[0].replace(/\/+$/, "");
  if (!raw) return "/";
  return raw;
}

export function getNavIconComponent(to) {
  const path = normalizeNavPath(to);
  if (EXACT[path]) return EXACT[path];
  if (path.startsWith("/admin/create")) return IconCreate;
  if (path.startsWith("/admin/worksheets")) return IconWorksheets;
  if (path.startsWith("/student/learn")) return IconLearn;
  return IconWorksheets;
}

export function NavItemIcon({ to, className = "w-[18px] h-[18px] shrink-0" }) {
  const Icon = getNavIconComponent(to);
  return <Icon className={className} />;
}
