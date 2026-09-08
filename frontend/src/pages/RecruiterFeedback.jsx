// RecruiterFeedback.jsx
// Module 11 — recruiter feedback on TalentLens itself (not on any candidate).

import { useState } from "react";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const RATING_QUESTIONS = [
  ["overall_usefulness", "How useful was TalentLens overall?"],
  ["ease_of_use", "How easy was it to use?"],
  ["jd_analysis_useful", "Was the JD analysis useful?"],
  ["test_generation_useful", "Was the AI test generation useful?"],
  ["cv_matching_useful", "Was the CV-JD matching useful?"],
  ["practical_assessment_useful", "Was the practical assessment useful?"],
  ["candidate_report_useful", "Was the candidate report useful?"],
  ["integrity_info_useful", "Was the integrity information useful?"],
  ["would_use_again", "Would you use TalentLens again?"],
];

function RatingRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <p className="text-text text-sm max-w-xs">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-lg border text-sm font-medium transition ${
              value === n
                ? "bg-gold text-ink border-gold"
                : "border-border text-muted hover:border-gold/40 hover:text-text"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecruiterFeedback() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [ratings, setRatings] = useState({});
  const [improvementSuggestions, setImprovementSuggestions] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function setRating(key, value) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${BASE_URL}/feedback/recruiter/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ratings,
          improvement_suggestions: improvementSuggestions,
          company_name: companyName || null,
          role_title: roleTitle || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to submit feedback");
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AppShell>
        <div className="bg-success/10 border border-success/40 text-success rounded-xl p-6 max-w-lg">
          <p className="font-display text-xl mb-1">✓ Thank you for your feedback!</p>
          <p className="text-sm">It genuinely helps shape what gets built next.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER FEEDBACK</p>
      <h1 className="font-display text-3xl text-text mb-2">How was your experience?</h1>
      <p className="text-muted mb-8 max-w-lg">
        A few quick questions about using TalentLens — this helps prioritize what to improve next.
      </p>

      <div className="bg-surface border border-border rounded-xl p-6 max-w-lg">
        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            {RATING_QUESTIONS.map(([key, label]) => (
              <RatingRow key={key} label={label} value={ratings[key]} onChange={(v) => setRating(key, v)} />
            ))}
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide">What should we improve?</label>
            <textarea
              rows={3}
              value={improvementSuggestions}
              onChange={(e) => setImprovementSuggestions(e.target.value)}
              placeholder="Anything you'd change or add..."
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Company (optional)</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Your Role (optional)</label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50 mt-2"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

export default RecruiterFeedback;
