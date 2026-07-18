// Dashboard.jsx
import AppShell from "../components/AppShell";

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

      {user?.role === "candidate" && (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-md">
          <p className="text-text font-medium mb-1">Get started</p>
          <p className="text-muted text-sm mb-4">Upload your resume so our AI can analyze your skills, education, and experience.</p>
          <a href="/upload-resume" className="inline-block bg-gold hover:bg-gold-dim transition text-ink font-semibold text-sm px-4 py-2 rounded-lg">Upload Resume</a>
        </div>
      )}

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