# copilot_routes.py
# Two copilots live here:
# - Recruiter Copilot: the recruiter asks a free-form question, and the AI
#   answers using their real jobs + applicants data.
# - Candidate Copilot: a candidate asks a free-form question, and the AI
#   answers using ONLY that candidate's own data (their profile, their own
#   applications, their own assessment/verification status) plus general
#   job-search advice.

import json
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models
from app.ai_engine import answer_copilot_question, answer_candidate_copilot_question

router = APIRouter(prefix="/copilot", tags=["Copilot"])


class CopilotQuestion(BaseModel):
    question: str


def build_recruiter_context(recruiter_id: int, db: Session) -> str:
    """Builds a plain-text summary of everything this recruiter owns —
    their jobs and every applicant to those jobs — to feed the AI as context."""
    jobs = db.query(models.Job).filter(models.Job.recruiter_id == recruiter_id).all()

    if not jobs:
        return "This recruiter has no jobs posted yet."

    lines = []
    for job in jobs:
        lines.append(f"JOB: {job.title} (status: {job.status}, id: {job.id})")
        applications = (
            db.query(models.Application)
            .filter(models.Application.job_id == job.id)
            .order_by(models.Application.match_score.desc())
            .all()
        )
        if not applications:
            lines.append("  No applicants yet.")
        for app in applications:
            lines.append(
                f"  - {app.candidate.full_name}: {app.match_score}% match, "
                f"status={app.status}, AI recommendation={app.ai_recommendation or 'none'}. "
                f"Reasoning: {app.ai_reasoning}"
            )
        lines.append("")

    return "\n".join(lines)


def _safe_list(raw):
    """Safely parses a JSON list column; returns [] for anything unreadable.
    Local copy (rather than importing from candidate_routes) to keep the
    routers independent of each other."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def build_candidate_context(candidate_id: int, db: Session) -> str:
    """Builds a plain-text summary of ONE candidate's own data -- their
    profile, their own applications (status + the match score/reasoning
    they can already see on My Applications), and their own assessment and
    verification status. Deliberately leaves out anything the platform
    doesn't otherwise show the candidate yet (specific interview questions,
    interviewer feedback, detailed evaluation scores) -- the AI is told
    about that gap explicitly so it never invents an answer instead."""
    profile = db.query(models.CandidateProfile).filter(models.CandidateProfile.user_id == candidate_id).first()

    lines = []

    if profile:
        skills = [s.strip() for s in (profile.skills or "").split(",") if s.strip()]
        lines.append("CANDIDATE PROFILE:")
        lines.append(f"  Skills: {', '.join(skills) if skills else 'none listed'}")
        lines.append(f"  Education: {_safe_list(profile.education_json) or 'none listed'}")
        lines.append(f"  Experience: {_safe_list(profile.experience_json) or 'none listed'}")
        lines.append(f"  Resume uploaded: {'yes' if profile.resume_file_path else 'no'}")
        lines.append("")
    else:
        lines.append("CANDIDATE PROFILE: not filled in yet.")
        lines.append("")

    applications = (
        db.query(models.Application)
        .options(joinedload(models.Application.job))
        .filter(models.Application.candidate_id == candidate_id)
        .order_by(models.Application.applied_at.desc())
        .all()
    )

    if not applications:
        lines.append("APPLICATIONS: none yet.")
        return "\n".join(lines)

    application_ids = [a.id for a in applications]
    all_attempts = (
        db.query(models.TestAttempt)
        .join(models.AssessmentTest, models.TestAttempt.assessment_test_id == models.AssessmentTest.id)
        .filter(models.TestAttempt.application_id.in_(application_ids))
        .all()
    )
    attempts_by_application = {}
    for at in all_attempts:
        attempts_by_application.setdefault(at.application_id, []).append(at)

    verification_docs = (
        db.query(models.VerificationDocument)
        .filter(models.VerificationDocument.candidate_id == candidate_id)
        .all()
    )

    lines.append("APPLICATIONS:")
    for a in applications:
        lines.append(
            f"  - \"{a.job.title}\" ({a.job.location or 'location n/a'}, {a.job.job_type or 'type n/a'}): "
            f"status={a.status}, applied {a.applied_at.date() if a.applied_at else 'unknown'}, "
            f"CV-JD match score={a.match_score if a.match_score is not None else 'not yet scored'}%. "
            f"{('Match reasoning: ' + a.ai_reasoning) if a.ai_reasoning else ''}"
        )
        attempts = attempts_by_application.get(a.id, [])
        if attempts:
            for at in attempts:
                test_num = at.assessment_test.test_number if at.assessment_test else "?"
                test_title = at.assessment_test.title if at.assessment_test else "test"
                status_label = {
                    "not_started": "not started",
                    "in_progress": "in progress",
                    "submitted": "submitted, awaiting the recruiter's evaluation",
                }.get(at.status, at.status)
                lines.append(f"      Test {test_num} ({test_title}): {status_label}")
    lines.append("")

    if verification_docs:
        verified = sum(1 for d in verification_docs if d.comparison_result == "verified")
        lines.append(
            f"VERIFICATION: {len(verification_docs)} document(s) submitted, {verified} marked verified. "
            "Full detail is on their Verification page."
        )
    else:
        lines.append("VERIFICATION: no documents submitted yet.")

    lines.append(
        "\nNOTE: specific interview questions, interviewer feedback, and detailed "
        "test evaluation scores are NOT included here because the platform hasn't "
        "shared them with this candidate yet."
    )

    return "\n".join(lines)


@router.post("/ask/{recruiter_id}")
def ask_copilot(recruiter_id: int, request: CopilotQuestion, db: Session = Depends(get_db)):
    """The recruiter asks a question; the AI answers using their real data."""
    recruiter = db.query(models.User).filter(models.User.id == recruiter_id).first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    context = build_recruiter_context(recruiter_id, db)
    answer = answer_copilot_question(question=request.question, context_data=context)

    if isinstance(answer, dict) and "error" in answer:
        raise HTTPException(status_code=503, detail=f"AI copilot failed: {answer['error']}")

    return {"answer": answer}


@router.post("/ask-candidate/{candidate_id}")
def ask_candidate_copilot(candidate_id: int, request: CopilotQuestion, db: Session = Depends(get_db)):
    """A candidate asks a question; the AI answers using ONLY that
    candidate's own data, plus general job-search/interview-prep advice."""
    candidate = db.query(models.User).filter(
        models.User.id == candidate_id, models.User.role == "candidate"
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    context = build_candidate_context(candidate_id, db)
    answer = answer_candidate_copilot_question(question=request.question, context_data=context)

    if isinstance(answer, dict) and "error" in answer:
        raise HTTPException(status_code=503, detail=f"AI copilot failed: {answer['error']}")

    return {"answer": answer}