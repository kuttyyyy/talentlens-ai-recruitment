// MyAssessments.jsx
// Module 4 -- lists every approved assessment tied to a job the candidate
// applied to, with the status of each of its 3 tests and a way to start
// or continue each one.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { apiRequest } from "../api/client";

const TEST_META = {
  knowledge_reasoning: { label: "Knowledge & Reasoning", icon: "🧠" },
  situational_judgment: { label: "Situational Judgment", icon: "🧭" },
  practical_simulation: { label: "Practical Job Simulation", icon: "🛠️" },
};

const STATUS_STYLE = {
  not_started: "bg-muted/10 text-muted border-border",
  in_progress: "bg-gold/10 text-gold border-gold/30",
  submitted: "bg-success/10 text-success border-success/30",
};

const STATUS_LABEL = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
};

function MyAssessments() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest(`/test-attempts/candidate/${user.id}/assessments`);
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
      <p className="font-mono text-xs text-gold tracking-widest mb-2">MY ASSESSMENTS</p>
      <h1 className="font-display text-3xl text-text mb-2">Assessments</h1>
      <p className="text-muted mb-8 max-w-lg">
        Once a recruiter approves an assessment for a job you've applied to, its 3 tests show up here.
      </p>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-2xl">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : assessments.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center max-w-lg">
          <p className="text-text font-medium mb-1">No assessments yet</p>
          <p className="text-muted text-sm">
            Apply to a job and wait for the recruiter to approve its assessment — it'll appear here automatically.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-3xl">
          {assessments.map((a) => (
            <div key={a.application_id} className="bg-surface border border-border rounded-xl p-6">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">{a.job_title}</p>
              <p className="font-display text-lg text-text mb-4">{a.assessment_title}</p>

              <div className="flex flex-col gap-3">
                {a.tests.map((t) => {
                  const meta = TEST_META[t.test_type] || { label: t.title, icon: "📋" };
                  return (
                    <div
                      key={t.test_id}
                      className="flex items-center justify-between border border-border rounded-lg px-4 py-3"
                    >
                      <div>
                        <p className="text-text text-sm font-medium">
                          <span className="mr-2">{meta.icon}</span>
                          {meta.label}
                        </p>
                        <p className="text-muted text-xs mt-0.5">{t.duration_minutes} minutes</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLE[t.status]}`}
                        >
                          {STATUS_LABEL[t.status]}
                        </span>
                        {t.status === "submitted" ? (
                          <span className="text-xs text-muted">Waiting for evaluation</span>
                        ) : (
                          <Link
                            to={`/test/${a.application_id}/${t.test_id}`}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-dim transition text-ink whitespace-nowrap"
                          >
                            {t.status === "in_progress" ? "Continue" : "Start"}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default MyAssessments;
