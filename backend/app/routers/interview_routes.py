# interview_routes.py
# Handles the "agentic" interview + status-notification workflow:
#   1. Generate tailored interview questions for an applicant
#   2. Draft an interview invite, rejection, or shortlist email
#   3. Only send it once the recruiter explicitly confirms

import json
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.ai_engine import (
    generate_interview_questions,
    generate_categorized_interview_questions,
    summarize_interview_feedback,
    evaluate_interview_answers,
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


class InterviewAnswerSubmit(BaseModel):
    answers: dict[int, str]  # {question_id: answer_text}


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


@router.post("/send/{application_id}")
def send_interview_to_candidate(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Module 4 (Interview Fix) -- the recruiter clicks 'Send': releases
    the currently-generated questions so the candidate can immediately see
    them on their own page. Safe to call again (e.g. after regenerating or
    editing questions) -- it just re-stamps the sent time."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to one of your jobs")

    question_count = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .count()
    )
    if question_count == 0:
        raise HTTPException(status_code=400, detail="Generate interview questions before sending them")

    application.interview_sent = True
    application.interview_sent_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Interview questions sent to the candidate", "interview_sent_at": application.interview_sent_at}


@router.get("/candidate/{application_id}")
def get_interview_for_candidate(application_id: int, candidate_id: int, db: Session = Depends(get_db)):
    """The candidate's own view: their released interview questions (and
    any answers they've already written), grouped by category. Returns
    nothing until the recruiter has clicked Send."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This isn't your application")

    if not application.interview_sent:
        return {"interview_sent": False, "questions_by_category": {}, "submitted_at": None}

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .order_by(models.InterviewQuestion.id)
        .all()
    )
    grouped = {}
    for q in questions:
        grouped.setdefault(q.category, []).append(
            {"id": q.id, "question_text": q.question_text, "candidate_answer": q.candidate_answer}
        )

    return {
        "interview_sent": True,
        "interview_sent_at": application.interview_sent_at,
        "questions_by_category": grouped,
        "submitted_at": application.interview_answers_submitted_at,
    }


@router.post("/candidate/{application_id}/answers")
def submit_interview_answers(application_id: int, candidate_id: int, submission: InterviewAnswerSubmit, db: Session = Depends(get_db)):
    """The candidate submits (or updates, before the recruiter evaluates)
    their written answers to the released interview questions."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This isn't your application")
    if not application.interview_sent:
        raise HTTPException(status_code=400, detail="No interview questions have been sent yet")

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .all()
    )
    questions_by_id = {q.id: q for q in questions}

    for question_id, answer_text in submission.answers.items():
        question = questions_by_id.get(question_id)
        if question:
            question.candidate_answer = answer_text

    application.interview_answers_submitted_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Your answers have been submitted", "submitted_at": application.interview_answers_submitted_at}


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
        grouped.setdefault(q.category, []).append(
            {"id": q.id, "question_text": q.question_text, "candidate_answer": q.candidate_answer}
        )
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
    record.ai_generated = False  # this is now the recruiter's own hand-edited feedback

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
        "ai_generated": record.ai_generated,
        "shared_with_candidate": record.shared_with_candidate,
        "shared_at": record.shared_at,
    }


@router.post("/feedback/{application_id}/evaluate-with-ai")
def evaluate_interview_with_ai(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Module 4 (Interview Fix) -- Candidate submits answers -> Recruiter
    evaluates with AI -> AI automatically generates a first-pass interview
    feedback record from those answers. The recruiter can still edit
    anything (via Save Feedback above) before sharing it with the candidate."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to one of your jobs")
    if not application.interview_answers_submitted_at:
        raise HTTPException(status_code=400, detail="The candidate hasn't submitted their interview answers yet")

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.application_id == application_id)
        .all()
    )
    qa_pairs = [
        {"category": q.category, "question_text": q.question_text, "candidate_answer": q.candidate_answer}
        for q in questions
    ]

    result = evaluate_interview_answers(
        job_title=application.job.title, job_description=application.job.description, qa_pairs=qa_pairs
    )
    if not result:
        raise HTTPException(status_code=503, detail="AI evaluation failed. Please try again.")

    record = (
        db.query(models.InterviewFeedback)
        .filter(models.InterviewFeedback.application_id == application_id, models.InterviewFeedback.recruiter_id == recruiter_id)
        .first()
    )
    if not record:
        record = models.InterviewFeedback(application_id=application_id, recruiter_id=recruiter_id)
        db.add(record)

    record.technical_competency = result.get("technical_competency")
    record.communication = result.get("communication")
    record.problem_solving = result.get("problem_solving")
    record.job_knowledge = result.get("job_knowledge")
    record.overall_feedback = result.get("overall_feedback")
    record.recommendation = result.get("recommendation")
    record.ai_summary = None
    record.ai_generated = True

    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "technical_competency": record.technical_competency,
        "communication": record.communication,
        "problem_solving": record.problem_solving,
        "job_knowledge": record.job_knowledge,
        "overall_feedback": record.overall_feedback,
        "recommendation": record.recommendation,
        "ai_generated": record.ai_generated,
    }


@router.post("/feedback/{application_id}/share")
def share_interview_feedback(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """The existing feedback the recruiter has recorded (hand-written or
    AI-assisted) becomes visible on the candidate's own page. Not shared
    automatically -- the recruiter decides when it's ready."""
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
        raise HTTPException(status_code=404, detail="No feedback recorded yet for this application")

    record.shared_with_candidate = True
    record.shared_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Feedback shared with the candidate", "shared_at": record.shared_at}


@router.get("/feedback/candidate/{application_id}")
def get_interview_feedback_for_candidate(application_id: int, candidate_id: int, db: Session = Depends(get_db)):
    """The candidate's own view of their interview feedback -- returns
    nothing until the recruiter has explicitly shared it."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This isn't your application")

    record = (
        db.query(models.InterviewFeedback)
        .filter(models.InterviewFeedback.application_id == application_id, models.InterviewFeedback.shared_with_candidate == True)  # noqa: E712
        .first()
    )
    if not record:
        return None
    return {
        "technical_competency": record.technical_competency,
        "communication": record.communication,
        "problem_solving": record.problem_solving,
        "job_knowledge": record.job_knowledge,
        "overall_feedback": record.overall_feedback,
        "recommendation": record.recommendation,
        "shared_at": record.shared_at,
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