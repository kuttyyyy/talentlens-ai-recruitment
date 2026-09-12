// MyInterview.jsx
// Module 4 (Interview Fix) -- a candidate's view of one application's
// interview: once the recruiter clicks "Send", the questions show up here
// immediately. The candidate writes answers and submits them; once the
// recruiter shares feedback afterward, it appears here too.

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const CATEGORY_LABELS = {
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  cv_based: "About Your Resume",
  role_specific: "Role Fit",
  general: "General",
};

function MyInterview() {
  const { applicationId } = useParams();
  const user = JSON.parse(localStorage.getItem("user"));

  const [loading, setLoading] = useState(true);
  const [interviewSent, setInterviewSent] = useState(false);
  const [questionsByCategory, setQuestionsByCategory] = useState({});
  const [submittedAt, setSubmittedAt] = useState(null);
  const [answers, setAnswers] = useState({}); // { [questionId]: text }
  const [feedback, setFeedback] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function loadInterview() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/interview/candidate/${applicationId}?candidate_id=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setInterviewSent(data.interview_sent);
        setQuestionsByCategory(data.questions_by_category || {});
        setSubmittedAt(data.submitted_at);

        const initialAnswers = {};
        Object.values(data.questions_by_category || {}).forEach((qList) => {
          qList.forEach((q) => {
            initialAnswers[q.id] = q.candidate_answer || "";
          });
        });
        setAnswers(initialAnswers);
      } else {
        setError(data.detail || "Couldn't load your interview");
      }
    } catch {
      setError("Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  }

  async function loadFeedback() {
    try {
      const res = await fetch(`${BASE_URL}/interview/feedback/candidate/${applicationId}?candidate_id=${user.id}`);
      const data = await res.json();
      if (res.ok) setFeedback(data);
    } catch {
      // Non-fatal -- the rest of the page still works without this
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInterview();
    loadFeedback();
  }, []);

  async function submitAnswers() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/interview/candidate/${applicationId}/answers?candidate_id=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit answers");
      setSubmittedAt(data.submitted_at);
      setJustSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalQuestions = Object.values(questionsByCategory).reduce((sum, qList) => sum + qList.length, 0);
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">CANDIDATE</p>
      <h1 className="font-display text-3xl text-text mb-2">Interview</h1>
      <Link to="/my-applications" className="text-muted text-sm hover:text-gold transition">
        ← Back to My Applications
      </Link>

      <div className="max-w-2xl mt-6">
        {loading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : !interviewSent ? (
          <div className="bg-surface border border-border rounded-xl p-6">
            <p className="text-text font-medium mb-1">No interview yet</p>
            <p className="text-muted text-sm">
              The recruiter hasn't sent interview questions for this application yet. Check back later.
            </p>
          </div>
        ) : (
          <>
            {feedback && (
              <div className="bg-gold/5 border border-gold/30 rounded-xl p-5 mb-6">
                <p className="text-xs text-gold uppercase tracking-wide mb-3">Interview Feedback</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    ["technical_competency", "Technical Competency"],
                    ["communication", "Communication"],
                    ["problem_solving", "Problem Solving"],
                    ["job_knowledge", "Job Knowledge"],
                  ].map(([key, label]) =>
                    feedback[key] != null ? (
                      <div key={key}>
                        <p className="text-muted text-xs">{label}</p>
                        <p className="text-text text-sm font-semibold">{feedback[key]} / 5</p>
                      </div>
                    ) : null
                  )}
                </div>
                {feedback.overall_feedback && (
                  <p className="text-text/90 text-sm mb-2">{feedback.overall_feedback}</p>
                )}
                {feedback.recommendation && (
                  <p className="text-muted text-xs">
                    Outcome: <span className="text-text">{feedback.recommendation}</span>
                  </p>
                )}
                {feedback.shared_at && (
                  <p className="text-muted/60 text-xs mt-2">
                    Shared {new Date(feedback.shared_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-text font-display text-lg">Your Questions</h2>
                <span className="text-xs text-muted">{answeredCount} / {totalQuestions} answered</span>
              </div>
              <p className="text-muted text-xs mb-5">
                {submittedAt
                  ? `You submitted answers on ${new Date(submittedAt).toLocaleDateString()}. You can still update them below until the recruiter reviews.`
                  : "Write your answers below, then submit when you're ready."}
              </p>

              {error && <p className="text-danger text-sm mb-3">{error}</p>}
              {justSubmitted && !error && (
                <p className="text-success text-sm mb-3">Your answers have been submitted.</p>
              )}

              <div className="flex flex-col gap-6">
                {Object.entries(questionsByCategory).map(([category, qList]) => (
                  <div key={category}>
                    <p className="text-xs text-muted uppercase tracking-wide mb-2">
                      {CATEGORY_LABELS[category] || category}
                    </p>
                    <div className="flex flex-col gap-4">
                      {qList.map((q) => (
                        <div key={q.id}>
                          <p className="text-text text-sm mb-1.5">{q.question_text}</p>
                          <textarea
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            rows={3}
                            placeholder="Type your answer..."
                            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm resize-none focus:outline-none focus:border-gold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={submitAnswers}
                disabled={submitting}
                className="mt-6 text-sm font-semibold px-4 py-2 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
              >
                {submitting ? "Submitting..." : submittedAt ? "Update Answers" : "Submit Answers"}
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default MyInterview;
