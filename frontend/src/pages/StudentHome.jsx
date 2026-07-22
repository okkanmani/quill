import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStudentHome, logout } from "../api";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import { useStudentNavLinks } from "../useStudentNavLinks";

function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Recently";
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
      {children}
    </p>
  );
}

function alertStyles(kind) {
  if (kind === "worksheet_continue" || kind === "test_continue") {
    return {
      card: "border-indigo-200 bg-indigo-50/80 hover:bg-indigo-50",
      badge: "border-indigo-200 bg-indigo-100 text-indigo-900",
      badgeLabel: "Continue",
    };
  }
  if (kind === "learn_section_new") {
    return {
      card: "border-teal-200 bg-teal-50/70 hover:bg-teal-50",
      badge: "border-teal-200 bg-teal-100 text-teal-900",
      badgeLabel: "New resource",
    };
  }
  if (kind === "writing_feedback") {
    return {
      card: "border-amber-200 bg-amber-50/70 hover:bg-amber-50",
      badge: "border-amber-200 bg-amber-100 text-amber-900",
      badgeLabel: "Feedback",
    };
  }
  if (kind === "test_locked") {
    return {
      card: "border-dashed border-slate-300 bg-slate-50/80 hover:bg-slate-50",
      badge: "border-slate-200 bg-slate-100 text-slate-700",
      badgeLabel: "Locked",
    };
  }
  if (kind === "revision_new") {
    return {
      card: "border-violet-200 bg-violet-50/70 hover:bg-violet-50",
      badge: "border-violet-200 bg-violet-100 text-violet-900",
      badgeLabel: "Revision",
    };
  }
  if (kind === "test_ready") {
    return {
      card: "border-sky-200 bg-sky-50/70 hover:bg-sky-50",
      badge: "border-sky-200 bg-sky-100 text-sky-900",
      badgeLabel: "New test",
    };
  }
  return {
    card: "border-slate-200 bg-white hover:bg-slate-50",
    badge: "border-slate-200 bg-slate-100 text-slate-800",
    badgeLabel: "New",
  };
}

function AlertCard({ alert }) {
  const styles = alertStyles(alert.kind);
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}
          >
            {styles.badgeLabel}
          </span>
          {alert.at ? (
            <span className="text-xs text-slate-500">{formatRelativeTime(alert.at)}</span>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
        {alert.subtitle ? (
          <p className="text-xs text-slate-600 mt-0.5">{alert.subtitle}</p>
        ) : null}
      </div>
    </>
  );

  if (alert.url) {
    return (
      <Link
        to={alert.url}
        className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 transition ${styles.card}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 ${styles.card}`}>
      {content}
    </div>
  );
}

export default function StudentHome() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { navLinks } = useStudentNavLinks();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getStudentHome()
      .then(setData)
      .catch(() => setError("Could not load home."))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const alerts = data?.alerts || [];
  const summary = data?.summary || {};

  return (
    <AppShell navLinks={navLinks} onLogout={handleLogout}>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">
          {name ? `Hi, ${name}` : "Home"}
        </h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          What&apos;s new and what needs your attention.
        </p>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? <QuillLoading label="Loading home…" /> : null}

        {!loading && !error ? (
          <div className="flex flex-col gap-6">
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
              <section>
                <SectionLabel>Alerts</SectionLabel>
                {alerts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    You&apos;re all caught up. Nothing new right now.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {alerts.map((alert, index) => (
                      <AlertCard
                        key={`${alert.kind}-${alert.url || alert.title}-${index}`}
                        alert={alert}
                      />
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-5">
                <section>
                  <SectionLabel>Quick links</SectionLabel>
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/student/worksheets"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition flex items-center justify-between gap-2"
                    >
                      <span>Your worksheets</span>
                      {summary.open_worksheets > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {summary.open_worksheets} open
                        </span>
                      ) : null}
                    </Link>
                    <Link
                      to="/student/learn"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      Learning resources
                    </Link>
                    <Link
                      to="/student/tests"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition flex items-center justify-between gap-2"
                    >
                      <span>Tests</span>
                      {summary.open_tests > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {summary.open_tests} open
                        </span>
                      ) : null}
                    </Link>
                    <Link
                      to="/student/results"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      Your results
                    </Link>
                    <Link
                      to="/student/writing"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      Writing
                    </Link>
                  </div>
                </section>

                {summary.alert_count > alerts.length ? (
                  <p className="text-xs text-slate-500">
                    Showing {alerts.length} of {summary.alert_count} recent items.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
