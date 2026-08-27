# candidate_routes.py
# Endpoints for candidate-specific actions: resume upload/analysis,
# self-managed profile (Module 2), and the candidate dashboard.

import json
import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.resume_parser import parse_resume

router = APIRouter(prefix="/candidate", tags=["Candidate"])

UPLOAD_FOLDER = "uploaded_resumes"


def _get_profile_or_404(user_id: int, db: Session) -> models.CandidateProfile:
    profile = db.query(models.CandidateProfile).filter(
        models.CandidateProfile.user_id == user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return profile


def _parse_list(raw):
    """Safely parses a JSON list column; returns [] for anything unreadable."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _compute_profile_completion(user: models.User, profile: models.CandidateProfile) -> int:
    """A simple, transparent completion score — one point per filled-in
    section, so a candidate can see at a glance what's still missing."""
    checks = [
        bool(user.full_name),
        bool(user.email),
        bool(profile.phone),
        bool(profile.linkedin_url or profile.portfolio_url),
        bool(_parse_list(profile.education_json)),
        bool(profile.skills and profile.skills.strip()),
        bool(_parse_list(profile.experience_json)),
        bool(_parse_list(profile.projects_json)),
        bool(profile.resume_file_path),
    ]
    return round(100 * sum(checks) / len(checks))


def _profile_to_out(user: models.User, profile: models.CandidateProfile) -> schemas.CandidateProfileOut:
    skills = [s.strip() for s in (profile.skills or "").split(",") if s.strip()]
    return schemas.CandidateProfileOut(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=profile.phone,
        linkedin_url=profile.linkedin_url,
        portfolio_url=profile.portfolio_url,
        skills=skills,
        education=_parse_list(profile.education_json),
        experience=_parse_list(profile.experience_json),
        internships=_parse_list(profile.internships_json),
        certifications=_parse_list(profile.certifications_json),
        projects=_parse_list(profile.projects_json),
        has_resume=profile.resume_file_path is not None,
        extracted_skills=profile.extracted_skills,
        extracted_education=profile.extracted_education,
        extracted_experience=profile.extracted_experience,
        profile_completion=_compute_profile_completion(user, profile),
    )


@router.post("/upload-resume/{user_id}")
def upload_resume(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Only accept PDF or DOCX files
    if not file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF or DOCX files are allowed")

    # Make sure this user actually exists and is a candidate
    profile = _get_profile_or_404(user_id, db)

    # Save the uploaded file onto our computer, inside uploaded_resumes/
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    safe_filename = f"user_{user_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run our AI parsing logic on the saved file
    try:
        result = parse_resume(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    # Save everything the AI found into the candidate's profile
    profile.resume_file_path = file_path
    profile.resume_text = result["resume_text"]
    profile.extracted_skills = ", ".join(result["skills"])
    profile.extracted_education = result["education"]
    profile.extracted_experience = result["experience"]
    db.commit()
    db.refresh(profile)

    return {
        "message": "Resume uploaded and analyzed successfully",
        "skills": result["skills"],
        "education": result["education"],
        "experience": result["experience"],
        "summary": result.get("summary", ""),
        "ai_powered": result.get("ai_powered", False),
    }


@router.get("/profile/{user_id}", response_model=schemas.CandidateProfileOut)
def get_profile(user_id: int, db: Session = Depends(get_db)):
    """Fetch a candidate's full profile — self-entered details plus
    whatever the AI extracted from their resume."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = _get_profile_or_404(user_id, db)
    return _profile_to_out(user, profile)


@router.put("/profile/{user_id}", response_model=schemas.CandidateProfileOut)
def update_profile(user_id: int, update: schemas.CandidateProfileUpdate, db: Session = Depends(get_db)):
    """A candidate edits their own profile. Only the fields defined in
    CandidateProfileUpdate are writable here — never role, email, or
    anything belonging to another candidate."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "candidate":
        raise HTTPException(status_code=400, detail="Only candidates have an editable profile")

    profile = _get_profile_or_404(user_id, db)

    profile.phone = update.phone
    profile.linkedin_url = update.linkedin_url
    profile.portfolio_url = update.portfolio_url
    profile.skills = ", ".join(s.strip() for s in update.skills if s.strip())
    profile.education_json = json.dumps(update.education)
    profile.experience_json = json.dumps(update.experience)
    profile.internships_json = json.dumps(update.internships)
    profile.certifications_json = json.dumps(update.certifications)
    profile.projects_json = json.dumps(update.projects)

    db.commit()
    db.refresh(profile)
    return _profile_to_out(user, profile)


@router.get("/dashboard/{user_id}")
def get_candidate_dashboard(user_id: int, db: Session = Depends(get_db)):
    """Aggregated data for the candidate dashboard: profile completion,
    open jobs, their applications, and a couple of sections that will
    fill in as later modules (assessments, notifications) get built."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = _get_profile_or_404(user_id, db)

    available_jobs = db.query(models.Job).filter(models.Job.status == "open").count()

    applications = (
        db.query(models.Application)
        .filter(models.Application.candidate_id == user_id)
        .order_by(models.Application.applied_at.desc())
        .all()
    )

    applied_jobs = [
        {
            "application_id": a.id,
            "job_id": a.job_id,
            "job_title": a.job.title,
            "status": a.status,
            "match_score": a.match_score,
            "applied_at": a.applied_at,
        }
        for a in applications
    ]

    # Simple, non-persisted notifications derived from application status —
    # good enough for now; a real notifications table can replace this later.
    notifications = [
        f"Your application for \"{a.job.title}\" is now {a.status.replace('_', ' ')}."
        for a in applications
        if a.status != "applied"
    ]

    return {
        "profile_completion": _compute_profile_completion(user, profile),
        "available_jobs": available_jobs,
        "applied_jobs": applied_jobs,
        "applied_jobs_count": len(applied_jobs),
        # Candidate-facing assessments (taking tests) are built in a later
        # module — these stay at zero/empty until that pipeline exists.
        "assessments_completed": 0,
        "assessments_upcoming": [],
        "notifications": notifications,
    }
