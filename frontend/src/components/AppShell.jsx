// AppShell.jsx
// The layout wrapper for every logged-in page: a sidebar with navigation
// on the left, a top bar with the user's info, and the page content on
// the right. Every future page (Jobs, Applicants, Admin, etc.) will use
// this same shell so the whole app feels consistent.

import { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

// Simple nav items — we'll add more here as we build later modules
// (Jobs, Applicants, etc.). role: which user role sees this link.
const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", roles: ["candidate", "recruiter", "admin"] },
  { label: "Upload Resume", path: "/upload-resume", roles: ["candidate"] },
  { label: "Browse Jobs", path: "/browse-jobs", roles: ["candidate"] },
  { label: "My Applications", path: "/my-applications", roles: ["candidate"] },
  { label: "Post a Job", path: "/post-job", roles: ["recruiter"] },
  { label: "Applicants", path: "/applicants", roles: ["recruiter"] },
  { label: "Reports", path: "/reports", roles: ["recruiter"] },
  { label: "Admin Panel", path: "/admin", roles: ["admin"] },
];

function AppShell({ children, activePage }) {
  const navigate = useNavigate();
  const location = useLocation();

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }

  // If there's no logged-in user (missing, cleared, or corrupted local
  // storage), redirect to login instead of letting child pages crash
  // trying to read user.id / user.role on a null value.
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  if (!user) {
    return null; // brief blank frame while the redirect above kicks in
  }

  // Only show nav links relevant to this user's role
  const visibleLinks = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-ink">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col justify-between p-6">
        <div>
          <p className="font-display text-2xl text-text mb-10">TalentLens</p>

          <nav className="flex flex-col gap-1">
            {visibleLinks.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg text-sm transition ${
                    isActive
                      ? "bg-gold/10 text-gold font-medium"
                      : "text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User info + logout, pinned to the bottom of the sidebar */}
        <div className="border-t border-border pt-4">
          <p className="text-text text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-muted text-xs capitalize mb-3">{user?.role}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-danger hover:text-red-400 transition"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}

export default AppShell;