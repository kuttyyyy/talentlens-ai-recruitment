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

  const assessmentCards = [
    { label: "Assessment Completion Rate", value: analytics.assessment_completion_rate !== null ? `${analytics.assessment_completion_rate}%` : "—" },
    { label: "Avg. Test 1 Score", value: analytics.average_test1_score ?? "—" },
    { label: "Avg. Test 2 Score", value: analytics.average_test2_score ?? "—" },
    { label: "Avg. Practical Score", value: analytics.average_test3_score ?? "—" },
    { label: "Avg. Completion Time", value: analytics.average_completion_minutes !== null ? `${analytics.average_completion_minutes} min` : "—" },
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

      {/* Module 11 -- Assessment Analytics */}
      <h2 className="text-text font-display text-xl mb-3">Assessment Analytics</h2>
      <div className="grid grid-cols-3 gap-4 mb-10 max-w-3xl">
        {assessmentCards.map((c) => (
          <div key={c.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-2xl font-display text-text mb-1">{c.value}</p>
            <p className="text-xs text-muted uppercase tracking-wide">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Candidates by stage */}
      <h2 className="text-text font-display text-xl mb-3">Candidates by Stage</h2>
      <div className="flex flex-wrap gap-3 mb-10 max-w-3xl">
        {Object.entries(analytics.candidates_by_stage || {}).map(([stage, count]) => (
          <div key={stage} className="bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-text font-medium">{count}</span>
            <span className="text-muted text-xs capitalize">{stage.replace("_", " ")}</span>
          </div>
        ))}
        {Object.keys(analytics.candidates_by_stage || {}).length === 0 && (
          <p className="text-muted text-sm">No applications yet.</p>
        )}
      </div>

      {/* Recruiter satisfaction + most useful features */}
      <div className="grid grid-cols-2 gap-6 mb-10 max-w-3xl">
        <div>
          <h2 className="text-text font-display text-xl mb-3">Recruiter Satisfaction</h2>
          <div className="bg-surface border border-border rounded-xl p-4">
            {analytics.recruiter_satisfaction?.responses_count > 0 ? (
              <>
                <p className="text-2xl font-display text-text mb-1">
                  {analytics.recruiter_satisfaction.average_overall_usefulness} / 5
                </p>
                <p className="text-xs text-muted uppercase tracking-wide mb-3">Avg. Overall Usefulness</p>
                <p className="text-sm text-text">
                  {analytics.recruiter_satisfaction.average_would_use_again} / 5 would use again
                </p>
                <p className="text-xs text-muted/70 mt-1">
                  Based on {analytics.recruiter_satisfaction.responses_count} response
                  {analytics.recruiter_satisfaction.responses_count !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <p className="text-muted text-sm">No recruiter feedback submitted yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-text font-display text-xl mb-3">Most Useful Features</h2>
          <div className="bg-surface border border-border rounded-xl p-4">
            {analytics.most_useful_features?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {analytics.most_useful_features.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between text-sm">
                    <span className="text-text">{f.feature}</span>
                    <span className="text-gold font-medium">{f.average_rating} / 5</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">No feedback yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Common assessment issues */}
      <h2 className="text-text font-display text-xl mb-3">Common Assessment Issues</h2>
      <div className="bg-surface border border-border rounded-xl p-4 max-w-3xl mb-10">
        {analytics.common_assessment_issues?.length > 0 ? (
          <div className="flex flex-col gap-2">
            {analytics.common_assessment_issues.map((issue) => (
              <div key={issue.issue} className="flex items-center justify-between text-sm">
                <span className="text-text">{issue.issue}</span>
                <span className="text-muted">{issue.count} candidate{issue.count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">No integrity signals recorded yet.</p>
        )}
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