// CandidateDetail.jsx
// A recruiter's detail view for one applicant: match info, status control,
// AI-generated interview questions, and the email draft -> confirm -> send flow
// for interview invites, rejections, and shortlist notices.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const STATUS_OPTIONS = ["applied", "shortlisted", "interview_scheduled", "on_hold", "rejected", "hired"];

const CATEGORY_LABELS = {
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  cv_based: "CV-Based",
  role_specific: "Role-Specific",
  general: "Other",
};

function EditableQuestion({ q, onSave, onDelete }) {
  const [text, setText] = useState(q.question_text);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <textarea
        value={text}
        rows={2}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (dirty) {
            onSave(q.id, text);
            setDirty(false);
          }
        }}
        className="flex-1 text-sm px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-text resize-none focus:outline-none focus:border-gold"
      />
      <button onClick={() => onDelete(q.id)} className="text-muted hover:text-danger text-xs px-1 mt-1.5">
        ✕
      </button>
    </div>
  );
}

function CandidateDetail() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modules 6 & 7 -- integrity + evaluation report
  const [evalReport, setEvalReport] = useState(null);
  const [evalLoading, setEvalLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState("");
  const [editingWeights, setEditingWeights] = useState(false);
  const [weightDraft, setWeightDraft] = useState({ test1_weight: 30, test2_weight: 25, test3_weight: 45 });
  const [savingWeights, setSavingWeights] = useState(false);

  const [questions, setQuestions] = useState({}); // { category: [{id, question_text}] }
  const [newQuestionCategory, setNewQuestionCategory] = useState("general");
  const [newQuestionText, setNewQuestionText] = useState("");

  // Module 9 -- interview feedback
  const [feedback, setFeedback] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState({
    technical_competency: 0, communication: 0, problem_solving: 0, job_knowledge: 0,
    overall_feedback: "", recommendation: "",
  });
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [summarizingFeedback, setSummarizingFeedback] = useState(false);

  // Module 10 -- verification documents (recruiter view)
  const [verificationDocs, setVerificationDocs] = useState([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const [companyName, setCompanyName] = useState("Our Company");
  const [draft, setDraft] = useState(null); // { email_log_id, subject, body }
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSentMessage, setEmailSentMessage] = useState("");

  // Collapsed by default — recruiter clicks the arrow to expand/hide it
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadApplication();
    loadEvaluationReport();
    loadQuestions();
    loadFeedback();
  }, [applicationId]);

  function loadApplication() {
    setLoading(true);
    fetch(`${BASE_URL}/applications/${applicationId}`)
      .then((res) => res.json())
      .then((data) => {
        setApplication(data);
        if (data.candidate_id) {
          fetch(`${BASE_URL}/verification/recruiter/${data.candidate_id}?recruiter_id=${user.id}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((docs) => setVerificationDocs(docs || []))
            .catch(() => setVerificationDocs([]));
        }
      })
      .finally(() => setLoading(false));
  }

  function loadQuestions() {
    fetch(`${BASE_URL}/interview/questions/${applicationId}`)
      .then((res) => res.json())
      .then((data) => setQuestions(data.questions_by_category || {}));
  }

  async function loadFeedback() {
    try {
      const res = await fetch(`${BASE_URL}/interview/feedback/${applicationId}?recruiter_id=${user.id}`);
      const data = await res.json();
      if (data) {
        setFeedback(data);
        setFeedbackDraft({
          technical_competency: data.technical_competency || 0,
          communication: data.communication || 0,
          problem_solving: data.problem_solving || 0,
          job_knowledge: data.job_knowledge || 0,
          overall_feedback: data.overall_feedback || "",
          recommendation: data.recommendation || "",
        });
      }
    } catch {
      // No feedback yet -- fine, form stays at defaults
    }
  }

  async function loadEvaluationReport() {
    setEvalLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/evaluations/application/${applicationId}?recruiter_id=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setEvalReport(data);
        if (data.weights) {
          setWeightDraft({
            test1_weight: data.weights["1"] ?? 30,
            test2_weight: data.weights["2"] ?? 25,
            test3_weight: data.weights["3"] ?? 45,
          });
        }
      }
    } catch {
      // Non-fatal -- the rest of the page still works without this
    } finally {
      setEvalLoading(false);
    }
  }

  async function runEvaluation() {
    setEvaluating(true);
    setEvalError("");
    try {
      const res = await fetch(`${BASE_URL}/evaluations/application/${applicationId}/evaluate?recruiter_id=${user.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Evaluation failed");
      await loadEvaluationReport();
    } catch (err) {
      setEvalError(err.message);
    } finally {
      setEvaluating(false);
    }
  }

  async function saveWeights() {
    const total = weightDraft.test1_weight + weightDraft.test2_weight + weightDraft.test3_weight;
    if (total !== 100) {
      setEvalError(`Weights must sum to 100 (currently ${total})`);
      return;
    }
    setSavingWeights(true);
    setEvalError("");
    try {
      const res = await fetch(
        `${BASE_URL}/evaluations/assessment/${evalReport.assessment_id}/weights?recruiter_id=${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(weightDraft),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save weights");
      setEditingWeights(false);
      await loadEvaluationReport();
    } catch (err) {
      setEvalError(err.message);
    } finally {
      setSavingWeights(false);
    }
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
        setQuestions(data.questions_by_category || {});
      } else {
        alert(data.detail || "Couldn't generate questions.");
      }
    } finally {
      setGeneratingQuestions(false);
    }
  }

  async function updateQuestion(id, text) {
    await fetch(`${BASE_URL}/interview/questions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_text: text }),
    });
  }

  async function deleteQuestion(id) {
    await fetch(`${BASE_URL}/interview/questions/${id}`, { method: "DELETE" });
    loadQuestions();
  }

  async function addCustomQuestion() {
    if (!newQuestionText.trim()) return;
    await fetch(`${BASE_URL}/interview/questions/${applicationId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_text: newQuestionText, category: newQuestionCategory }),
    });
    setNewQuestionText("");
    loadQuestions();
  }

  async function saveFeedback() {
    setSavingFeedback(true);
    try {
      await fetch(`${BASE_URL}/interview/feedback/${applicationId}?recruiter_id=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackDraft),
      });
      await loadFeedback();
    } finally {
      setSavingFeedback(false);
    }
  }

  async function summarizeFeedback() {
    setSummarizingFeedback(true);
    try {
      const res = await fetch(`${BASE_URL}/interview/feedback/${applicationId}/summarize?recruiter_id=${user.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback((prev) => ({ ...prev, ai_summary: data.ai_summary }));
      } else {
        alert(data.detail || "Couldn't summarize feedback.");
      }
    } finally {
      setSummarizingFeedback(false);
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
        {application.possible_duplicate_of && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-4">
            ⚠ Possibly the same person as <strong>{application.possible_duplicate_of}</strong> — resumes look very similar
          </div>
        )}
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

      {/* Module 3 -- CV Analysis & CV-JD Match evidence */}
      {(application.cv_analysis || application.jd_match) && (
        <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text font-display text-lg">CV-JD Match Detail</h2>
            <div className="flex items-center gap-2">
              {application.cv_analysis && (
                <a
                  href={`${BASE_URL}/candidate/resume/${application.candidate_id}?recruiter_id=${user.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gold hover:text-gold-dim border border-gold/30 px-2.5 py-1 rounded-full"
                >
                  View Resume
                </a>
              )}
              {application.jd_match?.alignment_score !== undefined && application.jd_match?.alignment_score !== null && (
                <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${scoreColor(application.jd_match.alignment_score)}`}>
                  {application.jd_match.alignment_score}% alignment
                </span>
              )}
            </div>
          </div>

          {application.jd_match?.summary && (
            <p className="text-muted text-sm leading-relaxed mb-4">{application.jd_match.summary}</p>
          )}

          {(application.jd_match?.strong_matches?.length > 0 ||
            application.jd_match?.partial_matches?.length > 0 ||
            application.jd_match?.missing_requirements?.length > 0) && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
              {application.jd_match.strong_matches?.length > 0 && (
                <div>
                  <p className="text-success uppercase tracking-wide mb-1.5">Strong Matches</p>
                  {application.jd_match.strong_matches.map((m, i) => (
                    <span key={i} className="inline-block bg-success/10 text-success border border-success/30 px-2 py-0.5 rounded-full mr-1 mb-1">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {application.jd_match.partial_matches?.length > 0 && (
                <div>
                  <p className="text-gold uppercase tracking-wide mb-1.5">Partial Matches</p>
                  {application.jd_match.partial_matches.map((m, i) => (
                    <span key={i} className="inline-block bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded-full mr-1 mb-1">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {application.jd_match.missing_requirements?.length > 0 && (
                <div>
                  <p className="text-danger uppercase tracking-wide mb-1.5">Missing</p>
                  {application.jd_match.missing_requirements.map((m, i) => (
                    <span key={i} className="inline-block bg-danger/10 text-danger border border-danger/30 px-2 py-0.5 rounded-full mr-1 mb-1">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {application.jd_match?.requirements?.length > 0 && (
            <div className="overflow-hidden border border-border rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wide bg-ink/40">
                    <th className="text-left px-3 py-2">JD Requirement</th>
                    <th className="text-left px-3 py-2">CV Evidence</th>
                    <th className="text-left px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {application.jd_match.requirements.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-text align-top">{r.requirement}</td>
                      <td className="px-3 py-2 text-muted align-top">{r.evidence}</td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            r.match === "Strong"
                              ? "text-success bg-success/10 border-success/30"
                              : r.match === "Partial"
                              ? "text-gold bg-gold/10 border-gold/30"
                              : r.match === "Missing"
                              ? "text-danger bg-danger/10 border-danger/30"
                              : "text-signal bg-signal/10 border-signal/30"
                          }`}
                        >
                          {r.match}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {application.cv_analysis && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1">Education</p>
                <p className="text-text">{application.cv_analysis.education || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1">Experience</p>
                <p className="text-text">{application.cv_analysis.experience || "—"}</p>
              </div>
              {application.cv_analysis.projects?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted uppercase tracking-wide mb-1">Projects</p>
                  <ul className="list-disc list-inside text-text">
                    {application.cv_analysis.projects.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {application.cv_analysis.certifications?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted uppercase tracking-wide mb-1">Certifications</p>
                  <ul className="list-disc list-inside text-text">
                    {application.cv_analysis.certifications.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Module 8 -- consolidated AI Summary across CV match + all 3 tests */}
      {evalReport?.candidate_summary && (
        <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text font-display text-lg">AI Summary</h2>
            <span className="text-xs text-gold font-medium">AI Recommendation: Recruiter Review Required</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {evalReport.candidate_summary.overall_strengths?.length > 0 && (
              <div>
                <p className="text-xs text-success uppercase tracking-wide mb-1.5">Strengths</p>
                <ul className="list-disc list-inside text-text">
                  {evalReport.candidate_summary.overall_strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {evalReport.candidate_summary.areas_to_explore?.length > 0 && (
              <div>
                <p className="text-xs text-gold uppercase tracking-wide mb-1.5">Areas to Explore</p>
                <ul className="list-disc list-inside text-text">
                  {evalReport.candidate_summary.areas_to_explore.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {evalReport.candidate_summary.skills_demonstrated?.length > 0 && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Skills Demonstrated</p>
                <p className="text-text">{evalReport.candidate_summary.skills_demonstrated.join(", ")}</p>
              </div>
            )}
            {evalReport.candidate_summary.suggested_interview_topics?.length > 0 && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Suggested Interview Topics</p>
                <ul className="list-disc list-inside text-text">
                  {evalReport.candidate_summary.suggested_interview_topics.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modules 6 & 7 -- Assessment Results: scores, evidence, integrity */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text font-display text-lg">Assessment Results</h2>
          <button
            onClick={runEvaluation}
            disabled={evaluating}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
          >
            {evaluating ? "Evaluating..." : "Run Evaluation"}
          </button>
        </div>

        {evalError && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-3">
            {evalError}
          </div>
        )}

        {evalLoading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : !evalReport || evalReport.tests.length === 0 ? (
          <p className="text-muted text-sm">
            No approved assessment tests found for this job, or the candidate hasn't taken them yet.
          </p>
        ) : (
          <>
            {/* Overall score + recommendation */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Overall Score</p>
                <p className="font-display text-3xl text-text">
                  {evalReport.overall_score !== null ? `${evalReport.overall_score} / 100` : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted uppercase tracking-wide">Recommendation</p>
                <p className="text-gold text-sm font-medium">AI Assessment → Recruiter Review Required</p>
              </div>
            </div>

            {/* Weight editor */}
            <div className="mb-4">
              {editingWeights ? (
                <div className="flex items-end gap-3">
                  {["test1_weight", "test2_weight", "test3_weight"].map((key, i) => (
                    <div key={key}>
                      <label className="text-[10px] text-muted uppercase">Test {i + 1} %</label>
                      <input
                        type="number"
                        value={weightDraft[key]}
                        onChange={(e) => setWeightDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="w-16 px-2 py-1 rounded-md bg-surface-2 border border-border text-text text-sm"
                      />
                    </div>
                  ))}
                  <button
                    onClick={saveWeights}
                    disabled={savingWeights}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingWeights(false)}
                    className="text-xs text-muted hover:text-text px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditingWeights(true)} className="text-xs text-gold hover:text-gold-dim">
                  Weights: Test 1 {evalReport.weights?.["1"]}% · Test 2 {evalReport.weights?.["2"]}% · Test 3{" "}
                  {evalReport.weights?.["3"]}% (edit)
                </button>
              )}
            </div>

            {/* Per-test cards */}
            <div className="flex flex-col gap-4">
              {evalReport.tests.map((t) => (
                <div key={t.test_id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-text text-sm font-medium">
                      Test {t.test_number} — {t.title} <span className="text-muted text-xs">({t.weight}%)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {t.score !== null && t.score !== undefined && (
                        <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${scoreColor(t.score)}`}>
                          {t.score} / 100
                        </span>
                      )}
                      <span className="text-xs text-muted capitalize">{t.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  {t.evaluation && (
                    <div className="text-sm mt-2 flex flex-col gap-2">
                      {t.evaluation.strengths?.length > 0 && (
                        <p><span className="text-success">Strengths:</span> {t.evaluation.strengths.join("; ")}</p>
                      )}
                      {t.evaluation.weaknesses?.length > 0 && (
                        <p><span className="text-gold">Areas to explore:</span> {t.evaluation.weaknesses.join("; ")}</p>
                      )}
                      {t.evaluation.skills_demonstrated?.length > 0 && (
                        <p><span className="text-muted">Skills demonstrated:</span> {t.evaluation.skills_demonstrated.join(", ")}</p>
                      )}
                      {t.evaluation.ai_collaboration_assessment?.summary && (
                        <p className="border-l-2 border-gold pl-2">
                          <span className="text-gold">AI collaboration:</span> {t.evaluation.ai_collaboration_assessment.summary}
                        </p>
                      )}

                      {t.evaluation.breakdown?.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted cursor-pointer hover:text-text">
                            View evidence ({t.evaluation.breakdown.length} item{t.evaluation.breakdown.length !== 1 ? "s" : ""})
                          </summary>
                          <div className="flex flex-col gap-2 mt-2">
                            {t.evaluation.breakdown.map((b, i) => (
                              <div key={i} className="bg-ink/40 rounded-md p-2 text-xs">
                                <p className="text-text font-medium">{b.question || b.criterion}</p>
                                {b.candidate_answer !== undefined && (
                                  <p className="text-muted mt-0.5">Answer: {String(b.candidate_answer)}</p>
                                )}
                                <p className="text-muted mt-0.5">
                                  {b.points_earned !== undefined
                                    ? `${b.points_earned} / ${b.points_possible} points`
                                    : b.score !== undefined
                                    ? `${b.score} / 100 (weight ${b.weight}%)`
                                    : null}
                                  {b.evidence ? ` — ${b.evidence}` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Integrity flags */}
                  {t.integrity_report?.flags?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-danger font-medium mb-1.5">
                        ⚠ Potential integrity concern — recruiter review required
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {t.integrity_report.flags.map((f, i) => (
                          <div key={i} className="text-xs flex items-start gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                                f.severity === "high"
                                  ? "text-danger bg-danger/10 border-danger/30"
                                  : f.severity === "medium"
                                  ? "text-gold bg-gold/10 border-gold/30"
                                  : "text-muted bg-muted/10 border-border"
                              }`}
                            >
                              {f.severity}
                            </span>
                            <span className="text-muted">
                              <span className="text-text">{f.event}:</span> {f.evidence}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted/60 mt-1.5">{t.integrity_report.disclaimer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Module 9 -- Interview Questions, categorized and editable */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text font-display text-lg">Interview Questions</h2>
          <button
            onClick={generateQuestions}
            disabled={generatingQuestions}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-50"
          >
            {generatingQuestions ? "Generating..." : Object.keys(questions).length ? "Regenerate" : "Generate Questions"}
          </button>
        </div>

        {Object.keys(questions).length === 0 ? (
          <p className="text-muted text-sm">No questions generated yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(questions).map(([category, qList]) => (
              <div key={category}>
                <p className="text-xs text-muted uppercase tracking-wide mb-2">{CATEGORY_LABELS[category] || category}</p>
                <div className="flex flex-col gap-2">
                  {qList.map((q) => (
                    <EditableQuestion key={q.id} q={q} onSave={updateQuestion} onDelete={deleteQuestion} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <select
            value={newQuestionCategory}
            onChange={(e) => setNewQuestionCategory(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-text"
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            placeholder="Add your own question..."
            className="flex-1 text-sm px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold"
          />
          <button
            onClick={addCustomQuestion}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-dim transition text-ink"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Module 9 -- Interview Feedback */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
        <h2 className="text-text font-display text-lg mb-4">Interview Feedback</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            ["technical_competency", "Technical Competency"],
            ["communication", "Communication"],
            ["problem_solving", "Problem Solving"],
            ["job_knowledge", "Job Knowledge"],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-muted uppercase tracking-wide">{label} (1-5)</label>
              <input
                type="number"
                min={0}
                max={5}
                value={feedbackDraft[key]}
                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mb-4">
          <label className="text-xs text-muted uppercase tracking-wide">Overall Feedback</label>
          <textarea
            rows={3}
            value={feedbackDraft.overall_feedback}
            onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, overall_feedback: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm resize-none"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-muted uppercase tracking-wide">Your Recommendation</label>
          <select
            value={feedbackDraft.recommendation}
            onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, recommendation: e.target.value }))}
            className="w-full mt-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text text-sm"
          >
            <option value="">— Select —</option>
            <option value="Move Forward">Move Forward</option>
            <option value="Hold">Hold</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button
            onClick={saveFeedback}
            disabled={savingFeedback}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
          >
            {savingFeedback ? "Saving..." : "Save Feedback"}
          </button>
          <button
            onClick={summarizeFeedback}
            disabled={summarizingFeedback || !feedback}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-50"
          >
            {summarizingFeedback ? "Summarizing..." : "Summarize with AI"}
          </button>
        </div>
        {feedback?.ai_summary && (
          <p className="text-sm text-text/90 border-l-2 border-gold pl-3 mt-4">{feedback.ai_summary}</p>
        )}
      </div>

      {/* Module 10 -- Candidate Verification (recruiter view) */}
      {verificationDocs.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl mb-6">
          <h2 className="text-text font-display text-lg mb-1">Verification</h2>
          <p className="text-xs text-muted/70 mb-4">
            Self-consistency checks against the candidate's own declared profile info — not an authoritative background check.
          </p>
          <div className="flex flex-col gap-2">
            {verificationDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <div>
                  <p className="text-text text-sm capitalize">{doc.document_type} document</p>
                  <p className="text-muted text-xs mt-0.5">{doc.comparison_notes}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${
                    doc.comparison_result === "verified"
                      ? "text-success bg-success/10 border-success/30"
                      : doc.comparison_result === "inconsistent"
                      ? "text-danger bg-danger/10 border-danger/30"
                      : doc.comparison_result === "needs_review"
                      ? "text-gold bg-gold/10 border-gold/30"
                      : "text-muted bg-muted/10 border-border"
                  }`}
                >
                  {doc.comparison_result?.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <button
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-muted uppercase tracking-wide hover:text-text transition"
            >
              <span>Email History ({application.emails.length})</span>
              <span className={`transition-transform ${historyOpen ? "rotate-90" : ""}`}>▸</span>
            </button>

            {historyOpen && (
              <div className="flex flex-col gap-2 mt-3">
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
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default CandidateDetail;