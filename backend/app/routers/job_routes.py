# job_routes.py
# Endpoints for job postings: recruiters create/edit/close jobs,
# candidates search and browse open jobs.

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("/", response_model=schemas.JobOut)
def create_job(job: schemas.JobCreate, recruiter_id: int, db: Session = Depends(get_db)):
    """A recruiter posts a new job."""
    recruiter = db.query(models.User).filter(
        models.User.id == recruiter_id, models.User.role == "recruiter"
    ).first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    new_job = models.Job(
        recruiter_id=recruiter_id,
        title=job.title,
        description=job.description,
        required_skills=job.required_skills,
        location=job.location,
        job_type=job.job_type,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job


@router.get("/", response_model=list[schemas.JobOut])
def list_jobs(search: Optional[str] = None, db: Session = Depends(get_db)):
    """Browse all open jobs. Optional ?search= filters by title, skills, or location."""
    query = db.query(models.Job).filter(models.Job.status == "open")

    if search:
        like_pattern = f"%{search}%"
        query = query.filter(
            (models.Job.title.ilike(like_pattern))
            | (models.Job.required_skills.ilike(like_pattern))
            | (models.Job.location.ilike(like_pattern))
        )

    return query.order_by(models.Job.created_at.desc()).all()


@router.get("/recruiter/{recruiter_id}", response_model=list[schemas.JobOut])
def get_recruiter_jobs(recruiter_id: int, db: Session = Depends(get_db)):
    """All jobs (open or closed) posted by one recruiter — for their dashboard."""
    return (
        db.query(models.Job)
        .filter(models.Job.recruiter_id == recruiter_id)
        .order_by(models.Job.created_at.desc())
        .all()
    )


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get one specific job's full details."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=schemas.JobOut)
def update_job(job_id: int, job_update: schemas.JobCreate, db: Session = Depends(get_db)):
    """A recruiter edits their existing job posting."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.title = job_update.title
    job.description = job_update.description
    job.required_skills = job_update.required_skills
    job.location = job_update.location
    job.job_type = job_update.job_type
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}")
def close_job(job_id: int, db: Session = Depends(get_db)):
    """Closes a job posting (we keep the record, just mark it closed
    rather than deleting it, so past applications still make sense)."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "closed"
    db.commit()
    return {"message": "Job closed successfully"}