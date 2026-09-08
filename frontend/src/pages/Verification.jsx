// Verification.jsx
// Module 10 — Candidate Verification.
// A consent-based, self-service upload for education/employment documents.
// Compares the document against what the candidate already declared on
// their own profile — NOT an authoritative third-party background check.

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const RESULT_STYLE = {
  verified: "text-success bg-success/10 border-success/30",
  inconsistent: "text-danger bg-danger/10 border-danger/30",
  needs_review: "text-gold bg-gold/10 border-gold/30",
  unable_to_verify: "text-muted bg-muted/10 border-border",
};

const RESULT_LABEL = {
  verified: "Verified",
  inconsistent: "Inconsistent",
  needs_review: "Needs Review",
  unable_to_verify: "Unable to Verify",
};

function Verification() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [documentType, setDocumentType] = useState("education");
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadDocuments() {
    setLoading(true);
    fetch(`${BASE_URL}/verification/candidate/${user.id}`)
      .then((res) => res.json())
      .then((data) => setDocuments(data || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose a PDF or DOCX file first.");
      return;
    }
    if (!consent) {
      setError("You must consent before uploading a document.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);
    formData.append("consent", "true");

    try {
      const response = await fetch(`${BASE_URL}/verification/upload/${user.id}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Upload failed");
      setFile(null);
      setConsent(false);
      loadDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">CANDIDATE VERIFICATION</p>
      <h1 className="font-display text-3xl text-text mb-2">Verify a Document</h1>
      <p className="text-muted mb-8 max-w-lg">
        Optionally upload a document (e.g. a degree certificate or an employment letter) so
        recruiters can see it's consistent with what you've already told us on your profile.
        This checks your document against your own declared information only — it is not a
        third-party background check, and nothing here affects your applications automatically.
      </p>

      <div className="bg-surface border border-border rounded-xl p-6 max-w-lg mb-8">
        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold"
            >
              <option value="education">Education (degree, transcript, certificate)</option>
              <option value="employment">Employment (offer letter, experience letter)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide">File (PDF or DOCX)</label>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full mt-1.5 text-sm text-text file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gold file:text-ink file:text-xs file:font-semibold"
            />
          </div>

          <div className="bg-ink/40 border border-border rounded-lg p-3">
            <label className="flex items-start gap-2 text-sm text-text">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              I consent to this document being securely stored and compared against the
              information I've already provided on my profile, so recruiters I apply to can see
              the result.
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </form>
      </div>

      <h2 className="text-text font-display text-xl mb-3">Your Documents</h2>
      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-muted text-sm">You haven't uploaded any documents yet.</p>
      ) : (
        <div className="flex flex-col gap-3 max-w-lg">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-text text-sm capitalize">{doc.document_type} document</p>
                <p className="text-muted text-xs mt-1">{doc.comparison_notes}</p>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${RESULT_STYLE[doc.comparison_result] || RESULT_STYLE.unable_to_verify}`}
              >
                {RESULT_LABEL[doc.comparison_result] || doc.comparison_result}
              </span>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default Verification;
