# candidate_routes.py
# Endpoints for candidate-specific actions: uploading and analyzing resumes.

import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.resume_parser import parse_resume

router = APIRouter(prefix="/candidate", tags=["Candidate"])

UPLOAD_FOLDER = "uploaded_resumes"


@router.post("/upload-resume/{user_id}")
def upload_resume(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Only accept PDF or DOCX files
    if not file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF or DOCX files are allowed")

    # Make sure this user actually exists and is a candidate
    profile = db.query(models.CandidateProfile).filter(
        models.CandidateProfile.user_id == user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    # Save the uploaded file onto our computer, inside uploaded_resumes/
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    safe_filename = f"user_{user_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run our AI parsing logic on the saved file
    try:
        result = parse_resume(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    # Save everything the AI found into the candidate's profile
    profile.resume_file_path = file_path
    profile.resume_text = result["resume_text"]
    profile.extracted_skills = ", ".join(result["skills"])
    profile.extracted_education = result["education"]
    profile.extracted_experience = result["experience"]
    db.commit()
    db.refresh(profile)

    return {
        "message": "Resume uploaded and analyzed successfully",
        "skills": result["skills"],
        "education": result["education"],
        "experience": result["experience"],
        "summary": result.get("summary", ""),
        "ai_powered": result.get("ai_powered", False),
    }


@router.get("/profile/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    """Fetch a candidate's profile, including whatever the AI extracted."""
    profile = db.query(models.CandidateProfile).filter(
        models.CandidateProfile.user_id == user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    return {
        "user_id": profile.user_id,
        "skills": profile.extracted_skills,
        "education": profile.extracted_education,
        "experience": profile.extracted_experience,
        "has_resume": profile.resume_file_path is not None,
    }