// AdminPortalCompanies.jsx
// Super Admin manages the list of companies on the platform.

import { useEffect, useState } from "react";
import AdminPortalShell from "../components/AdminPortalShell";
import { adminApiRequest } from "../api/adminClient";

function AdminPortalCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    adminApiRequest("/admin-portal/companies")
      .then(setCompanies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await adminApiRequest("/admin-portal/companies", "POST", { name: newName });
      setNewName("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(company) {
    const nextStatus = company.status === "active" ? "suspended" : "active";
    try {
      await adminApiRequest(`/admin-portal/companies/${company.id}/status?status=${nextStatus}`, "PUT");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminPortalShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">SUPER ADMIN</p>
      <h1 className="font-display text-3xl text-text mb-8">Companies</h1>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2 mb-6 max-w-md">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New company name"
          className="flex-1 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-gold hover:bg-gold-dim transition text-ink font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50"
        >
          + Add
        </button>
      </form>

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : companies.length === 0 ? (
        <p className="text-muted text-sm">No companies yet.</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Recruiters</th>
                <th className="text-left px-4 py-3">Jobs</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{c.name}</td>
                  <td className="px-4 py-3 text-text">{c.recruiter_count}</td>
                  <td className="px-4 py-3 text-text">{c.job_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        c.status === "active"
                          ? "text-success bg-success/10 border-success/30"
                          : "text-danger bg-danger/10 border-danger/30"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleStatus(c)} className="text-gold text-xs hover:underline">
                      {c.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPortalShell>
  );
}

export default AdminPortalCompanies;