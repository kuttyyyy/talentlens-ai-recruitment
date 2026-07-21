// Applicants.jsx
// A recruiter's view: pick one of their jobs, see every applicant ranked
// best-to-worst by AI match score, with reasoning, and update their status.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const STATUS_OPTIONS = ["applied", "shortlisted", "interview_scheduled", "rejected", "hired"];

function Applicants() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const [myJobs, setMyJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}/jobs/recruiter/${user.id}`)
      .then((res) => res.json())
      .then((data) => setMyJobs(data))
      .finally(() => setLoadingJobs(false));
  }, []);

  function openJob(job) {
    setSelectedJob(job);
    setLoadingApplicants(true);
    fetch(`${BASE_URL}/applications/job/${job.id}`)
      .then((res) => res.json())
      .then((data) => setApplicants(data))
      .finally(() => setLoadingApplicants(false));
  }

  async function updateStatus(applicationId, newStatus) {
    // Update the UI immediately for a snappy feel, then confirm with the server
    setApplicants((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: newStatus } : a))
    );
    await fetch(`${BASE_URL}/applications/${applicationId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function acceptAiSuggestion(applicationId) {
    setAcceptingId(applicationId);
    try {
      const res = await fetch(`${BASE_URL}/applications/${applicationId}/accept-ai-suggestion`, {
        method: "PUT",
      });
      const data = await res.json();
      if (res.ok) {
        setApplicants((prev) =>
          prev.map((a) => (a.id === applicationId ? { ...a, status: data.status } : a))
        );
      } else {
        alert(data.detail || "Couldn't accept the AI suggestion.");
      }
    } finally {
      setAcceptingId(null);
    }
  }

  function scoreColor(score) {
    if (score >= 70) return "text-success border-success/40 bg-success/10";
    if (score >= 40) return "text-gold border-gold/40 bg-gold/10";
    return "text-danger border-danger/40 bg-danger/10";
  }

  function recommendationBadge(recommendation) {
    const config = {
      auto_shortlist: {
        label: "AI: Shortlist",
        classes: "text-success border-success/40 bg-success/10",
      },
      auto_reject: {
        label: "AI: Reject",
        classes: "text-danger border-danger/40 bg-danger/10",
      },
      needs_review: {
        label: "AI: Needs Review",
        classes: "text-gold border-gold/40 bg-gold/10",
      },
    };
    const c = config[recommendation];
    if (!c) return null;
    return (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${c.classes}`}>
        {c.label}
      </span>
    );
  }

  // --- View 1: pick which job to review ---
  if (!selectedJob) {
    return (
      <AppShell>
        <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER</p>
        <h1 className="font-display text-3xl text-text mb-2">Applicants</h1>
        <p className="text-muted mb-8 max-w-lg">Pick a job to see its AI-ranked applicants.</p>

        {loadingJobs ? (
          <p className="text-muted text-sm">Loading your jobs...</p>
        ) : myJobs.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
            <p className="text-text font-medium mb-1">No jobs posted yet</p>
            <p className="text-muted text-sm">Post a job first, then applicants will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-xl">
            {myJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => openJob(job)}
                className="text-left bg-surface border border-border hover:border-gold/40 transition rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-text font-medium">{job.title}</p>
                  <p className="text-muted text-xs mt-1">
                    {job.location || "Remote"} · {job.status === "open" ? "Open" : "Closed"}
                  </p>
                </div>
                <span className="text-muted text-xs">View applicants →</span>
              </button>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  // --- View 2: ranked applicants for the selected job ---
  return (
    <AppShell>
      <button
        onClick={() => setSelectedJob(null)}
        className="text-muted hover:text-text text-sm mb-4"
      >
        ← All jobs
      </button>

      <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER</p>
      <h1 className="font-display text-3xl text-text mb-2">{selectedJob.title}</h1>
      <p className="text-muted mb-8">
        {applicants.length} applicant{applicants.length !== 1 ? "s" : ""}, ranked by AI match score
      </p>

      {loadingApplicants ? (
        <p className="text-muted text-sm">Loading applicants...</p>
      ) : applicants.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
          <p className="text-text font-medium mb-1">No applicants yet</p>
          <p className="text-muted text-sm">Check back once candidates start applying.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-2xl">
          {applicants.map((app, index) => (
            <div key={app.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-muted text-xs font-mono">#{index + 1}</span>
                  <div>
                    <p className="text-text font-medium">{app.candidate_name}</p>
                    <p className="text-muted text-xs">{app.candidate_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {recommendationBadge(app.ai_recommendation)}
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${scoreColor(app.match_score)}`}>
                    {app.match_score}% match
                  </span>
                </div>
              </div>

              <p className="text-muted text-sm leading-relaxed border-t border-border pt-3 mb-4">
                {app.ai_reasoning}
              </p>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted uppercase tracking-wide">Status:</label>
                  <select
                    value={app.status}
                    onChange={(e) => updateStatus(app.id, e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {(app.ai_recommendation === "auto_shortlist" || app.ai_recommendation === "auto_reject") && (
                    <button
                      onClick={() => acceptAiSuggestion(app.id)}
                      disabled={acceptingId === app.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {acceptingId === app.id ? "Applying..." : "Accept AI suggestion"}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/applicants/${app.id}`)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-gold/40 transition"
                  >
                    View details →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default Applicants;