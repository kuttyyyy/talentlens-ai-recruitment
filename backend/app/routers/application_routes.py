# application_routes.py
# Endpoints for candidates applying to jobs, and recruiters viewing
# AI-ranked applicants for their jobs. This is where the AI matching
# engine actually runs.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.ai_engine import analyze_match_with_ai, fallback_match_score, detect_duplicate_applicant

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.post("/apply")
def apply_to_job(job_id: int, candidate_id: int, db: Session = Depends(get_db)):
    """A candidate applies to a job. Runs the AI matching engine immediately,
    checks for possible duplicate applicants on this same job, and stores
    everything alongside the application."""

    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db.query(models.CandidateProfile).filter(
        models.CandidateProfile.user_id == candidate_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    if not profile.resume_text:
        raise HTTPException(status_code=400, detail="Please upload your resume before applying")

    existing = db.query(models.Application).filter(
        models.Application.job_id == job_id,
        models.Application.candidate_id == candidate_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You've already applied to this job")

    ai_result = analyze_match_with_ai(
        resume_text=profile.resume_text,
        candidate_skills=profile.extracted_skills or "",
        job_title=job.title,
        job_description=job.description,
        required_skills=job.required_skills,
    )

    if ai_result:
        match_score = ai_result.get("match_score", 0)
        reasoning = ai_result.get("reasoning", "")
        recommendation = ai_result.get("recommendation", "needs_review")
    else:
        match_score, reasoning, recommendation = fallback_match_score(
            profile.extracted_skills or "", job.required_skills
        )

    # Check for possible duplicate applicants on this same job
    other_applications = (
        db.query(models.Application)
        .filter(models.Application.job_id == job_id)
        .all()
    )
    other_data = []
    for other_app in other_applications:
        other_profile = db.query(models.CandidateProfile).filter(
            models.CandidateProfile.user_id == other_app.candidate_id
        ).first()
        if other_profile and other_profile.resume_text:
            other_data.append({
                "candidate_name": other_app.candidate.full_name,
                "resume_text": other_profile.resume_text,
            })

    duplicate_of = detect_duplicate_applicant(profile.resume_text, other_data)

    new_application = models.Application(
        job_id=job_id,
        candidate_id=candidate_id,
        match_score=match_score,
        ai_reasoning=reasoning,
        ai_recommendation=recommendation,
        possible_duplicate_of=duplicate_of,
        status="applied",
    )
    db.add(new_application)
    db.commit()
    db.refresh(new_application)

    response = {
        "message": "Application submitted successfully",
        "match_score": match_score,
        "ai_reasoning": reasoning,
        "ai_recommendation": recommendation,
    }
    if duplicate_of:
        response["duplicate_warning"] = f"This resume looks similar to an existing applicant: {duplicate_of}"

    return response


@router.get("/candidate/{candidate_id}")
def get_candidate_applications(candidate_id: int, db: Session = Depends(get_db)):
    """All applications a candidate has submitted — powers their
    'Track Application Status' view."""
    applications = (
        db.query(models.Application)
        .filter(models.Application.candidate_id == candidate_id)
        .order_by(models.Application.applied_at.desc())
        .all()
    )

    return [
        {
            "id": app.id,
            "job_id": app.job_id,
            "job_title": app.job.title,
            "job_location": app.job.location,
            "match_score": app.match_score,
            "ai_reasoning": app.ai_reasoning,
            "ai_recommendation": app.ai_recommendation,
            "status": app.status,
            "applied_at": app.applied_at,
        }
        for app in applications
    ]


@router.get("/job/{job_id}")
def get_job_applicants(job_id: int, db: Session = Depends(get_db)):
    """All applicants for one job, ranked best-to-worst match —
    this is the recruiter's AI ranking view."""
    applications = (
        db.query(models.Application)
        .filter(models.Application.job_id == job_id)
        .order_by(models.Application.match_score.desc())
        .all()
    )

    return [
        {
            "id": app.id,
            "candidate_id": app.candidate_id,
            "candidate_name": app.candidate.full_name,
            "candidate_email": app.candidate.email,
            "match_score": app.match_score,
            "ai_reasoning": app.ai_reasoning,
            "ai_recommendation": app.ai_recommendation,
            "possible_duplicate_of": app.possible_duplicate_of,
            "status": app.status,
            "applied_at": app.applied_at,
        }
        for app in applications
    ]


@router.get("/{application_id}")
def get_application_detail(application_id: int, db: Session = Depends(get_db)):
    """Full detail for one application: match info, interview questions,
    and email history — powers a single-application detail view."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .all()
    )

    emails = (
        db.query(models.EmailLog)
        .filter(models.EmailLog.application_id == application_id)
        .order_by(models.EmailLog.created_at.desc())
        .all()
    )

    return {
        "id": application.id,
        "job_id": application.job_id,
        "job_title": application.job.title,
        "candidate_id": application.candidate_id,
        "candidate_name": application.candidate.full_name,
        "candidate_email": application.candidate.email,
        "match_score": application.match_score,
        "ai_reasoning": application.ai_reasoning,
        "ai_recommendation": application.ai_recommendation,
        "possible_duplicate_of": application.possible_duplicate_of,
        "status": application.status,
        "applied_at": application.applied_at,
        "interview_questions": [q.question_text for q in questions],
        "emails": [
            {
                "id": e.id,
                "subject": e.subject,
                "body": e.body,
                "status": e.status,
                "created_at": e.created_at,
            }
            for e in emails
        ],
    }


@router.put("/{application_id}/status")
def update_application_status(application_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    """A recruiter updates a candidate's status (shortlisted, rejected, etc.)."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    valid_statuses = ["applied", "shortlisted", "interview_scheduled", "rejected", "hired"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(valid_statuses)}")

    application.status = status_update.status
    db.commit()
    db.refresh(application)
    return {"message": "Status updated successfully", "status": application.status}


@router.put("/{application_id}/accept-ai-suggestion")
def accept_ai_suggestion(application_id: int, db: Session = Depends(get_db)):
    """One-click 'accept the AI's suggestion' for the recruiter."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if not application.ai_recommendation:
        raise HTTPException(status_code=400, detail="No AI recommendation available for this application")

    mapping = {
        "auto_shortlist": "shortlisted",
        "auto_reject": "rejected",
    }

    new_status = mapping.get(application.ai_recommendation)
    if not new_status:
        raise HTTPException(
            status_code=400,
            detail="This application is marked 'needs_review' — please review it manually rather than auto-accepting.",
        )

    application.status = new_status
    db.commit()
    db.refresh(application)
    return {
        "message": f"AI suggestion accepted — status set to '{new_status}'",
        "status": application.status,
    }