import { useState } from "react";
import { NavLink, matchPath, useLocation } from "react-router-dom";
import { decorateNavLinksForDemo, getDemoPreviewForPath } from "../demoMode";
import { getShellFooterLines } from "../adminSession";
import ShellLayoutContext from "./ShellLayoutContext";
import DemoBanner from "./DemoBanner";
import DemoPreviewBanner from "./DemoPreviewBanner";
import {
  getStoredSidebarCollapsed,
  setStoredSidebarCollapsed,
} from "../sidebarUtils";
import { NavItemIcon } from "./navIcons";
import QuillLogo from "./QuillLogo";

const navItemInnerClass = "flex items-center gap-2.5 min-w-0";

function NavItemLabel({ to, label }) {
  return (
    <span className={navItemInnerClass}>
      <NavItemIcon to={to} className="w-[18px] h-[18px] shrink-0 opacity-90" />
      <span className="truncate">{label}</span>
    </span>
  );
}

const backPillClass =
  "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold bg-indigo-700 text-white hover:bg-indigo-800 border border-indigo-800 shadow-sm transition";

const SIDEBAR_WIDTH_CLASS = "w-52";
const SIDEBAR_COLLAPSED_WIDTH_CLASS = "w-14";

function SidebarNav({ navLinks, compact = false }) {
  const { pathname } = useLocation();

  const itemPad = compact ? "p-2" : "px-3 py-2.5";
  const iconWrap = compact
    ? "flex items-center justify-center w-10 h-10 mx-auto rounded-lg"
    : "block rounded-lg";

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main sections">
      {navLinks.map(({ to, label, end, disabled, demoPreview }) => {
        const isActive = matchPath({ path: to, end: end ?? false }, pathname);
        const disabledTitle =
          "No new worksheets in the last 14 days (or all are done)";

        if (disabled) {
          return (
            <span
              key={to}
              aria-disabled="true"
              aria-label={compact ? label : undefined}
              title={disabledTitle}
              className={`${iconWrap} ${itemPad} text-sm font-medium text-slate-400 cursor-not-allowed select-none`}
            >
              {compact ? (
                <NavItemIcon
                  to={to}
                  className="w-[18px] h-[18px] shrink-0 opacity-50"
                />
              ) : (
                <span className={navItemInnerClass}>
                  <NavItemIcon
                    to={to}
                    className="w-[18px] h-[18px] shrink-0 opacity-50"
                  />
                  <span className="truncate">{label}</span>
                </span>
              )}
            </span>
          );
        }
        const previewBadge = demoPreview ? (
          <span className="ml-auto shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            Preview
          </span>
        ) : null;
        if (isActive) {
          return (
            <span
              key={to}
              title={compact ? label : undefined}
              aria-label={compact ? label : undefined}
              className={`${iconWrap} ${itemPad} text-sm font-semibold bg-indigo-50 text-indigo-900 border border-indigo-100`}
              aria-current="page"
            >
              {compact ? (
                <NavItemIcon to={to} className="w-[18px] h-[18px] shrink-0" />
              ) : (
                <span className={`${navItemInnerClass} w-full`}>
                  <NavItemIcon to={to} className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{label}</span>
                  {previewBadge}
                </span>
              )}
            </span>
          );
        }
        return (
          <NavLink
            key={to}
            to={to}
            end={end ?? false}
            title={compact ? label : undefined}
            aria-label={compact ? label : undefined}
            className={`${iconWrap} ${itemPad} text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition`}
          >
            {compact ? (
              <NavItemIcon to={to} className="w-[18px] h-[18px] shrink-0 opacity-90" />
            ) : (
              <span className={`${navItemInnerClass} w-full`}>
                <NavItemIcon to={to} className="w-[18px] h-[18px] shrink-0 opacity-90" />
                <span className="truncate">{label}</span>
                {previewBadge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * App chrome with a fixed left sidebar for main navigation.
 * Use AppHeader instead for focus views (e.g. active worksheet) with no section nav.
 */
export default function AppShell({
  navLinks = [],
  onBack,
  onLogout,
  mainClassName = "",
  children,
}) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(
    getStoredSidebarCollapsed,
  );
  const footerLines = getShellFooterLines();
  const { pathname } = useLocation();
  const resolvedNavLinks = decorateNavLinksForDemo(navLinks);
  const preview = getDemoPreviewForPath(pathname);

  function setSidebarCollapsed(next) {
    setSidebarCollapsedState(setStoredSidebarCollapsed(next));
  }

  function toggleSidebar() {
    setSidebarCollapsed(!sidebarCollapsed);
  }

  const shellContext = {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
  };

  const sidebarWidthClass = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH_CLASS
    : SIDEBAR_WIDTH_CLASS;

  const sidebarWidthVar = sidebarCollapsed ? "3.5rem" : "13rem";

  return (
    <ShellLayoutContext.Provider value={shellContext}>
      <div
        className="min-h-screen bg-slate-50 flex"
        style={{ "--quill-sidebar-width": sidebarWidthVar }}
      >
        <div
          className={`relative shrink-0 sticky top-0 z-20 h-screen border-r border-slate-200 bg-white transition-[width] duration-200 ease-out ${sidebarWidthClass}`}
        >
          <aside className={`h-full overflow-hidden ${sidebarWidthClass}`}>
            {sidebarCollapsed ? (
              <div
                className={`${SIDEBAR_COLLAPSED_WIDTH_CLASS} h-full flex flex-col`}
              >
                <div
                  className="shrink-0 py-4 flex justify-center border-b border-slate-100 text-slate-800"
                  title="Quill"
                >
                  <QuillLogo size="sm" showWordmark={false} />
                </div>

                <div className="flex-1 overflow-y-auto py-3">
                  {resolvedNavLinks.length > 0 ? (
                    <SidebarNav navLinks={resolvedNavLinks} compact />
                  ) : null}
                </div>

                {onLogout ? (
                  <div className="shrink-0 py-3 border-t border-slate-100 flex justify-center">
                    <button
                      type="button"
                      onClick={onLogout}
                      title="Log out"
                      aria-label="Log out"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-indigo-700 transition"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-[18px] h-[18px]"
                        aria-hidden
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="M16 17l5-5-5-5" />
                        <path d="M21 12H9" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={`${SIDEBAR_WIDTH_CLASS} h-full flex flex-col`}>
                <div className="px-4 pt-5 pb-4 border-b border-slate-100">
                  <QuillLogo size="md" className="text-slate-800" />
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-4">
                  {resolvedNavLinks.length > 0 ? (
                    <SidebarNav navLinks={resolvedNavLinks} />
                  ) : null}
                </div>

                <div className="shrink-0 px-4 py-4 border-t border-slate-100 space-y-2">
                  {footerLines.line1 ? (
                    <div className="text-xs font-medium text-slate-600 leading-snug">
                      {footerLines.line1}
                    </div>
                  ) : null}
                  {footerLines.line2 ? (
                    <div className="text-xs font-semibold text-slate-800 leading-snug">
                      {footerLines.line2}
                    </div>
                  ) : null}
                  {onLogout ? (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="text-sm font-semibold text-slate-800 hover:text-indigo-700 transition"
                    >
                      Log out
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </aside>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            className="absolute top-1/2 left-full z-30 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600 shadow-md hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <main className={`flex-1 min-w-0 p-6 ${mainClassName}`.trim()}>
          {onBack ? (
            <div className="sticky top-4 z-40 mb-4 w-fit">
              <button type="button" onClick={onBack} className={backPillClass}>
                ← Back
              </button>
            </div>
          ) : null}
          <DemoBanner />
          <DemoPreviewBanner blurb={preview?.blurb} />
          {children}
        </main>
      </div>
    </ShellLayoutContext.Provider>
  );
}
