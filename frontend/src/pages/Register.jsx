// Register.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import BrandPanel from "../components/BrandPanel";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "candidate",
  });
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
      await apiRequest("/auth/register", "POST", form);
      navigate("/login");
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
          <p className="font-mono text-xs text-gold tracking-widest mb-2">GET STARTED</p>
          <h1 className="font-display text-3xl text-text mb-1">Create your account</h1>
          <p className="text-muted text-sm mb-8">Join as a candidate or a recruiter.</p>

          {error && (
            <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                name="full_name"
                required
                value={form.full_name}
                onChange={handleChange}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                placeholder="Jane Doe"
              />
            </div>

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
                minLength={6}
                value={form.password}
                onChange={handleChange}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wide">I am a...</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
              >
                <option value="candidate">Candidate — looking for a job</option>
                <option value="recruiter">Recruiter — hiring talent</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="text-muted text-sm mt-6 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-gold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;