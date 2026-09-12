// AdminPortalShell.jsx
import { useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { getAdminUser, clearAdminSession, adminApiRequest } from "../api/adminClient";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin-portal/dashboard" },
  { label: "Companies", path: "/admin-portal/companies" },
  { label: "Recruiters & Permissions", path: "/admin-portal/recruiters" },
  { label: "Recruiter Feedback", path: "/admin-portal/feedback" },
  { label: "Audit Log", path: "/admin-portal/audit-log" },
];

function AdminPortalShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = getAdminUser();

  useEffect(() => {
    adminApiRequest("/admin-portal/me").catch(() => {});
  }, []);

  function handleLogout() {
    clearAdminSession();
    navigate("/admin-portal/login");
  }

  return (
    <div className="min-h-screen bg-ink flex">
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <p className="font-mono text-xs text-gold tracking-widest">TALENTLENS</p>
          <h1 className="font-display text-lg text-text">Admin Portal</h1>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm px-3 py-2 rounded-lg transition ${
                location.pathname === item.path
                  ? "bg-gold/10 text-gold font-medium"
                  : "text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <p className="text-text text-sm font-medium">{admin?.full_name}</p>
          <p className="text-muted text-xs">{admin?.admin_level === "super_admin" ? "Super Admin" : "Admin"}</p>
          <button onClick={handleLogout} className="text-danger text-xs hover:underline mt-2">
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}

export default AdminPortalShell;
  