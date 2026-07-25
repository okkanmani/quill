import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getAdminSettings, logout, saveAdminPreferences } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import ExpertJsonWarningDialog from "../components/ExpertJsonWarningDialog";

const CREATE_TABS = [
  { to: "/admin/create/worksheet", label: "Worksheet builder" },
  { to: "/admin/create/test", label: "Test builder" },
  { to: "/admin/create/learn", label: "Learning resource" },
  { to: "/admin/create/upload", label: "Upload JSON", expertGate: true },
];

export default function AdminCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWideBuilder = /\/admin\/create\/(worksheet|test|learn|upload)/.test(
    location.pathname,
  );
  const onUploadRoute = /\/admin\/create\/upload\/?$/.test(location.pathname);

  const [expertWarningEnabled, setExpertWarningEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [uploadExpertAcknowledged, setUploadExpertAcknowledged] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [savingExpertPref, setSavingExpertPref] = useState(false);

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setExpertWarningEnabled(data.expert_json_warning_enabled !== false);
      })
      .catch(() => {
        setExpertWarningEnabled(true);
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (!onUploadRoute) {
      setUploadExpertAcknowledged(false);
      setDontShowAgain(false);
    }
  }, [onUploadRoute]);

  const showExpertDialog =
    settingsLoaded &&
    expertWarningEnabled &&
    onUploadRoute &&
    !uploadExpertAcknowledged;

  const uploadContentBlocked =
    onUploadRoute &&
    (!settingsLoaded || (expertWarningEnabled && !uploadExpertAcknowledged));

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  function openUploadTab() {
    navigate("/admin/create/upload");
  }

  function handleExpertCancel() {
    setDontShowAgain(false);
    navigate("/admin/create/worksheet");
  }

  async function handleExpertContinue() {
    if (dontShowAgain) {
      setSavingExpertPref(true);
      try {
        await saveAdminPreferences({ expert_json_warning_enabled: false });
        setExpertWarningEnabled(false);
      } catch {
        // Still allow entry; preference save can be retried in Settings.
      } finally {
        setSavingExpertPref(false);
      }
    }
    setUploadExpertAcknowledged(true);
    setDontShowAgain(false);
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
      mainClassName="pb-28"
    >
      <ExpertJsonWarningDialog
        open={showExpertDialog}
        dontShowAgain={dontShowAgain}
        onDontShowAgainChange={setDontShowAgain}
        onCancel={handleExpertCancel}
        onContinue={handleExpertContinue}
        continuing={savingExpertPref}
      />

      <div className={isWideBuilder ? "max-w-none" : "max-w-3xl mx-auto"}>
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Create</h1>
        <p className="text-slate-600 text-sm mb-5 leading-relaxed">
          Build worksheets and adaptive tests, upload JSON, or generate learning resources for students.
        </p>

        <nav
          className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3"
          aria-label="Create sections"
        >
          {CREATE_TABS.map((tab) => {
            if (tab.expertGate && expertWarningEnabled) {
              const isActive = onUploadRoute;
              return (
                <button
                  key={tab.to}
                  type="button"
                  onClick={openUploadTab}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            }
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        {uploadContentBlocked ? null : <Outlet />}
      </div>
    </AppShell>
  );
}
