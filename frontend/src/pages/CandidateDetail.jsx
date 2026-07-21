// CandidateDetail.jsx
// A recruiter's detail view for one applicant: match info, status control,
// AI-generated interview questions, and the email draft -> confirm -> send flow
// for interview invites, rejections, and shortlist notices.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const STATUS_OPTIONS = ["applied", "shortlisted", "interview_scheduled", "rejected", "hired"];

function CandidateDetail() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  const [questions, setQuestions] = useState([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const [companyName, setCompanyName] = useState("Our Company");
  const [draft, setDraft] = useState(null); // { email_log_id, subject, body }
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSentMessage, setEmailSentMessage] = useState("");

  useEffect(() => {
    loadApplication();
  }, [applicationId]);

  function loadApplication() {
    setLoading(true);
    fetch(`${BASE_URL}/applications/${applicationId}`)
      .then((res) => res.json())
      .then((data) => {
        setApplication(data);
        setQuestions(data.interview_questions || []);
      })
      .finally(() => setLoading(false));
  }

  async function updateStatus(newStatus) {
    setApplication((prev) => ({ ...prev, status: newStatus }));
    await fetch(`${BASE_URL}/applications/${applicationId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function generateQuestions() {
    setGeneratingQuestions(true);
    try {
      const res = await fetch(`${BASE_URL}/interview/generate-questions/${applicationId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setQuestions(data.questions);
      } else {
        alert(data.detail || "Couldn't generate questions.");
      }
    } finally {
      setGeneratingQuestions(false);
    }
  }

  async function draftInviteEmail() {
    setDraftingEmail(true);
    setEmailError("");
    setEmailSentMessage("");
    try {
      const res = await fetch(`${BASE_URL}/interview/draft-email/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraft(data);
      } else {
        setEmailError(data.detail || "Couldn't draft the email.");
      }
    } finally {
      setDraftingEmail(false);
    }
  }

  async function draftStatusEmail() {
    setDraftingEmail(true);
    setEmailError("");
    setEmailSentMessage("");
    try {
      const res = await fetch(`${BASE_URL}/interview/draft-status-email/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraft(data);
      } else {
        setEmailError(data.detail || "Couldn't draft the email.");
      }
    } finally {
      setDraftingEmail(false);
    }
  }

  async function sendEmail() {
    setSendingEmail(true);
    setEmailError("");
    try {
      const res = await fetch(`${BASE_URL}/interview/send-email/${draft.email_log_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: draft.subject, body: draft.body }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailSentMessage("Email sent successfully.");
        setDraft(null);
        loadApplication(); // refresh status + email history
      } else {
        setEmailError(data.detail || "Couldn't send the email.");
      }
    } finally {
      setSendingEmail(false);
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

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Loading candidate...</p>
      </AppShell>
    );
  }

  if (!application) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Application not found.</p>
      </AppShell>
    );
  }

  const canDraftStatusEmail = application.status === "rejected" || application.status === "shortlisted";

  return (
    <AppShell>
      <button onClick={() => navigate(-1)} className="text-muted hover:text-text text-sm mb-4">
        ← Back to applicants
      </button>

      <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER</p>
      <h1 className="font-display text-3xl text-text mb-1">{application.candidate_name}</h1>
      <p className="text-muted mb-6">{application.candidate_email} · Applied for {application.job_title}</p>

      {/* Match summary */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
        <div className="flex items-center gap-2 mb-3">
          {recommendationBadge(application.ai_recommendation)}
          <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${scoreColor(application.match_score)}`}>
            {application.match_score}% match
          </span>
        </div>
        <p className="text-muted text-sm leading-relaxed border-t border-border pt-3 mb-4">
          {application.ai_reasoning}
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted uppercase tracking-wide">Status:</label>
          <select
            value={application.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Interview questions */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text font-display text-lg">Interview Questions</h2>
          <button
            onClick={generateQuestions}
            disabled={generatingQuestions}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-50"
          >
            {generatingQuestions ? "Generating..." : questions.length ? "Regenerate" : "Generate Questions"}
          </button>
        </div>
        {questions.length === 0 ? (
          <p className="text-muted text-sm">No questions generated yet.</p>
        ) : (
          <ol className="list-decimal list-inside text-sm text-muted space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="text-text/90">{q}</li>
            ))}
          </ol>
        )}
      </div>

      {/* Email workflow */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl">
        <h2 className="text-text font-display text-lg mb-3">Email</h2>

        {!draft && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <label className="text-xs text-muted uppercase tracking-wide">Company name:</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={draftInviteEmail}
                disabled={draftingEmail}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-50"
              >
                {draftingEmail ? "Drafting..." : "Draft Interview Invite"}
              </button>

              {canDraftStatusEmail && (
                <button
                  onClick={draftStatusEmail}
                  disabled={draftingEmail}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-gold/40 transition disabled:opacity-50"
                >
                  {draftingEmail ? "Drafting..." : `Draft ${application.status === "rejected" ? "Rejection" : "Shortlist"} Notice`}
                </button>
              )}
            </div>
          </>
        )}

        {emailError && <p className="text-danger text-sm mt-3">{emailError}</p>}
        {emailSentMessage && <p className="text-success text-sm mt-3">{emailSentMessage}</p>}

        {draft && (
          <div className="mt-2">
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">Subject</label>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition mb-3"
            />
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">Body</label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={8}
              className="w-full text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={sendEmail}
                disabled={sendingEmail}
                className="text-xs font-medium px-4 py-2 rounded-lg bg-gold text-background hover:opacity-90 transition disabled:opacity-50"
              >
                {sendingEmail ? "Sending..." : `Send to ${application.candidate_email}`}
              </button>
              <button
                onClick={() => setDraft(null)}
                className="text-xs font-medium px-4 py-2 rounded-lg border border-border text-muted hover:text-text transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {application.emails && application.emails.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted uppercase tracking-wide mb-2">Email History</p>
            <div className="flex flex-col gap-2">
              {application.emails.map((e) => (
                <div key={e.id} className="text-sm flex items-center justify-between">
                  <span className="text-text/90">{e.subject}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    e.status === "sent"
                      ? "text-success border-success/40 bg-success/10"
                      : "text-muted border-border"
                  }`}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default CandidateDetail;