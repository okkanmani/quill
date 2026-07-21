import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminHome, logout, switchAdminStudent } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AdminStudentBanner from "../components/AdminStudentBanner";
import AdminStudentRoster from "../components/AdminStudentRoster";
import QuillLoading from "../components/QuillLoading";

function formatRelativeTime(iso) {
  if (!iso) return "No activity yet";
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

function activityLabel(item) {
  const name = item.student_name;
  if (item.kind === "worksheet_completed") {
    return (
      <>
        {name} completed <strong>{item.title}</strong>
      </>
    );
  }
  if (item.kind === "test_completed") {
    return (
      <>
        {name} completed <strong>{item.title}</strong>
      </>
    );
  }
  if (item.kind === "reinforcement_flagged") {
    const count = item.topic_count || 1;
    return (
      <>
        {name} flagged <strong>{count} topic{count === 1 ? "" : "s"}</strong> for
        reinforcement
      </>
    );
  }
  return `${name} had activity`;
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
      {children}
    </p>
  );
}

export default function AdminLanding() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingStudent, setSwitchingStudent] = useState("");

  useEffect(() => {
    getAdminHome()
      .then(setData)
      .catch(() => setError("Could not load home dashboard."))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleSelectStudent(name) {
    const current = localStorage.getItem("studentName") || "";
    if (!name || name === current) return;
    setSwitchingStudent(name);
    setError("");
    try {
      const switched = await switchAdminStudent(name);
      localStorage.setItem("token", switched.token);
      localStorage.setItem("studentName", switched.student_name);
      if (switched.admin_name) localStorage.setItem("adminName", switched.admin_name);
      if (switched.grade != null) {
        localStorage.setItem("studentGrade", String(switched.grade));
      } else {
        localStorage.removeItem("studentGrade");
      }
      window.location.reload();
    } catch {
      setError("Could not switch student.");
      setSwitchingStudent("");
    }
  }

  const students = data?.students || [];
  const recentActivity = data?.recent_activity || [];
  const pending = data?.pending || [];

  return (
    <AppShell navLinks={ADMIN_MAIN_NAV} onLogout={handleLogout}>
      <div className="max-w-5xl">
        <AdminStudentBanner />

        <h1 className="text-2xl font-bold text-slate-950 mb-1">Home</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Overview of your students, recent activity, and items that need attention.
        </p>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? <QuillLoading label="Loading home…" /> : null}

        {!loading && !error && students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="text-slate-700 text-sm mb-4">Add a student to get started.</p>
            <Link
              to="/admin/students"
              className="inline-flex rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 transition"
            >
              Go to Students
            </Link>
          </div>
        ) : null}

        {!loading && !error && students.length > 0 ? (
          <div className="flex flex-col gap-6">
            <section>
              <SectionLabel>Students</SectionLabel>
              <AdminStudentRoster
                students={students}
                selectedName={localStorage.getItem("studentName") || ""}
                onSelectStudent={handleSelectStudent}
                switchingStudent={switchingStudent}
              />
            </section>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
              <section>
                <SectionLabel>Recent activity</SectionLabel>
                {recentActivity.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    No recent activity yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentActivity.map((item, index) => (
                      <div
                        key={`${item.kind}-${item.student_name}-${item.at}-${index}`}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-sm text-slate-800">{activityLabel(item)}</span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {formatRelativeTime(item.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-5">
                <section>
                  <SectionLabel>Quick actions</SectionLabel>
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/admin/create/worksheet"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      + New worksheet
                    </Link>
                    <Link
                      to="/admin/create/learn"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      + New learning resource
                    </Link>
                    <Link
                      to="/admin/worksheets"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      Unlock a test
                    </Link>
                  </div>
                </section>

                <section>
                  <SectionLabel>Pending</SectionLabel>
                  {pending.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3.5 py-4 text-sm text-slate-500">
                      Nothing waiting for unlock.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pending.map((item) => (
                        <Link
                          key={`${item.student_name}-${item.worksheet_id}`}
                          to="/admin/worksheets"
                          className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3.5 py-2.5 hover:bg-slate-50 transition"
                        >
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Locked · {item.student_name} · awaiting unlock
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
