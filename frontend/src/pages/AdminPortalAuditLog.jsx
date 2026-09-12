// AdminPortalAuditLog.jsx
// Super Admin's complete audit trail of important platform actions.

import { useEffect, useState } from "react";
import AdminPortalShell from "../components/AdminPortalShell";
import { adminApiRequest } from "../api/adminClient";

const ACTION_LABELS = {
  admin_login: "Admin logged in",
  company_created: "Company created",
  company_status_changed: "Company status changed",
  permission_changed: "Permissions changed",
  account_status_changed: "Account status changed",
};

function AdminPortalAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApiRequest("/admin-portal/audit-log")
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminPortalShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">SUPER ADMIN</p>
      <h1 className="font-display text-3xl text-text mb-2">Audit Log</h1>
      <p className="text-muted mb-8 max-w-lg">
        Every important action taken across the platform, in one place.
      </p>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-lg">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted text-sm">No actions recorded yet.</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Target</th>
                <th className="text-left px-4 py-3">Details</th>
                <th className="text-left px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{ACTION_LABELS[entry.action] || entry.action}</td>
                  <td className="px-4 py-3 text-text">{entry.actor_name}</td>
                  <td className="px-4 py-3 text-muted">
                    {entry.target_type ? `${entry.target_type} #${entry.target_id}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs max-w-xs truncate" title={entry.details}>
                    {entry.details || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPortalShell>
  );
}

export default AdminPortalAuditLog;