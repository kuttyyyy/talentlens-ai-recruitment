# verification_routes.py
# Module 10 -- Candidate Verification (expanded).
#
# A candidate voluntarily uploads documents -- education, employment,
# government ID, medical certificate, address proof, reference letter, or
# other -- and consents to them being checked for self-consistency. This
# is NOT a connection to any authoritative third-party verification
# source. Phone verification of an institution is never placed
# automatically -- the system only prepares a call script; a human
# recruiter makes the real call and records what they heard.

import os
import shutil
import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.resume_parser import extract_text
from app.ai_engine import compare_document_to_declared_info, cross_check_documents

router = APIRouter(prefix="/verification", tags=["Candidate Verification (Module 10)"])

UPLOAD_FOLDER = "uploaded_verification_documents"
VALID_DOCUMENT_TYPES = (
    "education", "employment", "government_id",
    "medical_certificate", "address_proof", "reference_letter", "other",
)


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


def _hash_file(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def _check_metadata(file_path: str) -> tuple[bool, str]:
    """Cheap, honest file-metadata sanity check. Only ever a flag for a
    human to look at -- never proof of forgery, and PDF metadata is
    trivially editable, so this catches carelessness more than real fraud."""
    if not file_path.lower().endswith(".pdf"):
        return False, ""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        meta = reader.metadata
        if meta and meta.get("/Producer") and "scan" not in str(meta.get("/Producer", "")).lower():
            # Not a strong signal on its own -- deliberately not flagging based on
            # producer alone. Kept as a hook for future stronger checks.
            pass
        return False, ""
    except Exception:
        return False, ""


def _doc_to_out(doc: models.VerificationDocument) -> dict:
    return {
        "id": doc.id,
        "candidate_id": doc.candidate_id,
        "document_type": doc.document_type,
        "comparison_result": doc.comparison_result,
        "comparison_notes": doc.comparison_notes,
        "institution_name": doc.institution_name,
        "institution_phone": doc.institution_phone,
        "institution_contact_name": doc.institution_contact_name,
        "phone_verification_status": doc.phone_verification_status,
        "phone_verification_notes": doc.phone_verification_notes,
        "phone_verified_at": doc.phone_verified_at,
        "duplicate_of_candidate_id": doc.duplicate_of_candidate_id,
        "metadata_flag": doc.metadata_flag,
        "metadata_notes": doc.metadata_notes,
        "cross_check_notes": doc.cross_check_notes,
        "uploaded_at": doc.uploaded_at,
    }


@router.post("/upload/{candidate_id}")
def upload_verification_document(
    candidate_id: int,
    consent: bool = Form(...),
    document_type: str = Form(...),
    institution_name: str = Form(None),
    institution_phone: str = Form(None),
    institution_contact_name: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """A candidate uploads a document for self-consistency checking, plus
    (for education/employment) optional institution contact info that lets
    a recruiter later place a real, manual verification call."""
    if not consent:
        raise HTTPException(status_code=400, detail="Consent is required before uploading a verification document")

    if document_type not in VALID_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"document_type must be one of: {', '.join(VALID_DOCUMENT_TYPES)}")

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

    # --- Fraud-detection signal 1: duplicate file across DIFFERENT candidates ---
    file_hash = _hash_file(file_path)
    duplicate = (
        db.query(models.VerificationDocument)
        .filter(models.VerificationDocument.file_hash == file_hash, models.VerificationDocument.candidate_id != candidate_id)
        .first()
    )
    duplicate_of_candidate_id = duplicate.candidate_id if duplicate else None

    # --- Fraud-detection signal 2: basic metadata sanity check ---
    metadata_flag, metadata_notes = _check_metadata(file_path)

    # --- AI self-consistency check against declared profile ---
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
        institution_name=institution_name,
        institution_phone=institution_phone,
        institution_contact_name=institution_contact_name,
        phone_verification_status="not_started" if institution_phone else None,
        file_hash=file_hash,
        duplicate_of_candidate_id=duplicate_of_candidate_id,
        metadata_flag=metadata_flag,
        metadata_notes=metadata_notes,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # --- Fraud-detection signal 3: cross-check against this candidate's OTHER documents ---
    all_docs = (
        db.query(models.VerificationDocument)
        .filter(models.VerificationDocument.candidate_id == candidate_id)
        .all()
    )
    if len(all_docs) >= 2:
        cross_result = cross_check_documents([
            {"document_type": d.document_type, "extracted_text": d.extracted_text} for d in all_docs
        ])
        if cross_result and not cross_result.get("consistent", True):
            for d in all_docs:
                d.cross_check_notes = cross_result.get("notes")
            db.commit()

    db.refresh(doc)
    return _doc_to_out(doc)


@router.put("/{document_id}/phone-verification")
def record_phone_verification(
    document_id: int,
    update: schemas.PhoneVerificationUpdate,
    recruiter_id: int,
    db: Session = Depends(get_db),
):
    """A recruiter records what they actually heard after manually calling
    the institution. We never auto-mark a phone call as done -- a human
    placed a real call and this just records the outcome."""
    doc = db.query(models.VerificationDocument).filter(models.VerificationDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if update.status not in ("confirmed", "could_not_confirm", "discrepancy_found"):
        raise HTTPException(status_code=400, detail="Invalid status")

    has_application = (
        db.query(models.Application)
        .join(models.Job, models.Application.job_id == models.Job.id)
        .filter(models.Application.candidate_id == doc.candidate_id, models.Job.recruiter_id == recruiter_id)
        .first()
    )
    if not has_application:
        raise HTTPException(status_code=403, detail="This candidate hasn't applied to any of your jobs")

    from datetime import datetime, timezone
    doc.phone_verification_status = update.status
    doc.phone_verification_notes = update.notes
    doc.phone_verified_by_id = recruiter_id
    doc.phone_verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)
    return _doc_to_out(doc)


@router.get("/call-script/{document_id}")
def get_call_script(document_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Generates a plain checklist for the recruiter to use when they
    manually call the institution -- never an automated call."""
    doc = db.query(models.VerificationDocument).filter(models.VerificationDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.institution_phone:
        raise HTTPException(status_code=400, detail="No institution phone number was provided for this document")

    has_application = (
        db.query(models.Application)
        .join(models.Job, models.Application.job_id == models.Job.id)
        .filter(models.Application.candidate_id == doc.candidate_id, models.Job.recruiter_id == recruiter_id)
        .first()
    )
    if not has_application:
        raise HTTPException(status_code=403, detail="This candidate hasn't applied to any of your jobs")

    label = "school/college" if doc.document_type == "education" else "employer"
    return {
        "institution_name": doc.institution_name,
        "institution_phone": doc.institution_phone,
        "institution_contact_name": doc.institution_contact_name,
        "script": [
            f"Confirm you're speaking with someone authorized to verify records at this {label}.",
            "Confirm the candidate's full name matches their records.",
            f"Confirm the {'degree/program and dates attended' if doc.document_type == 'education' else 'job title and employment dates'} match what was declared.",
            "Note anything that does NOT match, even minor discrepancies.",
            "Record the result below once you've made the call.",
        ],
    }


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
    """A recruiter's view of a candidate's verification documents, plus a
    rolled-up summary so they don't have to read every document
    individually. Only recruiters who've actually received an application
    from this candidate can see this."""
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

    flags = []
    for d in docs:
        if d.comparison_result == "inconsistent":
            flags.append(f"{d.document_type}: content inconsistent with declared profile info")
        if d.duplicate_of_candidate_id:
            flags.append(f"{d.document_type}: identical file previously uploaded by a different candidate")
        if d.metadata_flag:
            flags.append(f"{d.document_type}: {d.metadata_notes}")
        if d.cross_check_notes:
            flags.append(f"Cross-document check: {d.cross_check_notes}")
        if d.phone_verification_status == "discrepancy_found":
            flags.append(f"{d.document_type}: phone verification found a discrepancy -- {d.phone_verification_notes}")

    summary = {
        "documents_submitted": len(docs),
        "verified_count": sum(1 for d in docs if d.comparison_result == "verified"),
        "inconsistent_count": sum(1 for d in docs if d.comparison_result == "inconsistent"),
        "needs_review_count": sum(1 for d in docs if d.comparison_result == "needs_review"),
        "flags": flags,
    }

    return {"summary": summary, "documents": [_doc_to_out(d) for d in docs]}