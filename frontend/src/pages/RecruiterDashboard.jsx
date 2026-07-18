// RecruiterDashboard.jsx
// A recruiter's reporting overview: totals, average match score,
// status breakdown, and a per-job performance table.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = "http://127.0.0.1:8000";

const STATUS_LABELS = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  rejected: "Not Selected",
  hired: "Hired",
};

function RecruiterDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/dashboard/recruiter/${user.id}/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  function scoreColor(score) {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-gold";
    return "text-danger";
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Loading your dashboard...</p>
      </AppShell>
    );
  }

  const statCards = [
    { label: "Open Jobs", value: stats.open_jobs, sub: `${stats.total_jobs} total posted` },
    { label: "Total Applicants", value: stats.total_applicants, sub: "across all jobs" },
    { label: "Avg. Match Score", value: `${stats.average_match_score}%`, sub: "AI-calculated" },
    { label: "Shortlisted", value: stats.status_breakdown.shortlisted, sub: "candidates in review" },
  ];

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER</p>
      <h1 className="font-display text-3xl text-text mb-2">Reports & Overview</h1>
      <p className="text-muted mb-8">A snapshot of your hiring activity across all jobs.</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 max-w-3xl">
        {statCards.map((card) => (
          <div key={card.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-2xl font-display text-text mb-1">{card.value}</p>
            <p className="text-xs text-muted uppercase tracking-wide">{card.label}</p>
            <p className="text-xs text-muted/70 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <h2 className="text-text font-display text-xl mb-3">Application Status Breakdown</h2>
      <div className="flex flex-wrap gap-3 mb-10 max-w-3xl">
        {Object.entries(stats.status_breakdown).map(([status, count]) => (
          <div
            key={status}
            className="bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <span className="text-text font-medium">{count}</span>
            <span className="text-muted text-xs">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* Per-job table */}
      <h2 className="text-text font-display text-xl mb-3">Performance by Job</h2>
      {stats.jobs.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
          <p className="text-text font-medium mb-1">No jobs posted yet</p>
          <p className="text-muted text-sm">Post your first job to start seeing reports here.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Job Title</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Applicants</th>
                <th className="text-left px-4 py-3">Avg. Score</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {stats.jobs.map((job) => (
                <tr key={job.job_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{job.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        job.status === "open"
                          ? "text-success bg-success/10 border-success/30"
                          : "text-muted bg-surface-2 border-border"
                      }`}
                    >
                      {job.status === "open" ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text">{job.applicant_count}</td>
                  <td className={`px-4 py-3 font-medium ${scoreColor(job.average_match_score)}`}>
                    {job.average_match_score}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate("/applicants")}
                      className="text-gold text-xs hover:underline"
                    >
                      View applicants →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

export default RecruiterDashboard;