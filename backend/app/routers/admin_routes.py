# admin_routes.py
# Site-wide admin views: all users, all jobs, and overall analytics.

import json
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.integrity_agent import generate_integrity_report

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_candidates = db.query(models.User).filter(models.User.role == "candidate").count()
    total_recruiters = db.query(models.User).filter(models.User.role == "recruiter").count()
    total_jobs = db.query(models.Job).count()
    open_jobs = db.query(models.Job).filter(models.Job.status == "open").count()
    total_applications = db.query(models.Application).count()

    scores = [a.match_score for a in db.query(models.Application).all() if a.match_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    # --- Module 11: platform-wide assessment & recruiter-satisfaction analytics ---
    # Deliberately aggregate-only: no candidate names, emails, or individual
    # answers appear anywhere below.

    approved_assessments = db.query(models.Assessment).filter(models.Assessment.status == "approved").all()
    applications_with_assessment = 0
    applications_fully_completed = 0

    test_scores_by_number = {1: [], 2: [], 3: []}
    completion_minutes = []

    for assessment in approved_assessments:
        applications = db.query(models.Application).filter(models.Application.job_id == assessment.job_id).all()
        for application in applications:
            applications_with_assessment += 1
            attempts = (
                db.query(models.TestAttempt)
                .filter(models.TestAttempt.application_id == application.id)
                .all()
            )
            submitted = [a for a in attempts if a.status == "submitted"]
            if len(submitted) >= len(assessment.tests) and len(assessment.tests) > 0:
                applications_fully_completed += 1

            for attempt in submitted:
                if attempt.evaluation_score is not None:
                    test_number = attempt.assessment_test.test_number
                    if test_number in test_scores_by_number:
                        test_scores_by_number[test_number].append(attempt.evaluation_score)
                if attempt.started_at and attempt.submitted_at:
                    minutes = (attempt.submitted_at - attempt.started_at).total_seconds() / 60
                    if minutes >= 0:
                        completion_minutes.append(minutes)

    def _avg(values):
        return round(sum(values) / len(values), 1) if values else None

    assessment_completion_rate = (
        round(100 * applications_fully_completed / applications_with_assessment, 1)
        if applications_with_assessment else None
    )

    # Candidates at each recruitment stage -- platform-wide status counts
    all_applications = db.query(models.Application).all()
    stage_counts = Counter(a.status for a in all_applications)

    # Common assessment issues -- how often each integrity event type occurs, platform-wide
    all_submitted_attempts = db.query(models.TestAttempt).filter(models.TestAttempt.status == "submitted").all()
    issue_counter = Counter()
    for attempt in all_submitted_attempts:
        report = generate_integrity_report(attempt)
        for flag in report["flags"]:
            issue_counter[flag["event"]] += 1
    common_assessment_issues = [{"issue": k, "count": v} for k, v in issue_counter.most_common(5)]

    # Recruiter satisfaction + most useful features, from Module 11 feedback
    feedback_rows = db.query(models.RecruiterFeedback).all()
    satisfaction_fields = {
        "JD Analysis": "jd_analysis_useful",
        "AI Test Generation": "test_generation_useful",
        "CV-JD Matching": "cv_matching_useful",
        "Practical Assessment": "practical_assessment_useful",
        "Candidate Report": "candidate_report_useful",
        "Integrity Information": "integrity_info_useful",
    }
    feature_averages = []
    for label, field in satisfaction_fields.items():
        values = [getattr(f, field) for f in feedback_rows if getattr(f, field) is not None]
        if values:
            feature_averages.append({"feature": label, "average_rating": _avg(values)})
    feature_averages.sort(key=lambda x: x["average_rating"], reverse=True)

    overall_usefulness_values = [f.overall_usefulness for f in feedback_rows if f.overall_usefulness is not None]
    would_use_again_values = [f.would_use_again for f in feedback_rows if f.would_use_again is not None]

    return {
        "total_users": total_users,
        "total_candidates": total_candidates,
        "total_recruiters": total_recruiters,
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "total_applications": total_applications,
        "average_match_score": avg_score,
        # Module 11 additions
        "assessment_completion_rate": assessment_completion_rate,
        "average_test1_score": _avg(test_scores_by_number[1]),
        "average_test2_score": _avg(test_scores_by_number[2]),
        "average_test3_score": _avg(test_scores_by_number[3]),
        "average_completion_minutes": _avg(completion_minutes),
        "candidates_by_stage": dict(stage_counts),
        "recruiter_satisfaction": {
            "average_overall_usefulness": _avg(overall_usefulness_values),
            "average_would_use_again": _avg(would_use_again_values),
            "responses_count": len(feedback_rows),
        },
        "common_assessment_issues": common_assessment_issues,
        "most_useful_features": feature_averages,
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role, "created_at": u.created_at}
        for u in users
    ]


@router.get("/jobs")
def list_all_jobs(db: Session = Depends(get_db)):
    jobs = db.query(models.Job).order_by(models.Job.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "title": j.title,
            "recruiter_name": j.recruiter.full_name,
            "status": j.status,
            "applicant_count": len(j.applications),
            "created_at": j.created_at,
        }
        for j in jobs
    ]


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete an admin account")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}