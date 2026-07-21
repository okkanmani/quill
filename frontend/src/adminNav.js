/** Primary admin navigation — add entries here as new sections ship. */
export const ADMIN_MAIN_NAV = [
  { to: "/admin", label: "Home", end: true },
  { to: "/admin/results", label: "Results", end: true },
  { to: "/admin/analysis", label: "Analysis", end: true },
  { to: "/admin/worksheets", label: "Worksheets", end: false },
  { to: "/admin/question-bank", label: "Question bank", end: true },
  { to: "/admin/create", label: "Create", end: false },
  { to: "/admin/students", label: "Students", end: true },
  { to: "/admin/settings", label: "Settings", end: true },
  { to: "/student/learn", label: "Learn", end: false },
];

/** Student home + learn shell — same visual group as admin nav in AppHeader. */
export const STUDENT_MAIN_NAV = [
  { to: "/student", label: "Your Worksheets", end: true },
  { to: "/student/writing", label: "Writing", end: true },
  { to: "/student/results", label: "Your Results", end: true },
  { to: "/student/learn", label: "Learning Resources", end: false },
  { to: "/student/settings", label: "Settings", end: true },
];

/** Student nav with Latest, Revision, and Tests tabs (disabled when empty). */
export function buildStudentNavLinks(hasLatest, hasRevision = false, hasTests = false) {
  return [
    { to: "/student", label: "Your Worksheets", end: true },
    { to: "/student/writing", label: "Writing", end: true },
    { to: "/student/results", label: "Your Results", end: true },
    {
      to: "/student/latest",
      label: "Latest",
      end: true,
      disabled: !hasLatest,
    },
    {
      to: "/student/revision",
      label: "Revision",
      end: true,
      disabled: !hasRevision,
    },
    {
      to: "/student/tests",
      label: "Tests",
      end: true,
      disabled: !hasTests,
    },
    { to: "/student/learn", label: "Learning Resources", end: false },
    { to: "/student/settings", label: "Settings", end: true },
  ];
}
