// AdminPortalLogin.jsx
// A completely separate login screen for the Admin Portal. Not linked
// from anywhere on the public site -- reached only by navigating to
// /admin-portal/login directly. The real security boundary is the
// backend's role + password check, not this page being hard to find.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApiRequest, setAdminSession } from "../api/adminClient";

function AdminPortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await adminApiRequest("/admin-portal/login", "POST", { email, password });
      setAdminSession(data.access_token, data.admin);
      navigate("/admin-portal/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs text-gold tracking-widest text-center mb-2">TALENTLENS</p>
        <h1 className="font-display text-2xl text-text text-center mb-8">Admin Portal</h1>

        <div className="bg-surface border border-border rounded-xl p-6">
          {error && (
            <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50 mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-muted/60 text-xs text-center mt-6">Authorized personnel only.</p>
      </div>
    </div>
  );
}

export default AdminPortalLogin;
