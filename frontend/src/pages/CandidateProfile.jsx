// CandidateProfile.jsx
// Module 2 — Candidate Registration & Profile.
// Lets a candidate view and edit everything about their own profile:
// contact links, skills, education, experience, internships,
// certifications, and projects. Also shows what the AI found in their
// uploaded resume, read-only, for reference.

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { apiRequest } from "../api/client";

const inputClass =
  "w-full mt-1 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm";

function FieldLabel({ children }) {
  return <label className="text-xs text-muted uppercase tracking-wide">{children}</label>;
}

// Generic editor for a list of entries where each entry is a small object
// (education, experience, internships, certifications, projects all share
// this shape — an array of flat objects with 2-4 text fields each).
function EntryListEditor({ label, items, fields, onChange, emptyEntry }) {
  function update(i, key, value) {
    const next = items.map((item, idx) => (idx === i ? { ...item, [key]: value } : item));
    onChange(next);
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { ...emptyEntry }]);
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-3 mt-2">
        {items.map((item, i) => (
          <div key={i} className="border border-border rounded-lg p-3 bg-ink/40">
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                  <span className="text-[10px] text-muted/70 uppercase">{f.label}</span>
                  <input
                    type="text"
                    value={item[f.key] || ""}
                    placeholder={f.placeholder}
                    onChange={(e) => update(i, f.key, e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-muted hover:text-danger mt-2"
            >
              ✕ Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={add} className="text-sm text-gold hover:text-gold-dim text-left">
          + Add {label.replace(/s$/, "")}
        </button>
      </div>
    </div>
  );
}

function CandidateProfile() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [internships, setInternships] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest(`/candidate/profile/${user.id}`);
        setProfile(data);
        setPhone(data.phone || "");
        setLinkedinUrl(data.linkedin_url || "");
        setPortfolioUrl(data.portfolio_url || "");
        setSkillsInput((data.skills || []).join(", "));
        setEducation(data.education || []);
        setExperience(data.experience || []);
        setInternships(data.internships || []);
        setCertifications(data.certifications || []);
        setProjects(data.projects || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await apiRequest(`/candidate/profile/${user.id}`, "PUT", {
        phone,
        linkedin_url: linkedinUrl,
        portfolio_url: portfolioUrl,
        skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean),
        education,
        experience,
        internships,
        certifications,
        projects,
      });
      setProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">CANDIDATE PROFILE</p>
      <h1 className="font-display text-3xl text-text mb-2">My Profile</h1>
      <p className="text-muted mb-2 max-w-lg">
        Keep this up to date — recruiters and the AI matching engine use it when you apply.
      </p>
      {profile && (
        <p className="text-xs text-gold mb-8">Profile completion: {profile.profile_completion}%</p>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-2xl">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-success/10 border border-success/40 text-success text-sm rounded-lg px-3 py-2 mb-4 max-w-2xl">
          ✓ Profile saved.
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-2xl">
        {/* Basic info */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="font-display text-lg text-text mb-4">Basic Information</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <FieldLabel>Full Name</FieldLabel>
              <input type="text" value={profile?.full_name || ""} disabled className={inputClass + " opacity-60"} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input type="text" value={profile?.email || ""} disabled className={inputClass + " opacity-60"} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div />
            <div>
              <FieldLabel>LinkedIn URL</FieldLabel>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel>Portfolio URL</FieldLabel>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <FieldLabel>Skills (comma-separated)</FieldLabel>
          <input
            type="text"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="Python, SQL, Excel, Communication"
            className={inputClass}
          />
        </div>

        {/* Education */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <EntryListEditor
            label="Education"
            items={education}
            onChange={setEducation}
            emptyEntry={{ degree: "", institution: "", year: "" }}
            fields={[
              { key: "degree", label: "Degree", placeholder: "B.Tech Computer Science" },
              { key: "institution", label: "Institution", placeholder: "XYZ University" },
              { key: "year", label: "Year", placeholder: "2024" },
            ]}
          />
        </div>

        {/* Experience */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <EntryListEditor
            label="Work Experience"
            items={experience}
            onChange={setExperience}
            emptyEntry={{ company: "", role: "", duration: "", description: "" }}
            fields={[
              { key: "company", label: "Company", placeholder: "Acme Inc." },
              { key: "role", label: "Role", placeholder: "Software Engineer" },
              { key: "duration", label: "Duration", placeholder: "Jan 2023 – Present" },
              { key: "description", label: "Description", placeholder: "What you did", wide: true },
            ]}
          />
        </div>

        {/* Internships */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <EntryListEditor
            label="Internships"
            items={internships}
            onChange={setInternships}
            emptyEntry={{ company: "", role: "", duration: "", description: "" }}
            fields={[
              { key: "company", label: "Company", placeholder: "Acme Inc." },
              { key: "role", label: "Role", placeholder: "Intern" },
              { key: "duration", label: "Duration", placeholder: "3 months" },
              { key: "description", label: "Description", placeholder: "What you did", wide: true },
            ]}
          />
        </div>

        {/* Certifications */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <EntryListEditor
            label="Certifications"
            items={certifications}
            onChange={setCertifications}
            emptyEntry={{ name: "", issuer: "", year: "" }}
            fields={[
              { key: "name", label: "Name", placeholder: "AWS Cloud Practitioner" },
              { key: "issuer", label: "Issuer", placeholder: "Amazon Web Services" },
              { key: "year", label: "Year", placeholder: "2024" },
            ]}
          />
        </div>

        {/* Projects */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <EntryListEditor
            label="Projects"
            items={projects}
            onChange={setProjects}
            emptyEntry={{ title: "", description: "", link: "" }}
            fields={[
              { key: "title", label: "Title", placeholder: "Portfolio Website" },
              { key: "link", label: "Link", placeholder: "https://..." },
              { key: "description", label: "Description", placeholder: "What it does", wide: true },
            ]}
          />
        </div>

        {/* AI-extracted resume info, read-only */}
        {profile?.has_resume && (
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display text-lg text-text">From Your Resume</p>
              <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/30">
                AI-extracted
              </span>
            </div>
            <p className="text-xs text-muted/70 mb-3">
              Read-only — re-upload your resume on the Upload Resume page to refresh this.
            </p>
            <div className="text-sm text-text flex flex-col gap-2">
              <p><span className="text-muted">Skills:</span> {profile.extracted_skills || "—"}</p>
              <p><span className="text-muted">Education:</span> {profile.extracted_education || "—"}</p>
              <p><span className="text-muted">Experience:</span> {profile.extracted_experience || "—"}</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </AppShell>
  );
}

export default CandidateProfile;
