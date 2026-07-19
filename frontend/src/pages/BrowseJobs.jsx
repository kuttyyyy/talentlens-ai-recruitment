// BrowseJobs.jsx
// Lets a logged-in candidate search/browse open jobs and apply to them.
// Applying triggers the AI matching engine on the backend, which returns
// a match score + reasoning we show immediately.

import { useState, useEffect } from "react";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function BrowseJobs() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [jobs, setJobs] = useState([]);
  const [appliedMap, setAppliedMap] = useState({}); // job_id -> { match_score, ai_reasoning }
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchJobs(query = "") {
    setLoading(true);
    setError("");
    try {
      const url = query
        ? `${BASE_URL}/jobs/?search=${encodeURIComponent(query)}`
        : `${BASE_URL}/jobs/`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error("Could not load jobs");
      setJobs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyApplications() {
    try {
      const response = await fetch(`${BASE_URL}/applications/candidate/${user.id}`);
      const data = await response.json();
      if (response.ok) {
        const map = {};
        data.forEach((app) => {
          map[app.job_id] = { match_score: app.match_score, ai_reasoning: app.ai_reasoning };
        });
        setAppliedMap(map);
      }
    } catch {
      // silently ignore — not critical if this fails, Apply button just won't pre-mark
    }
  }

  useEffect(() => {
    fetchJobs();
    fetchMyApplications();
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchJobs(search);
  }

  async function handleApply(jobId) {
    setApplyingJobId(jobId);
    try {
      const response = await fetch(
        `${BASE_URL}/applications/apply?job_id=${jobId}&candidate_id=${user.id}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not apply");

      setAppliedMap((prev) => ({
        ...prev,
        [jobId]: { match_score: data.match_score, ai_reasoning: data.ai_reasoning },
      }));
    } catch (err) {
      alert(err.message); // simple for now — a nicer toast can come later
    } finally {
      setApplyingJobId(null);
    }
  }

  function scoreColor(score) {
    if (score >= 70) return "text-success border-success/40 bg-success/10";
    if (score >= 40) return "text-gold border-gold/40 bg-gold/10";
    return "text-danger border-danger/40 bg-danger/10";
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">CANDIDATE</p>
      <h1 className="font-display text-3xl text-text mb-2">Browse open roles</h1>
      <p className="text-muted mb-6 max-w-lg">Search by title, skill, or location.</p>

      <form onSubmit={handleSearchSubmit} className="flex gap-3 mb-8 max-w-xl">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. react, Bengaluru, marketing..."
          className="flex-1 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
        />
        <button
          type="submit"
          className="bg-gold hover:bg-gold-dim transition text-ink font-semibold px-5 rounded-lg"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-xl">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
          <p className="text-text font-medium mb-1">No jobs found</p>
          <p className="text-muted text-sm">Try a different search term, or check back later.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-2xl">
          {jobs.map((job) => {
            const applied = appliedMap[job.id];
            const isApplying = applyingJobId === job.id;

            return (
              <div
                key={job.id}
                className="bg-surface border border-border rounded-xl p-5 hover:border-gold/40 transition"
              >
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

                {applied ? (
                  <div className={`rounded-lg border p-3 ${scoreColor(applied.match_score)}`}>
                    <p className="text-sm font-semibold mb-1">
                      ✓ Applied — {applied.match_score}% match
                    </p>
                    <p className="text-xs opacity-90 leading-relaxed">{applied.ai_reasoning}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleApply(job.id)}
                    disabled={isApplying}
                    className="bg-gold hover:bg-gold-dim transition text-ink font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {isApplying ? "Analyzing your fit..." : "Apply Now"}
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

export default BrowseJobs;