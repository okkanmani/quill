import AdminStudentBanner from "./AdminStudentBanner";

/**
 * When no student is selected, shows only the selection banner (centered).
 * Otherwise renders page content for the selected student.
 */
export default function AdminStudentGate({ context = "results", children }) {
  const current = localStorage.getItem("studentName") || "";
  if (!current) {
    return (
      <div className="flex min-h-[calc(100vh-11rem)] items-center justify-center px-4 py-10">
        <AdminStudentBanner context={context} centered />
      </div>
    );
  }
  return children;
}
