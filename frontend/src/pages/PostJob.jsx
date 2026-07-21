// PostJob.jsx
// Lets a logged-in recruiter create a new job posting.
// Includes an AI "Check Quality" step that reviews the draft before
// posting — purely advisory, never blocks the recruiter from posting.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function PostJob() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [form, setForm] = useState({
    title: "",
    description: "",
    required_skills: "",
    location: "",
    job_type: "Full-time",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // New state for the AI quality check
  const [qualityResult, setQualityResult] = useState(null);
  const [checkingQuality, setCheckingQuality] = useState(false);
  const [qualityError, setQualityError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setQualityResult(null); // clear old feedback once they start editing again
  }

  async function handleCheckQuality() {
    if (!form.title || !form.description || !form.required_skills) {
      setQualityError("Fill in at least the title, description, and required skills first.");
      return;
    }

    setCheckingQuality(true);
    setQualityError("");
    setQualityResult(null);

    try {
      const response = await fetch(`${BASE_URL}/jobs/check-quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Quality check failed");
      setQualityResult(data);
    } catch (err) {
      setQualityError(err.message);
    } finally {
      setCheckingQuality(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch(
        `${BASE_URL}/jobs/?recruiter_id=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to post job");

      setSuccess(true);
      setQualityResult(null);
      setForm({
        title: "",
        description: "",
        required_skills: "",
        location: "",
        job_type: "Full-time",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER</p>
      <h1 className="font-display text-3xl text-text mb-2">Post a new job</h1>
      <p className="text-muted mb-8 max-w-lg">
        Candidates will see this listing immediately, and our AI will use the
        required skills to score and rank applicants.
      </p>

      <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success/10 border border-success/40 text-success text-sm rounded-lg px-3 py-2 mb-4 flex items-center justify-between">
            <span>✓ Job posted successfully</span>
            <button
              onClick={() => navigate("/browse-jobs")}
              className="text-xs underline hover:no-underline"
            >
              View it
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Job Title</label>
            <input
              type="text"
              name="title"
              required
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Frontend Developer Intern"
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
            />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Description</label>
            <textarea
              name="description"
              required
              rows={4}
              value={form.description}
              onChange={handleChange}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide">
              Required Skills <span className="normal-case text-muted/70">(comma-separated)</span>
            </label>
            <input
              type="text"
              name="required_skills"
              required
              value={form.required_skills}
              onChange={handleChange}
              placeholder="e.g. react, javascript, css, git"
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. Bengaluru"
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              />
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Job Type</label>
              <select
                name="job_type"
                value={form.job_type}
                onChange={handleChange}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              >
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Internship</option>
                <option>Contract</option>
              </select>
            </div>
          </div>

          {/* AI Quality Check feedback */}
          {qualityError && (
            <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2">
              {qualityError}
            </div>
          )}

          {qualityResult && (
            <div
              className={`rounded-lg border p-4 ${
                qualityResult.overall_quality === "good"
                  ? "bg-success/10 border-success/30"
                  : "bg-gold/10 border-gold/30"
              }`}
            >
              <p
                className={`text-sm font-semibold mb-2 ${
                  qualityResult.overall_quality === "good" ? "text-success" : "text-gold"
                }`}
              >
                {qualityResult.overall_quality === "good"
                  ? "✓ Looks good — no major issues found"
                  : "⚠ AI suggestions before you post"}
              </p>
              {qualityResult.suggestions.length > 0 && (
                <ul className="list-disc list-inside space-y-1">
                  {qualityResult.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-muted">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Two buttons: check quality (secondary) and post (primary) */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={handleCheckQuality}
              disabled={checkingQuality}
              className="flex-1 bg-surface-2 hover:bg-border border border-border transition text-text font-medium py-2.5 rounded-lg disabled:opacity-50"
            >
              {checkingQuality ? "Checking..." : "Check Quality with AI"}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Job"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default PostJob;