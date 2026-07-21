import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import LearnResourceEditor from "../components/LearnResourceEditor";

export default function AdminLearnEdit() {
  const navigate = useNavigate();
  const { subjectKey, sectionId } = useParams();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
      mainClassName="pb-10"
    >
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Edit learning resource</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Update markdown on the left and preview changes on the right, then republish.
        </p>
        <LearnResourceEditor subjectKey={subjectKey} sectionId={sectionId} />
      </div>
    </AppShell>
  );
}
