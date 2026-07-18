# dashboard_routes.py
# Aggregated reporting for a recruiter: totals, averages, and a
# per-job breakdown, powering the Recruiter Dashboard's "reports" view.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/recruiter/{recruiter_id}/stats")
def get_recruiter_stats(recruiter_id: int, db: Session = Depends(get_db)):
    recruiter = db.query(models.User).filter(
        models.User.id == recruiter_id, models.User.role == "recruiter"
    ).first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    jobs = db.query(models.Job).filter(models.Job.recruiter_id == recruiter_id).all()
    job_ids = [j.id for j in jobs]

    total_jobs = len(jobs)
    open_jobs = len([j for j in jobs if j.status == "open"])
    closed_jobs = total_jobs - open_jobs

    applications = (
        db.query(models.Application).filter(models.Application.job_id.in_(job_ids)).all()
        if job_ids else []
    )
    total_applicants = len(applications)
    avg_score = (
        round(sum(a.match_score or 0 for a in applications) / total_applicants, 1)
        if total_applicants else 0
    )

    status_breakdown = {"applied": 0, "shortlisted": 0, "interview_scheduled": 0, "rejected": 0, "hired": 0}
    for a in applications:
        if a.status in status_breakdown:
            status_breakdown[a.status] += 1

    job_summaries = []
    for j in jobs:
        job_apps = [a for a in applications if a.job_id == j.id]
        job_summaries.append({
            "job_id": j.id,
            "title": j.title,
            "status": j.status,
            "applicant_count": len(job_apps),
            "average_match_score": (
                round(sum(a.match_score or 0 for a in job_apps) / len(job_apps), 1)
                if job_apps else 0
            ),
        })
    job_summaries.sort(key=lambda x: x["applicant_count"], reverse=True)

    return {
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "closed_jobs": closed_jobs,
        "total_applicants": total_applicants,
        "average_match_score": avg_score,
        "status_breakdown": status_breakdown,
        "jobs": job_summaries,
    }