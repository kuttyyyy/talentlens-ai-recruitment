# verification_routes.py
# Module 10 -- Candidate Verification.
#
# A candidate voluntarily uploads a document (degree certificate,
# employment letter, etc.) and consents to it being compared against what
# they've already declared on their own profile. This is a SELF-CONSISTENCY
# check only -- there is no connection to any authoritative third-party
# verification source, and results never claim more certainty than that.

import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.resume_parser import extract_text
from app.ai_engine import compare_document_to_declared_info

router = APIRouter(prefix="/verification", tags=["Candidate Verification (Module 10)"])

UPLOAD_FOLDER = "uploaded_verification_documents"


def _declared_info_for(document_type: str, profile: models.CandidateProfile) -> str:
    """Pulls whatever the candidate themselves declared that's relevant to
    this document type, straight from their own profile (Module 2) --
    never from AI-extracted resume data, since the point is comparing two
    things the candidate provided, not the resume against itself."""
    if document_type == "education":
        return profile.education_json or "(candidate has not declared any education on their profile)"
    if document_type == "employment":
        return profile.experience_json or "(candidate has not declared any work experience on their profile)"
    return (profile.education_json or "") + "\n" + (profile.experience_json or "") or "(no declared profile info available)"


def _doc_to_out(doc: models.VerificationDocument) -> dict:
    return {
        "id": doc.id,
        "candidate_id": doc.candidate_id,
        "document_type": doc.document_type,
        "comparison_result": doc.comparison_result,
        "comparison_notes": doc.comparison_notes,
        "uploaded_at": doc.uploaded_at,
    }


@router.post("/upload/{candidate_id}")
def upload_verification_document(
    candidate_id: int,
    consent: bool = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """A candidate uploads a document for self-consistency checking.
    Requires explicit consent -- refuses outright without it."""
    if not consent:
        raise HTTPException(status_code=400, detail="Consent is required before uploading a verification document")

    if document_type not in ("education", "employment", "other"):
        raise HTTPException(status_code=400, detail="document_type must be 'education', 'employment', or 'other'")

    if not file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF or DOCX files are allowed")

    profile = db.query(models.CandidateProfile).filter(models.CandidateProfile.user_id == candidate_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    safe_filename = f"user_{candidate_id}_{document_type}_{file.filename}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        extracted_text = extract_text(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    declared_info = _declared_info_for(document_type, profile)
    comparison = compare_document_to_declared_info(document_type, extracted_text, declared_info)

    doc = models.VerificationDocument(
        candidate_id=candidate_id,
        document_type=document_type,
        file_path=file_path,
        extracted_text=extracted_text,
        consent_given=True,
        comparison_result=comparison["result"] if comparison else "unable_to_verify",
        comparison_notes=comparison["notes"] if comparison else "Automated comparison unavailable -- needs manual review.",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return _doc_to_out(doc)


@router.get("/candidate/{candidate_id}")
def list_candidate_documents(candidate_id: int, db: Session = Depends(get_db)):
    """A candidate's own view of what they've submitted and its status."""
    docs = (
        db.query(models.VerificationDocument)
        .filter(models.VerificationDocument.candidate_id == candidate_id)
        .order_by(models.VerificationDocument.uploaded_at.desc())
        .all()
    )
    return [_doc_to_out(d) for d in docs]


@router.get("/recruiter/{candidate_id}")
def list_documents_for_recruiter(candidate_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """A recruiter's view of a candidate's verification documents, for the
    detailed candidate report. Only recruiters who've actually received an
    application from this candidate can see this."""
    has_application = (
        db.query(models.Application)
        .join(models.Job, models.Application.job_id == models.Job.id)
        .filter(models.Application.candidate_id == candidate_id, models.Job.recruiter_id == recruiter_id)
        .first()
    )
    if not has_application:
        raise HTTPException(status_code=403, detail="This candidate hasn't applied to any of your jobs")

    docs = (
        db.query(models.VerificationDocument)
        .filter(models.VerificationDocument.candidate_id == candidate_id)
        .order_by(models.VerificationDocument.uploaded_at.desc())
        .all()
    )
    return [_doc_to_out(d) for d in docs]
