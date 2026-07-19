// ResumeUpload.jsx
// Lets a logged-in candidate upload their resume (PDF or DOCX).
// After upload, we show what the AI extracted: skills, education, experience.

import { useState } from "react";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
function ResumeUpload() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(e) {
    setFile(e.target.files[0]);
    setResult(null);
    setError("");
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a PDF or DOCX file first.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${BASE_URL}/candidate/upload-resume/${user.id}`,
        { method: "POST", body: formData }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">CANDIDATE PROFILE</p>
      <h1 className="font-display text-3xl text-text mb-2">Upload your resume</h1>
      <p className="text-muted mb-8 max-w-lg">
        PDF or DOCX only. Our AI reads it automatically and pulls out your
        skills, education, and experience.
      </p>

      <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-surface-2 file:text-text file:cursor-pointer hover:file:bg-border transition"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
          >
            {loading ? "Analyzing resume..." : "Upload & Analyze"}
          </button>
        </form>

        {result && (
          <div className="mt-6 bg-surface-2 border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-success text-sm font-medium">✓ {result.message}</h2>
              {result.ai_powered ? (
                <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/30">
                  AI Analyzed
                </span>
              ) : (
                <span className="text-xs bg-muted/10 text-muted px-2 py-0.5 rounded-full border border-border">
                  Basic scan
                </span>
              )}
            </div>

            {result.summary && (
              <div className="mb-4 pb-4 border-b border-border">
                <p className="text-xs text-muted uppercase tracking-wide mb-1">AI Summary</p>
                <p className="text-text text-sm leading-relaxed">{result.summary}</p>
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs text-muted uppercase tracking-wide mb-2">Skills Detected</p>
              <div className="flex flex-wrap gap-2">
                {result.skills.length > 0 ? (
                  result.skills.map((skill) => (
                    <span
                      key={skill}
                      className="bg-gold/10 text-gold text-xs px-2.5 py-1 rounded-full border border-gold/30"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-muted text-sm">None detected</span>
                )}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Education</p>
              <p className="text-text text-sm">{result.education}</p>
            </div>

            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Experience</p>
              <p className="text-text text-sm">{result.experience}</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default ResumeUpload;