// Assessments.jsx
// Recruiter's list of JD-Based Agentic AI Assessments they've created.
// Entry point into the new module: Create Job Assessment -> pipeline.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const STATUS_LABEL = {
  draft: "Draft — needs analysis",
  analyzed: "Analyzed — ready to generate tests",
  tests_generated: "Tests generated — needs review",
  approved: "Approved",
};

const STATUS_STYLE = {
  draft: "bg-muted/10 text-muted border-border",
  analyzed: "bg-signal/10 text-signal border-signal/30",
  tests_generated: "bg-gold/10 text-gold border-gold/30",
  approved: "bg-success/10 text-success border-success/30",
};

function Assessments() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${BASE_URL}/assessments/recruiter/${user.id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to load assessments");
        setAssessments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-mono text-xs text-gold tracking-widest mb-2">JD-BASED AGENTIC AI ASSESSMENT</p>
          <h1 className="font-display text-3xl text-text mb-2">Job Assessments</h1>
          <p className="text-muted max-w-lg">
            Turn a job description into 3 AI-generated tests: Knowledge & Reasoning,
            Situational Judgment, and a Practical Job Simulation.
          </p>
        </div>
        <Link
          to="/assessments/new"
          className="bg-gold hover:bg-gold-dim transition text-ink font-semibold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap"
        >
          + New Assessment
        </Link>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : assessments.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center max-w-lg">
          <p className="text-text font-medium mb-1">No assessments yet</p>
          <p className="text-muted text-sm mb-4">
            Paste in a job description and let the AI build a job-specific test suite.
          </p>
          <Link
            to="/assessments/new"
            className="inline-block bg-gold hover:bg-gold-dim transition text-ink font-semibold text-sm px-4 py-2 rounded-lg"
          >
            Create your first assessment
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {assessments.map((a) => (
            <Link
              key={a.id}
              to={`/assessments/${a.id}`}
              className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between hover:border-gold/50 transition"
            >
              <div>
                <p className="text-text font-medium">{a.title}</p>
                <p className="text-muted text-xs mt-1">
                  Created {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLE[a.status] || STATUS_STYLE.draft}`}
              >
                {STATUS_LABEL[a.status] || a.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default Assessments;
