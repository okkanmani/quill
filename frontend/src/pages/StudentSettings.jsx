import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import AppShell from "../components/AppShell";
import ColorThemeSettings from "../components/ColorThemeSettings";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentSettings() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { navLinks } = useStudentNavLinks();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell navLinks={navLinks} trailing={`Hi, ${name}!`} onLogout={handleLogout}>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Settings</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Personalize how Quill looks on this device.
        </p>

        <ColorThemeSettings />
      </div>
    </AppShell>
  );
}
