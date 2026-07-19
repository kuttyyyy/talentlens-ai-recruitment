// AdminDashboard.jsx
// Site-wide overview for admins: user counts, job counts, and
// full listings of all users and jobs on the platform.

import { useState, useEffect } from "react";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetch(`${BASE_URL}/admin/analytics`).then((r) => r.json()).then(setAnalytics);
    fetch(`${BASE_URL}/admin/users`).then((r) => r.json()).then(setUsers);
    fetch(`${BASE_URL}/admin/jobs`).then((r) => r.json()).then(setJobs);
  }, []);

  if (!analytics) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Loading...</p>
      </AppShell>
    );
  }

  const cards = [
    { label: "Total Users", value: analytics.total_users },
    { label: "Candidates", value: analytics.total_candidates },
    { label: "Recruiters", value: analytics.total_recruiters },
    { label: "Total Jobs", value: analytics.total_jobs },
    { label: "Open Jobs", value: analytics.open_jobs },
    { label: "Applications", value: analytics.total_applications },
  ];

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">ADMIN</p>
      <h1 className="font-display text-3xl text-text mb-2">Platform Overview</h1>
      <p className="text-muted mb-8">Site-wide users, jobs, and activity.</p>

      <div className="grid grid-cols-3 gap-4 mb-10 max-w-3xl">
        {cards.map((c) => (
          <div key={c.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-2xl font-display text-text mb-1">{c.value}</p>
            <p className="text-xs text-muted uppercase tracking-wide">{c.label}</p>
          </div>
        ))}
      </div>

      <h2 className="text-text font-display text-xl mb-3">All Users</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden max-w-3xl mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text">{u.full_name}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3 text-muted capitalize">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-text font-display text-xl mb-3">All Jobs</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden max-w-3xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase">
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Recruiter</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Applicants</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text">{j.title}</td>
                <td className="px-4 py-3 text-muted">{j.recruiter_name}</td>
                <td className="px-4 py-3 text-muted capitalize">{j.status}</td>
                <td className="px-4 py-3 text-muted">{j.applicant_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

export default AdminDashboard;