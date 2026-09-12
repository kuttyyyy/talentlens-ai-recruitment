// Verification.jsx
// Module 10 (expanded) — Candidate Verification.
// A consent-based, self-service upload for a wider range of supporting
// documents. Compares each document against what the candidate already
// declared, checks it against the candidate's OTHER uploaded documents,
// flags duplicate-file and basic metadata signals, and — for
// education/employment — lets the candidate provide an institution phone
// number so a recruiter can place a real, manual verification call.

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

const DOCUMENT_TYPE_OPTIONS = [
  { value: "education", label: "Education (degree, transcript, certificate)" },
  { value: "employment", label: "Employment (offer letter, experience letter)" },
  { value: "government_id", label: "Government ID" },
  { value: "medical_certificate", label: "Medical Certificate" },
  { value: "address_proof", label: "Address Proof" },
  { value: "reference_letter", label: "Reference Letter" },
  { value: "other", label: "Other" },
];

const NEEDS_INSTITUTION = ["education", "employment"];

function Verification() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [documentType, setDocumentType] = useState("education");
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [institutionName, setInstitutionName] = useState("");
  const [institutionPhone, setInstitutionPhone] = useState("");
  const [institutionContactName, setInstitutionContactName] = useState("");
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
    if (NEEDS_INSTITUTION.includes(documentType)) {
      formData.append("institution_name", institutionName);
      formData.append("institution_phone", institutionPhone);
      formData.append("institution_contact_name", institutionContactName);
    }

    try {
      const response = await fetch(`${BASE_URL}/verification/upload/${user.id}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Upload failed");
      setFile(null);
      setConsent(false);
      setInstitutionName("");
      setInstitutionPhone("");
      setInstitutionContactName("");
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
      <h1 className="font-display text-3xl text-text mb-2">Verify Your Documents</h1>
      <p className="text-muted mb-8 max-w-lg">
        Upload supporting documents so recruiters can see they're consistent with what you've
        already told us. This checks your documents against your own declared information and
        against each other — it is not a third-party background check, and nothing here affects
        your applications automatically.
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
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {NEEDS_INSTITUTION.includes(documentType) && (
            <div className="bg-ink/40 border border-border rounded-lg p-3 flex flex-col gap-3">
              <p className="text-xs text-muted">
                Optional: provide the institution's contact info so a recruiter can place a real
                phone call to confirm this document, if they choose to.
              </p>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder={documentType === "education" ? "School/college name" : "Employer name"}
                className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
              />
              <input
                type="text"
                value={institutionPhone}
                onChange={(e) => setInstitutionPhone(e.target.value)}
                placeholder="Institution phone number"
                className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
              />
              <input
                type="text"
                value={institutionContactName}
                onChange={(e) => setInstitutionContactName(e.target.value)}
                placeholder="Contact name (optional)"
                className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
              />
            </div>
          )}

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
              information I've already provided, so recruiters I apply to can see the result.
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
            <div key={doc.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text text-sm capitalize">{doc.document_type.replace("_", " ")} document</p>
                  <p className="text-muted text-xs mt-1">{doc.comparison_notes}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${RESULT_STYLE[doc.comparison_result] || RESULT_STYLE.unable_to_verify}`}
                >
                  {RESULT_LABEL[doc.comparison_result] || doc.comparison_result}
                </span>
              </div>

              {doc.institution_phone && (
                <div className="mt-3 pt-3 border-t border-border text-xs">
                  <p className="text-muted">
                    Phone verification: <span className="text-text capitalize">{(doc.phone_verification_status || "not started").replace("_", " ")}</span>
                  </p>
                  {doc.phone_verification_notes && <p className="text-muted mt-1">{doc.phone_verification_notes}</p>}
                </div>
              )}

              {doc.duplicate_of_candidate_id && (
                <p className="text-danger text-xs mt-2">⚠ This exact file was previously uploaded by a different candidate.</p>
              )}
              {doc.cross_check_notes && (
                <p className="text-gold text-xs mt-2">⚠ Cross-document check: {doc.cross_check_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default Verification;