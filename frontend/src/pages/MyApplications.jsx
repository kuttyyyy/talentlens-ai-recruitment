// MyApplications.jsx
// A candidate's view of every job they've applied to, with the AI's
// match score, reasoning, and current status. Candidates can also
// withdraw (permanently delete) an application via the 3-dot menu.

import { useState, useEffect, useRef } from "react";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const STATUS_LABELS = {
  applied: { label: "Applied", color: "text-signal bg-signal/10 border-signal/30" },
  shortlisted: { label: "Shortlisted", color: "text-gold bg-gold/10 border-gold/30" },
  interview_scheduled: { label: "Interview Scheduled", color: "text-success bg-success/10 border-success/30" },
  rejected: { label: "Not Selected", color: "text-danger bg-danger/10 border-danger/30" },
  hired: { label: "Hired", color: "text-success bg-success/10 border-success/30" },
};

function MyApplications() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    fetch(`${BASE_URL}/applications/candidate/${user.id}`)
      .then((res) => res.json())
      .then((data) => setApplications(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function deleteApplication(app) {
    if (
      !window.confirm(
        `Withdraw your application for "${app.job_title}"? This will permanently delete it, along with any interview questions or emails tied to it. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(app.id);
    setOpenMenuId(null);
    try {
      const res = await fetch(`${BASE_URL}/applications/${app.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not delete application");
      }
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function scoreColor(score) {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-gold";
    return "text-danger";
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">CANDIDATE</p>
      <h1 className="font-display text-3xl text-text mb-2">My Applications</h1>
      <p className="text-muted mb-8 max-w-lg">Track your status and see why the AI scored you the way it did.</p>

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : applications.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
          <p className="text-text font-medium mb-1">No applications yet</p>
          <p className="text-muted text-sm">Browse open jobs and apply to see your AI match score here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-2xl">
          {applications.map((app) => {
            const statusInfo = STATUS_LABELS[app.status] || STATUS_LABELS.applied;
            const isMenuOpen = openMenuId === app.id;
            const isDeleting = deletingId === app.id;

            return (
              <div
                key={app.id}
                className={`bg-surface border border-border rounded-xl p-5 relative ${
                  isDeleting ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {/* 3-dot menu */}
                <div className="absolute top-4 right-4" ref={isMenuOpen ? menuRef : null}>
                  <button
                    onClick={() => setOpenMenuId(isMenuOpen ? null : app.id)}
                    className="text-muted hover:text-text px-1.5 py-1 rounded-md hover:bg-surface-2 transition"
                    aria-label="Application options"
                  >
                    ⋮
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-36 bg-surface-2 border border-border rounded-lg shadow-lg overflow-hidden z-10">
                      <button
                        onClick={() => deleteApplication(app)}
                        disabled={isDeleting}
                        className="w-full text-left text-sm px-3 py-2 text-danger hover:bg-danger/10 transition disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between mb-2 pr-8">
                  <div>
                    <h2 className="text-text font-display text-xl">{app.job_title}</h2>
                    {app.job_location && <p className="text-muted text-xs mt-1">📍 {app.job_location}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ml-3 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 my-3">
                  <span className={`font-display text-2xl ${scoreColor(app.match_score)}`}>
                    {app.match_score}%
                  </span>
                  <span className="text-muted text-xs">AI match score</span>
                </div>

                <p className="text-muted text-sm leading-relaxed border-t border-border pt-3">
                  {app.ai_reasoning}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export default MyApplications;
