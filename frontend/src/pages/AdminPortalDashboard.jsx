// AdminPortalDashboard.jsx
// Super Admin's platform-wide statistics.

import { useEffect, useState } from "react";
import AdminPortalShell from "../components/AdminPortalShell";
import { adminApiRequest } from "../api/adminClient";

function AdminPortalDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApiRequest("/admin-portal/super/stats")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: "Total Companies", value: stats.total_companies },
        { label: "Total Recruiters", value: stats.total_recruiters },
        { label: "Total Candidates", value: stats.total_candidates },
        { label: "Total Jobs", value: stats.total_jobs },
        { label: "Job Views", value: stats.job_views },
        { label: "Applications", value: stats.total_applications },
        { label: "Assessments", value: stats.total_assessments },
        { label: "Interviews", value: stats.total_interviews },
        { label: "Selected Candidates", value: stats.selected_candidates },
        { label: "Suspended/Banned Accounts", value: stats.suspended_or_banned_accounts },
      ]
    : [];

  return (
    <AdminPortalShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">SUPER ADMIN</p>
      <h1 className="font-display text-3xl text-text mb-8">Platform Overview</h1>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-lg">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl">
          {cards.map((c) => (
            <div key={c.label} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-2xl font-display text-text mb-1">{c.value}</p>
              <p className="text-xs text-muted uppercase tracking-wide">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </AdminPortalShell>
  );
}

export default AdminPortalDashboard;