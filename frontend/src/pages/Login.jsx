// Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import BrandPanel from "../components/BrandPanel";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/login", "POST", form);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <BrandPanel />

      <div className="w-full md:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-xs text-gold tracking-widest mb-2">WELCOME BACK</p>
          <h1 className="font-display text-3xl text-text mb-1">Log in to TalentLens</h1>
          <p className="text-muted text-sm mb-8">Pick up right where you left off.</p>

          {error && (
            <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Email</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Password</label>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <p className="text-muted text-sm mt-6 text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-gold hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;