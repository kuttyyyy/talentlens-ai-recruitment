// RecruiterDashboard.jsx
// A recruiter's reporting overview: an AI copilot to ask questions about
// their hiring data, totals, status breakdown, hiring funnel, time-to-hire,
// and a per-job performance table.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const STATUS_LABELS = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  rejected: "Not Selected",
  hired: "Hired",
};

const SUGGESTED_QUESTIONS = [
  "Who are my top 3 candidates right now?",
  "Which job has the weakest applicant pool?",
  "Summarize my hiring pipeline",
];

function RecruiterDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch(`${BASE_URL}/dashboard/recruiter/${user.id}/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function askCopilot(customQuestion) {
    const q = (customQuestion ?? question).trim();
    if (!q || asking) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch(`${BASE_URL}/copilot/ask/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.detail || "Something went wrong answering that." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Couldn't reach the server. Please try again." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askCopilot();
    }
  }

  function scoreColor(score) {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-gold";
    return "text-danger";
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Loading your dashboard...</p>
      </AppShell>
    );
  }

  if (!stats) {
    return (
      <AppShell>
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-4 py-3 max-w-xl">
          Couldn't load your dashboard data. Make sure the backend server is
          running, then refresh this page.
        </div>
      </AppShell>
    );
  }

  const statCards = [
    { label: "Open Jobs", value: stats.open_jobs, sub: `${stats.total_jobs} total posted` },
    { label: "Total Applicants", value: stats.total_applicants, sub: "across all jobs" },
    { label: "Avg. Match Score", value: `${stats.average_match_score}%`, sub: "AI-calculated" },
    { label: "Shortlisted", value: stats.status_breakdown.shortlisted, sub: "candidates in review" },
  ];

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">RECRUITER</p>
      <h1 className="font-display text-3xl text-text mb-2">Reports & Overview</h1>
      <p className="text-muted mb-8">A snapshot of your hiring activity across all jobs.</p>

      {/* Copilot */}
      <div className="bg-surface border border-border rounded-xl p-5 max-w-3xl mb-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-gold" />
          <h2 className="text-text font-display text-lg">Ask Copilot</h2>
        </div>
        <p className="text-muted text-xs mb-4">
          Ask anything about your jobs and applicants — answered from your real data.
        </p>

        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTED_QUESTIONS.map((sq) => (
              <button
                key={sq}
                onClick={() => askCopilot(sq)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:text-gold hover:border-gold/40 transition"
              >
                {sq}
              </button>
            ))}
          </div>
        ) : (
          <div ref={scrollRef} className="flex flex-col gap-3 mb-4 max-h-72 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                  m.role === "user"
                    ? "bg-surface-2 border border-border text-text self-end"
                    : "bg-gold/10 border border-gold/30 text-text/90 self-start"
                }`}
              >
                {m.text}
              </div>
            ))}
            {asking && <div className="text-sm text-muted self-start px-3 py-2">Thinking…</div>}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Who should I interview first?"
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
          />
          <button
            onClick={() => askCopilot()}
            disabled={asking || !question.trim()}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gold text-background hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ask
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 max-w-3xl">
        {statCards.map((card) => (
          <div key={card.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-2xl font-display text-text mb-1">{card.value}</p>
            <p className="text-xs text-muted uppercase tracking-wide">{card.label}</p>
            <p className="text-xs text-muted/70 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Hiring funnel */}
      <h2 className="text-text font-display text-xl mb-3">Hiring Funnel</h2>
      <div className="bg-surface border border-border rounded-xl p-5 max-w-3xl mb-10">
        {stats.total_applicants === 0 ? (
          <p className="text-muted text-sm">No applicants yet — funnel will appear once candidates apply.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.funnel.map((stage) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-text">
                    {stage.stage === "applied" && "Applied"}
                    {stage.stage === "shortlisted" && "Shortlisted"}
                    {stage.stage === "interview_scheduled" && "Interviewed"}
                    {stage.stage === "hired" && "Hired"}
                  </span>
                  <span className="text-muted">
                    {stage.count} <span className="text-muted/60">({stage.percent}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {stats.average_time_to_hire_days !== null && stats.average_time_to_hire_days !== undefined && (
          <div className="mt-5 pt-4 border-t border-border flex items-center gap-2">
            <span className="text-2xl font-display text-text">{stats.average_time_to_hire_days}</span>
            <span className="text-muted text-sm">avg. days from application to hire</span>
          </div>
        )}
      </div>

      {/* Status breakdown */}
      <h2 className="text-text font-display text-xl mb-3">Application Status Breakdown</h2>
      <div className="flex flex-wrap gap-3 mb-10 max-w-3xl">
        {Object.entries(stats.status_breakdown).map(([status, count]) => (
          <div key={status} className="bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-text font-medium">{count}</span>
            <span className="text-muted text-xs">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* Per-job table */}
      <h2 className="text-text font-display text-xl mb-3">Performance by Job</h2>
      {stats.jobs.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
          <p className="text-text font-medium mb-1">No jobs posted yet</p>
          <p className="text-muted text-sm">Post your first job to start seeing reports here.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Job Title</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Applicants</th>
                <th className="text-left px-4 py-3">Avg. Score</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {stats.jobs.map((job) => (
                <tr key={job.job_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{job.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        job.status === "open"
                          ? "text-success bg-success/10 border-success/30"
                          : "text-muted bg-surface-2 border-border"
                      }`}
                    >
                      {job.status === "open" ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text">{job.applicant_count}</td>
                  <td className={`px-4 py-3 font-medium ${scoreColor(job.average_match_score)}`}>
                    {job.average_match_score}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => navigate("/applicants")} className="text-gold text-xs hover:underline">
                      View applicants →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

export default RecruiterDashboard;