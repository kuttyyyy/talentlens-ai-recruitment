// Applicants.jsx
// A recruiter's view: pick one of their jobs, see every applicant ranked
// best-to-worst by AI match score, with reasoning, and update their status.

import { useState, useEffect, useRef } from "react";
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

  // --- job menu / edit state ---
  const [openMenuJobId, setOpenMenuJobId] = useState(null);
  const [editingJobId, setEditingJobId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [closingJobId, setClosingJobId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    loadMyJobs();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuJobId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function loadMyJobs() {
    setLoadingJobs(true);
    fetch(`${BASE_URL}/jobs/recruiter/${user.id}`)
      .then((res) => res.json())
      .then((data) => setMyJobs(data))
      .finally(() => setLoadingJobs(false));
  }

  function openJob(job) {
    setSelectedJob(job);
    setLoadingApplicants(true);
    fetch(`${BASE_URL}/applications/job/${job.id}`)
      .then((res) => res.json())
      .then((data) => setApplicants(data))
      .finally(() => setLoadingApplicants(false));
  }

  async function updateStatus(applicationId, newStatus) {
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

  function startEdit(job) {
    setEditingJobId(job.id);
    setEditForm({
      title: job.title,
      description: job.description,
      required_skills: job.required_skills,
      location: job.location || "",
      job_type: job.job_type || "Full-time",
    });
    setOpenMenuJobId(null);
  }

  function cancelEdit() {
    setEditingJobId(null);
    setEditForm(null);
  }

  async function saveEdit(jobId) {
    setSavingEdit(true);
    try {
      const res = await fetch(`${BASE_URL}/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not update job");

      setMyJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...editForm } : j)));
      setEditingJobId(null);
      setEditForm(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function closeJob(job) {
    if (!window.confirm(`Close "${job.title}"? Candidates will no longer be able to apply.`)) {
      return;
    }
    setClosingJobId(job.id);
    setOpenMenuJobId(null);
    try {
      const res = await fetch(`${BASE_URL}/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not close job");
      }
      setMyJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "closed" } : j)));
    } catch (err) {
      alert(err.message);
    } finally {
      setClosingJobId(null);
    }
  }

  function scoreColor(score) {
    if (score >= 70) return "text-success border-success/40 bg-success/10";
    if (score >= 40) return "text-gold border-gold/40 bg-gold/10";
    return "text-danger border-danger/40 bg-danger/10";
  }

  function recommendationBadge(recommendation) {
    const config = {
      auto_shortlist: { label: "AI: Shortlist", classes: "text-success border-success/40 bg-success/10" },
      auto_reject: { label: "AI: Reject", classes: "text-danger border-danger/40 bg-danger/10" },
      needs_review: { label: "AI: Needs Review", classes: "text-gold border-gold/40 bg-gold/10" },
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
          <div className="flex flex-col gap-4 max-w-2xl">
            {myJobs.map((job) => {
              const isEditing = editingJobId === job.id;
              const isMenuOpen = openMenuJobId === job.id;

              return (
                <div
                  key={job.id}
                  className="bg-surface border border-border rounded-xl p-5 hover:border-gold/40 transition relative"
                >
                  {/* 3-dot menu */}
                  <div className="absolute top-4 right-4" ref={isMenuOpen ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenuJobId(isMenuOpen ? null : job.id)}
                      className="text-muted hover:text-text px-1.5 py-1 rounded-md hover:bg-surface-2 transition"
                      aria-label="Job options"
                    >
                      ⋮
                    </button>
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-1 w-36 bg-surface-2 border border-border rounded-lg shadow-lg overflow-hidden z-10">
                        <button
                          onClick={() => startEdit(job)}
                          className="w-full text-left text-sm px-3 py-2 text-text hover:bg-border/40 transition"
                        >
                          Edit
                        </button>
                        {job.status === "open" && (
                          <button
                            onClick={() => closeJob(job)}
                            disabled={closingJobId === job.id}
                            className="w-full text-left text-sm px-3 py-2 text-danger hover:bg-danger/10 transition disabled:opacity-50"
                          >
                            {closingJobId === job.id ? "Closing..." : "Close Job"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    // --- Inline edit form ---
                    <div className="flex flex-col gap-3 pr-8">
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        placeholder="Job title"
                        className="text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                      />
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        rows={3}
                        className="text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition resize-none"
                      />
                      <input
                        value={editForm.required_skills}
                        onChange={(e) => setEditForm({ ...editForm, required_skills: e.target.value })}
                        placeholder="Required skills (comma-separated)"
                        className="text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                      />
                      <div className="flex gap-3">
                        <input
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          placeholder="Location"
                          className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                        />
                        <select
                          value={editForm.job_type}
                          onChange={(e) => setEditForm({ ...editForm, job_type: e.target.value })}
                          className="text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                        >
                          <option>Full-time</option>
                          <option>Part-time</option>
                          <option>Internship</option>
                          <option>Contract</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(job.id)}
                          disabled={savingEdit}
                          className="text-sm px-3 py-1.5 rounded-lg bg-gold text-ink font-semibold hover:opacity-90 transition disabled:opacity-50"
                        >
                          {savingEdit ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // --- Normal job card, clickable to view applicants ---
                    <button onClick={() => openJob(job)} className="text-left w-full pr-8">
                      <div className="flex items-start justify-between mb-2">
                        <h2 className="text-text font-display text-xl">{job.title}</h2>
                        {job.job_type && (
                          <span className="text-xs bg-gold/10 text-gold px-2.5 py-1 rounded-full border border-gold/30 whitespace-nowrap ml-3">
                            {job.job_type}
                          </span>
                        )}
                      </div>

                      {job.location && <p className="text-muted text-xs mb-3">📍 {job.location}</p>}

                      <p className="text-muted text-sm mb-4 leading-relaxed">{job.description}</p>

                      {job.required_skills && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {job.required_skills.split(",").map((skill) => (
                            <span
                              key={skill}
                              className="bg-surface-2 text-muted text-xs px-2.5 py-1 rounded-full border border-border"
                            >
                              {skill.trim()}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            job.status === "open"
                              ? "text-success bg-success/10 border-success/30"
                              : "text-muted bg-surface-2 border-border"
                          }`}
                        >
                          {job.status === "open" ? "Open" : "Closed"}
                        </span>
                        <span className="text-muted text-xs">View applicants →</span>
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
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
              {app.possible_duplicate_of && (
                <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-4">
                  ⚠ Possibly the same person as <strong>{app.possible_duplicate_of}</strong> — resumes look very similar
                </div>
              )}

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