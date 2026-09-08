# interview_routes.py
# Handles the "agentic" interview + status-notification workflow:
#   1. Generate tailored interview questions for an applicant
#   2. Draft an interview invite, rejection, or shortlist email
#   3. Only send it once the recruiter explicitly confirms

import json
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.ai_engine import (
    generate_interview_questions,
    generate_categorized_interview_questions,
    summarize_interview_feedback,
    draft_interview_email,
    draft_status_email,
)
from app.email_utils import send_email

router = APIRouter(prefix="/interview", tags=["Interview"])


class EmailDraftRequest(BaseModel):
    company_name: str = "Our Company"


class SendEmailRequest(BaseModel):
    subject: str
    body: str


@router.post("/generate-questions/{application_id}")
def create_interview_questions(application_id: int, db: Session = Depends(get_db)):
    """Generates and stores categorized interview questions for one
    applicant, using their CV, the CV-JD matching results, and their test
    performance so far -- not just the resume alone."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate_profile = db.query(models.CandidateProfile).filter(
        models.CandidateProfile.user_id == application.candidate_id
    ).first()
    if not candidate_profile or not candidate_profile.resume_text:
        raise HTTPException(status_code=400, detail="Candidate has no resume on file")

    job = application.job

    try:
        jd_match = json.loads(application.jd_match_json) if application.jd_match_json else {}
    except (json.JSONDecodeError, TypeError):
        jd_match = {}

    test_summaries = []
    assessment = (
        db.query(models.Assessment)
        .filter(models.Assessment.job_id == application.job_id, models.Assessment.status == "approved")
        .first()
    )
    if assessment:
        for test in assessment.tests:
            attempt = (
                db.query(models.TestAttempt)
                .filter(
                    models.TestAttempt.application_id == application_id,
                    models.TestAttempt.assessment_test_id == test.id,
                )
                .first()
            )
            if attempt and attempt.evaluation_json:
                try:
                    ev = json.loads(attempt.evaluation_json)
                    test_summaries.append({
                        "test_number": test.test_number,
                        "score": attempt.evaluation_score,
                        "weaknesses": ev.get("weaknesses", []),
                    })
                except (json.JSONDecodeError, TypeError):
                    pass

    categorized = generate_categorized_interview_questions(
        job_title=job.title,
        job_description=job.description,
        resume_text=candidate_profile.resume_text,
        jd_match=jd_match,
        test_summaries=test_summaries,
    )

    if not categorized:
        raise HTTPException(status_code=503, detail="AI question generation failed. Please try again.")

    db.query(models.InterviewQuestion).filter(
        models.InterviewQuestion.application_id == application_id
    ).delete()

    category_map = {
        "technical": "technical",
        "behavioral": "behavioral",
        "situational": "situational",
        "cv_based": "cv_based",
        "role_specific": "role_specific",
    }
    for key, category in category_map.items():
        for q_text in categorized.get(key, []):
            db.add(models.InterviewQuestion(application_id=application_id, question_text=q_text, category=category))
    db.commit()

    return get_interview_questions(application_id, db)


@router.get("/questions/{application_id}")
def get_interview_questions(application_id: int, db: Session = Depends(get_db)):
    """Fetches previously generated/edited questions, grouped by category."""
    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .order_by(models.InterviewQuestion.id)
        .all()
    )
    grouped = {}
    for q in questions:
        grouped.setdefault(q.category, []).append({"id": q.id, "question_text": q.question_text})
    return {"questions_by_category": grouped}


@router.put("/questions/{question_id}")
def update_interview_question(question_id: int, update: schemas.InterviewQuestionUpdate, db: Session = Depends(get_db)):
    """A recruiter edits an AI-generated question before the interview."""
    question = db.query(models.InterviewQuestion).filter(models.InterviewQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.question_text = update.question_text
    db.commit()
    return {"message": "Question updated"}


@router.delete("/questions/{question_id}")
def delete_interview_question(question_id: int, db: Session = Depends(get_db)):
    """A recruiter removes a question they don't want to ask."""
    question = db.query(models.InterviewQuestion).filter(models.InterviewQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(question)
    db.commit()
    return {"message": "Question deleted"}


@router.post("/questions/{application_id}/add")
def add_interview_question(application_id: int, question: schemas.InterviewQuestionCreate, db: Session = Depends(get_db)):
    """A recruiter adds their own custom question alongside the AI-generated ones."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    new_question = models.InterviewQuestion(
        application_id=application_id, question_text=question.question_text, category=question.category
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    return {"id": new_question.id, "question_text": new_question.question_text, "category": new_question.category}


@router.post("/feedback/{application_id}")
def save_interview_feedback(application_id: int, feedback: schemas.InterviewFeedbackCreate, recruiter_id: int, db: Session = Depends(get_db)):
    """Recruiter records their own interview feedback. One record per
    (application, recruiter) -- calling this again updates it."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to one of your jobs")

    record = (
        db.query(models.InterviewFeedback)
        .filter(models.InterviewFeedback.application_id == application_id, models.InterviewFeedback.recruiter_id == recruiter_id)
        .first()
    )
    if not record:
        record = models.InterviewFeedback(application_id=application_id, recruiter_id=recruiter_id)
        db.add(record)

    record.technical_competency = feedback.technical_competency
    record.communication = feedback.communication
    record.problem_solving = feedback.problem_solving
    record.job_knowledge = feedback.job_knowledge
    record.overall_feedback = feedback.overall_feedback
    record.recommendation = feedback.recommendation
    record.ai_summary = None  # stale after any edit -- recruiter must re-summarize

    db.commit()
    db.refresh(record)
    return {"id": record.id, "message": "Feedback saved"}


@router.get("/feedback/{application_id}")
def get_interview_feedback(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to one of your jobs")

    record = (
        db.query(models.InterviewFeedback)
        .filter(models.InterviewFeedback.application_id == application_id, models.InterviewFeedback.recruiter_id == recruiter_id)
        .first()
    )
    if not record:
        return None
    return {
        "id": record.id,
        "technical_competency": record.technical_competency,
        "communication": record.communication,
        "problem_solving": record.problem_solving,
        "job_knowledge": record.job_knowledge,
        "overall_feedback": record.overall_feedback,
        "recommendation": record.recommendation,
        "ai_summary": record.ai_summary,
    }


@router.post("/feedback/{application_id}/summarize")
def summarize_feedback(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Generates an AI summary FROM the recruiter's own recorded feedback.
    Never adds a recommendation of its own."""
    record = (
        db.query(models.InterviewFeedback)
        .filter(models.InterviewFeedback.application_id == application_id, models.InterviewFeedback.recruiter_id == recruiter_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No feedback recorded yet for this application")

    summary = summarize_interview_feedback({
        "technical_competency": record.technical_competency,
        "communication": record.communication,
        "problem_solving": record.problem_solving,
        "job_knowledge": record.job_knowledge,
        "overall_feedback": record.overall_feedback,
        "recommendation": record.recommendation,
    })
    if not summary:
        raise HTTPException(status_code=503, detail="AI summarization failed. Please try again.")

    record.ai_summary = summary
    db.commit()
    return {"ai_summary": summary}


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
        email_type="interview_invite",
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


@router.post("/draft-status-email/{application_id}")
def create_status_email_draft(application_id: int, request: EmailDraftRequest, db: Session = Depends(get_db)):
    """Drafts a rejection or shortlist-notice email, based on the
    application's CURRENT status. Saved as a draft — not sent yet."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status not in ("rejected", "shortlisted"):
        raise HTTPException(
            status_code=400,
            detail="Set the application's status to 'rejected' or 'shortlisted' before drafting this email.",
        )

    job = application.job
    candidate = application.candidate
    recruiter = job.recruiter

    draft = draft_status_email(
        candidate_name=candidate.full_name,
        job_title=job.title,
        company_name=request.company_name,
        recruiter_name=recruiter.full_name,
        email_type=application.status,
    )

    if not draft or (isinstance(draft, dict) and "error" in draft):
        error_detail = draft.get("error") if isinstance(draft, dict) else "Unknown error"
        raise HTTPException(status_code=503, detail=f"AI email drafting failed: {error_detail}")

    email_log = models.EmailLog(
        application_id=application_id,
        subject=draft["subject"],
        body=draft["body"],
        status="draft",
        email_type=application.status,
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

    success = send_email(to_address=candidate_email, subject=request.subject, body=request.body)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email. Check your email configuration.")

    email_log.subject = request.subject
    email_log.body = request.body
    email_log.status = "sent"
    db.commit()

    if email_log.email_type == "interview_invite":
        application.status = "interview_scheduled"
        db.commit()

    return {"message": "Email sent successfully"}