// AdminPortalShell.jsx
import { useEffect, useState } from "react";
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

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    adminApiRequest("/admin-portal/me").catch(() => {});
  }, []);

  function handleLogout() {
    clearAdminSession();
    navigate("/admin-portal/login");
  }

  function closePasswordModal() {
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
  }

  async function handleChangePassword() {
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    setChangingPassword(true);
    try {
      await adminApiRequest("/admin-portal/change-password", "POST", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
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
          <button
            onClick={() => setShowPasswordModal(true)}
            className="text-gold text-xs hover:underline mt-2 block"
          >
            Change Password
          </button>
          <button onClick={handleLogout} className="text-danger text-xs hover:underline mt-1 block">
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-text font-display text-lg mb-4">Change Password</h2>

            {passwordError && <p className="text-danger text-xs mb-3">{passwordError}</p>}
            {passwordSuccess && <p className="text-success text-xs mb-3">{passwordSuccess}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
              >
                {changingPassword ? "Saving..." : "Save Password"}
              </button>
              <button
                onClick={closePasswordModal}
                className="text-sm px-4 py-2 rounded-lg border border-border text-muted hover:text-text transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPortalShell;
  