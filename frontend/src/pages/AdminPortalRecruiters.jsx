// AdminPortalRecruiters.jsx
// Super Admin manages every recruiter: which company they belong to, and
// what permissions they have -- this is the RBAC/permission structure
// screen. Also where account status (warn/suspend/disable/ban) is set.

import { useEffect, useState } from "react";
import AdminPortalShell from "../components/AdminPortalShell";
import { adminApiRequest } from "../api/adminClient";

function PermissionEditor({ recruiter, companies, onSaved }) {
  const [companyId, setCompanyId] = useState(recruiter.company_id || "");
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(recruiter.is_company_admin);
  const [canViewCompanyWide, setCanViewCompanyWide] = useState(recruiter.can_view_company_wide);
  const [canManageRecruiters, setCanManageRecruiters] = useState(recruiter.can_manage_recruiters);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await adminApiRequest(`/admin-portal/recruiters/${recruiter.id}/permissions`, "PUT", {
        company_id: companyId ? Number(companyId) : null,
        is_company_admin: isCompanyAdmin,
        can_view_company_wide: canViewCompanyWide,
        can_manage_recruiters: canManageRecruiters,
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 mt-2 bg-ink/40">
      {error && <p className="text-danger text-xs mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-muted uppercase">Company</label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-text text-sm"
          >
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-3 text-sm">
        <label className="flex items-center gap-2 text-text">
          <input type="checkbox" checked={isCompanyAdmin} onChange={(e) => setIsCompanyAdmin(e.target.checked)} />
          Company Admin (sees all of their company's jobs/candidates)
        </label>
        <label className="flex items-center gap-2 text-text">
          <input type="checkbox" checked={canViewCompanyWide} onChange={(e) => setCanViewCompanyWide(e.target.checked)} />
          Can view company-wide (without being a Company Admin)
        </label>
        <label className="flex items-center gap-2 text-text">
          <input type="checkbox" checked={canManageRecruiters} onChange={(e) => setCanManageRecruiters(e.target.checked)} />
          Can manage other recruiters in their company
        </label>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Permissions"}
      </button>
    </div>
  );
}

function StatusEditor({ recruiter, onSaved }) {
  const [status, setStatus] = useState(recruiter.account_status);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await adminApiRequest(`/admin-portal/users/${recruiter.id}/status`, "PUT", {
        account_status: status,
        reason: reason || null,
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-text"
      >
        {["active", "warned", "suspended", "disabled", "banned"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-text"
      />
      <button
        onClick={save}
        disabled={saving}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-50"
      >
        Update Status
      </button>
    </div>
  );
}

function AdminPortalRecruiters() {
  const [recruiters, setRecruiters] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([adminApiRequest("/admin-portal/recruiters"), adminApiRequest("/admin-portal/companies")])
      .then(([r, c]) => {
        setRecruiters(r);
        setCompanies(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function handleUpdated(updated) {
    setRecruiters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const ACCOUNT_STATUS_STYLE = {
    active: "text-success bg-success/10 border-success/30",
    warned: "text-gold bg-gold/10 border-gold/30",
    suspended: "text-danger bg-danger/10 border-danger/30",
    disabled: "text-muted bg-muted/10 border-border",
    banned: "text-danger bg-danger/10 border-danger/30",
  };

  return (
    <AdminPortalShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">SUPER ADMIN</p>
      <h1 className="font-display text-3xl text-text mb-2">Recruiters & Permissions</h1>
      <p className="text-muted mb-8 max-w-lg">
        Assign recruiters to companies, grant Company Admin / company-wide visibility, and manage account status.
      </p>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-lg">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : recruiters.length === 0 ? (
        <p className="text-muted text-sm">No recruiters registered yet.</p>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {recruiters.map((r) => (
            <div key={r.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text font-medium text-sm">{r.full_name}</p>
                  <p className="text-muted text-xs">
                    {r.email} {r.company_name && `· ${r.company_name}`}
                    {r.is_company_admin && " · Company Admin"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${ACCOUNT_STATUS_STYLE[r.account_status]}`}>
                    {r.account_status}
                  </span>
                  <button
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="text-gold text-xs hover:underline"
                  >
                    {expandedId === r.id ? "Close" : "Manage"}
                  </button>
                </div>
              </div>

              {expandedId === r.id && (
                <>
                  <PermissionEditor recruiter={r} companies={companies} onSaved={handleUpdated} />
                  <StatusEditor recruiter={r} onSaved={handleUpdated} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminPortalShell>
  );
}

export default AdminPortalRecruiters;