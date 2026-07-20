# copilot_routes.py
# A small "Recruiter Copilot" chat: the recruiter asks a free-form
# question, and the AI answers using their real jobs + applicants data.

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.ai_engine import answer_copilot_question

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