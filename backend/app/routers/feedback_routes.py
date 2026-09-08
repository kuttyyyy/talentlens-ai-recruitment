# feedback_routes.py
# Module 11 -- Recruiter Feedback & Analytics (feedback submission side).
# The aggregated Analytics Dashboard itself lives in admin_routes.py,
# since it needs platform-wide data across all recruiters.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/feedback", tags=["Recruiter Feedback (Module 11)"])


@router.post("/recruiter/{recruiter_id}")
def submit_feedback(recruiter_id: int, feedback: schemas.RecruiterFeedbackCreate, db: Session = Depends(get_db)):
    """A recruiter submits feedback about the TalentLens platform itself."""
    recruiter = db.query(models.User).filter(models.User.id == recruiter_id, models.User.role == "recruiter").first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    new_feedback = models.RecruiterFeedback(
        recruiter_id=recruiter_id,
        overall_usefulness=feedback.overall_usefulness,
        ease_of_use=feedback.ease_of_use,
        jd_analysis_useful=feedback.jd_analysis_useful,
        test_generation_useful=feedback.test_generation_useful,
        cv_matching_useful=feedback.cv_matching_useful,
        practical_assessment_useful=feedback.practical_assessment_useful,
        candidate_report_useful=feedback.candidate_report_useful,
        integrity_info_useful=feedback.integrity_info_useful,
        would_use_again=feedback.would_use_again,
        improvement_suggestions=feedback.improvement_suggestions,
        company_name=feedback.company_name,
        role_title=feedback.role_title,
    )
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)

    return {"id": new_feedback.id, "message": "Thank you for your feedback!"}


@router.get("/recruiter/{recruiter_id}")
def get_my_feedback(recruiter_id: int, db: Session = Depends(get_db)):
    """A recruiter's own past feedback submissions."""
    submissions = (
        db.query(models.RecruiterFeedback)
        .filter(models.RecruiterFeedback.recruiter_id == recruiter_id)
        .order_by(models.RecruiterFeedback.created_at.desc())
        .all()
    )
    return [
        {
            "id": f.id,
            "overall_usefulness": f.overall_usefulness,
            "would_use_again": f.would_use_again,
            "improvement_suggestions": f.improvement_suggestions,
            "created_at": f.created_at,
        }
        for f in submissions
    ]
