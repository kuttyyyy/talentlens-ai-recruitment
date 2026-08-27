// Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { apiRequest } from "../api/client";

const STATUS_STYLE = {
  applied: "bg-muted/10 text-muted border-border",
  shortlisted: "bg-signal/10 text-signal border-signal/30",
  interview_scheduled: "bg-gold/10 text-gold border-gold/30",
  rejected: "bg-danger/10 text-danger border-danger/30",
  hired: "bg-success/10 text-success border-success/30",
};

function CandidateDashboard({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiRequest(`/candidate/dashboard/${user.id}`);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  if (loading) return <p className="text-muted text-sm">Loading your dashboard...</p>;
  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 max-w-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Profile completion */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-text font-medium">Profile Completion</p>
          <span className="text-gold font-semibold">{data.profile_completion}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all"
            style={{ width: `${data.profile_completion}%` }}
          />
        </div>
        {data.profile_completion < 100 && (
          <Link to="/profile" className="inline-block text-xs text-gold hover:text-gold-dim mt-3">
            Complete your profile →
          </Link>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-2xl font-display text-text">{data.available_jobs}</p>
          <p className="text-muted text-xs mt-1">Available Jobs</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-2xl font-display text-text">{data.applied_jobs_count}</p>
          <p className="text-muted text-xs mt-1">Applications</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-2xl font-display text-text">{data.assessments_completed}</p>
          <p className="text-muted text-xs mt-1">Assessments Completed</p>
        </div>
      </div>

      {/* Applied jobs / application status */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg text-text">Your Applications</p>
          <Link to="/my-applications" className="text-xs text-gold hover:text-gold-dim">
            View all →
          </Link>
        </div>
        {data.applied_jobs.length === 0 ? (
          <p className="text-muted text-sm">
            You haven't applied to any jobs yet.{" "}
            <Link to="/browse-jobs" className="text-gold hover:text-gold-dim">
              Browse open roles
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.applied_jobs.slice(0, 5).map((a) => (
              <div
                key={a.application_id}
                className="flex items-center justify-between border border-border rounded-lg px-4 py-3"
              >
                <p className="text-text text-sm font-medium">{a.job_title}</p>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize whitespace-nowrap ${
                    STATUS_STYLE[a.status] || STATUS_STYLE.applied
                  }`}
                >
                  {a.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assessment status — placeholder until the candidate testing module is built */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="font-display text-lg text-text mb-2">Assessments</p>
        <p className="text-muted text-sm">
          Upcoming and in-progress assessments will show up here once you're invited to take one.
        </p>
      </div>

      {/* Notifications */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="font-display text-lg text-text mb-3">Notifications</p>
        {data.notifications.length === 0 ? (
          <p className="text-muted text-sm">No notifications yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.notifications.map((n, i) => (
              <li key={i} className="text-text text-sm border-l-2 border-gold pl-3">
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!data.applied_jobs.length && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-text font-medium mb-1">Get started</p>
          <p className="text-muted text-sm mb-4">Upload your resume so our AI can analyze your skills, education, and experience.</p>
          <Link to="/upload-resume" className="inline-block bg-gold hover:bg-gold-dim transition text-ink font-semibold text-sm px-4 py-2 rounded-lg">Upload Resume</Link>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1 className="font-display text-3xl text-text mb-2">
        Welcome back, {user?.full_name?.split(" ")[0]}
      </h1>
      <p className="text-muted mb-10">
        You're signed in as a <span className="text-text capitalize">{user?.role}</span>.
      </p>

      {user?.role === "candidate" && <CandidateDashboard user={user} />}

      {user?.role === "recruiter" && (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-md">
          <p className="text-text font-medium mb-1">Get started</p>
          <p className="text-muted text-sm mb-4">Post your first job listing to start receiving candidates.</p>
          <a href="/post-job" className="inline-block bg-gold hover:bg-gold-dim transition text-ink font-semibold text-sm px-4 py-2 rounded-lg">Post a Job</a>
        </div>
      )}
    </AppShell>
  );
}

export default Dashboard;
