// NewAssessment.jsx
// Step 1 of the pipeline: JD Input.
// A recruiter either pastes/types a JD directly, or pulls one in from
// an existing job posting they've already created, then edits it freely.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function NewAssessment() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [myJobs, setMyJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      try {
        const response = await fetch(`${BASE_URL}/jobs/recruiter/${user.id}`);
        const data = await response.json();
        if (response.ok) setMyJobs(data);
      } catch {
        // Non-fatal — the recruiter can still paste a JD in manually.
      }
    }
    loadJobs();
  }, [user.id]);

  function handleSelectJob(e) {
    const jobId = e.target.value;
    setSelectedJobId(jobId);
    if (!jobId) return;

    const job = myJobs.find((j) => String(j.id) === jobId);
    if (job) {
      setTitle(`${job.title} — Assessment`);
      setJdText(
        `${job.description}\n\nRequired skills: ${job.required_skills}` +
          (job.location ? `\nLocation: ${job.location}` : "") +
          (job.job_type ? `\nJob type: ${job.job_type}` : "")
      );
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim() || !jdText.trim()) {
      setError("Give this assessment a title and paste in the job description.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/assessments/?recruiter_id=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          jd_text: jdText,
          job_id: selectedJobId ? Number(selectedJobId) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to create assessment");
      navigate(`/assessments/${data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">STEP 1 — JD INPUT</p>
      <h1 className="font-display text-3xl text-text mb-2">New job assessment</h1>
      <p className="text-muted mb-8 max-w-lg">
        Paste in a job description, or pull one in from a job you've already posted.
        The AI will read this text to extract requirements and design the tests — nothing else.
      </p>

      <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl">
        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {myJobs.length > 0 && (
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                Start from an existing job posting <span className="normal-case text-muted/70">(optional)</span>
              </label>
              <select
                value={selectedJobId}
                onChange={handleSelectJob}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              >
                <option value="">— Paste a JD manually instead —</option>
                {myJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Assessment Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend Engineer — Assessment"
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
            />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Job Description</label>
            <textarea
              required
              rows={10}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here — responsibilities, required skills, qualifications, experience level..."
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted/70 mt-1.5">
              The more detail here, the better the AI's extracted skills and generated tests will be.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50 mt-2"
          >
            {loading ? "Creating..." : "Create Assessment"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

export default NewAssessment;
