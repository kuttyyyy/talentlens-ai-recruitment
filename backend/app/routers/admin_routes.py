# admin_routes.py
# Site-wide admin views: all users, all jobs, and overall analytics.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

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

    return {
        "total_users": total_users,
        "total_candidates": total_candidates,
        "total_recruiters": total_recruiters,
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "total_applications": total_applications,
        "average_match_score": avg_score,
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