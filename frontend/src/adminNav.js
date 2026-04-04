/** Primary admin navigation — add entries here as new sections ship. */
export const ADMIN_MAIN_NAV = [
  { to: "/admin", label: "Results", end: true },
  { to: "/admin/worksheets", label: "Worksheets", end: false },
  { to: "/student/learn", label: "Learn", end: false },
];

/** Student home + learn shell — same visual group as admin nav in AppHeader. */
export const STUDENT_MAIN_NAV = [
  { to: "/student", label: "Your Worksheets", end: true },
  { to: "/student/learn", label: "Learning Resources", end: false },
];
