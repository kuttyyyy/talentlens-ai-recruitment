// AdminPortalFeedback.jsx
// Module 1 fix -- lets the Super Admin see every recruiter feedback
// submission in full detail (not just the aggregate averages already
// shown on the old public-site Admin analytics page).

import { useEffect, useState } from "react";
import AdminPortalShell from "../components/AdminPortalShell";
import { adminApiRequest } from "../api/adminClient";

const RATING_FIELDS = [
  ["overall_usefulness", "Overall"],
  ["ease_of_use", "Ease of Use"],
  ["jd_analysis_useful", "JD Analysis"],
  ["test_generation_useful", "Test Generation"],
  ["cv_matching_useful", "CV Matching"],
  ["practical_assessment_useful", "Practical Assessment"],
  ["candidate_report_useful", "Candidate Report"],
  ["integrity_info_useful", "Integrity Info"],
  ["would_use_again", "Would Use Again"],
];

function RatingChip({ label, value }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="text-xs bg-surface-2 border border-border text-text px-2 py-0.5 rounded-full mr-1.5 mb-1.5 inline-block">
      {label}: <span className="text-gold font-medium">{value}/5</span>
    </span>
  );
}

function AdminPortalFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApiRequest("/admin-portal/feedback")
      .then(setFeedback)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminPortalShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">SUPER ADMIN</p>
      <h1 className="font-display text-3xl text-text mb-2">Recruiter Feedback</h1>
      <p className="text-muted mb-8 max-w-lg">
        Every feedback submission from every recruiter, in full — including their written comments.
      </p>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-lg">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : feedback.length === 0 ? (
        <p className="text-muted text-sm">No feedback submitted yet.</p>
      ) : (
        <div className="flex flex-col gap-4 max-w-3xl">
          {feedback.map((f) => (
            <div key={f.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-text font-medium text-sm">{f.recruiter_name}</p>
                  <p className="text-muted text-xs">
                    {f.recruiter_email}
                    {f.company_name && ` · ${f.company_name}`}
                    {f.role_title && ` · ${f.role_title}`}
                  </p>
                </div>
                <p className="text-muted text-xs whitespace-nowrap">
                  {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="mb-3">
                {RATING_FIELDS.map(([key, label]) => (
                  <RatingChip key={key} label={label} value={f[key]} />
                ))}
              </div>

              {f.improvement_suggestions && (
                <p className="text-sm text-text/90 border-l-2 border-gold pl-3">
                  "{f.improvement_suggestions}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminPortalShell>
  );
}

export default AdminPortalFeedback;
