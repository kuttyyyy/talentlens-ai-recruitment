# interview_routes.py
# Handles the "agentic" interview workflow:
#   1. Generate tailored interview questions for an applicant
#   2. Draft an invitation email
#   3. Only send it once the recruiter explicitly confirms

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.ai_engine import generate_interview_questions, draft_interview_email
from app.email_utils import send_email

router = APIRouter(prefix="/interview", tags=["Interview"])


class EmailDraftRequest(BaseModel):
    company_name: str = "Our Company"


class SendEmailRequest(BaseModel):
    subject: str
    body: str


@router.post("/generate-questions/{application_id}")
def create_interview_questions(application_id: int, db: Session = Depends(get_db)):
    """Generates and stores tailored interview questions for one applicant."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate_profile = db.query(models.CandidateProfile).filter(
        models.CandidateProfile.user_id == application.candidate_id
    ).first()
    if not candidate_profile or not candidate_profile.resume_text:
        raise HTTPException(status_code=400, detail="Candidate has no resume on file")

    job = application.job

    questions = generate_interview_questions(
        resume_text=candidate_profile.resume_text,
        job_title=job.title,
        job_description=job.description,
        ai_reasoning=application.ai_reasoning or "",
    )

    if not questions or isinstance(questions, dict):
        error_detail = questions.get("error") if isinstance(questions, dict) else "Unknown error"
        raise HTTPException(status_code=503, detail=f"AI question generation failed: {error_detail}")

    # Clear any previously generated questions for this application, then save the fresh set
    db.query(models.InterviewQuestion).filter(
        models.InterviewQuestion.application_id == application_id
    ).delete()

    for q_text in questions:
        db.add(models.InterviewQuestion(application_id=application_id, question_text=q_text))
    db.commit()

    return {"questions": questions}


@router.get("/questions/{application_id}")
def get_interview_questions(application_id: int, db: Session = Depends(get_db)):
    """Fetches previously generated questions for an applicant, if any."""
    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .all()
    )
    return {"questions": [q.question_text for q in questions]}


@router.post("/draft-email/{application_id}")
def create_email_draft(application_id: int, request: EmailDraftRequest, db: Session = Depends(get_db)):
    """Drafts an interview invitation email and saves it as a draft
    (not sent yet — the recruiter must confirm separately)."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    job = application.job
    candidate = application.candidate
    recruiter = job.recruiter

    draft = draft_interview_email(
        candidate_name=candidate.full_name,
        job_title=job.title,
        company_name=request.company_name,
        recruiter_name=recruiter.full_name,
    )

    if not draft or (isinstance(draft, dict) and "error" in draft):
        error_detail = draft.get("error") if isinstance(draft, dict) else "Unknown error"
        raise HTTPException(status_code=503, detail=f"AI email drafting failed: {error_detail}")

    email_log = models.EmailLog(
        application_id=application_id,
        subject=draft["subject"],
        body=draft["body"],
        status="draft",
    )
    db.add(email_log)
    db.commit()
    db.refresh(email_log)

    return {
        "email_log_id": email_log.id,
        "subject": email_log.subject,
        "body": email_log.body,
        "candidate_email": candidate.email,
    }


@router.post("/send-email/{email_log_id}")
def confirm_and_send_email(email_log_id: int, request: SendEmailRequest, db: Session = Depends(get_db)):
    """Actually sends the email — only reached when the recruiter clicks
    'Send' after reviewing (and possibly editing) the draft."""
    email_log = db.query(models.EmailLog).filter(models.EmailLog.id == email_log_id).first()
    if not email_log:
        raise HTTPException(status_code=404, detail="Email draft not found")

    application = db.query(models.Application).filter(
        models.Application.id == email_log.application_id
    ).first()
    candidate_email = application.candidate.email

    # Use whatever the recruiter finalized (they may have edited the AI's draft)
    success = send_email(to_address=candidate_email, subject=request.subject, body=request.body)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email. Check your email configuration.")

    email_log.subject = request.subject
    email_log.body = request.body
    email_log.status = "sent"
    db.commit()

    # Move the application forward automatically once an invite is sent
    application.status = "interview_scheduled"
    db.commit()

    return {"message": "Email sent successfully"}