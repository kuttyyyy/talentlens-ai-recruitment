# test_attempt_routes.py
# Module 4 -- Candidate Assessment System.
#
# Connects Module 1's approved assessments to the candidate portal: a
# candidate sees the tests tied to jobs they've applied to, takes them
# with a timer, and submits. Correct answers/explanations are never sent
# to the candidate -- only the recruiter (via a later module) sees those.

import json
import os
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.integrity_agent import generate_integrity_report

router = APIRouter(prefix="/test-attempts", tags=["Candidate Assessments (Module 4)"])

# Module 5 -- Practical Test File Upload
UPLOAD_FOLDER = "uploaded_practical_test_files"
ALLOWED_EXTENSIONS = (
    ".pdf", ".doc", ".docx", ".txt", ".zip", ".rar",
    ".png", ".jpg", ".jpeg", ".gif",
    ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json",
    ".xlsx", ".csv", ".pptx", ".sql", ".ipynb", ".md",
)
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB per file

# Fields a candidate must never see before (or after) submitting -- these
# are the answer key / grading rationale, reserved for recruiter review.
_ANSWER_KEY_FIELDS = {"correct_answer", "best_option", "explanation", "expected_answer_points"}


def _sanitize_content(content: dict) -> dict:
    """Strips answer-key fields out of a test's content before it's sent
    to a candidate. Works generically across all 3 test shapes."""
    clean = json.loads(json.dumps(content))  # cheap deep copy

    for list_key in ("questions", "scenarios"):
        if list_key in clean and isinstance(clean[list_key], list):
            for item in clean[list_key]:
                for field in _ANSWER_KEY_FIELDS:
                    item.pop(field, None)

    return clean


def _file_to_out(f: models.TestAttemptFile) -> dict:
    return {
        "id": f.id,
        "original_filename": f.original_filename,
        "file_size_bytes": f.file_size_bytes,
        "uploaded_at": f.uploaded_at,
    }


def _attempt_to_out(attempt: models.TestAttempt, test: models.AssessmentTest, db: Session = None) -> dict:
    try:
        content = json.loads(test.content_json) if test.content_json else {}
    except (json.JSONDecodeError, TypeError):
        content = {}

    try:
        answers = json.loads(attempt.answers_json) if attempt.answers_json else {}
    except (json.JSONDecodeError, TypeError):
        answers = {}

    files = []
    if db is not None:
        files = [
            _file_to_out(f)
            for f in db.query(models.TestAttemptFile)
            .filter(models.TestAttemptFile.attempt_id == attempt.id)
            .order_by(models.TestAttemptFile.uploaded_at)
            .all()
        ]

    return {
        "attempt_id": attempt.id,
        "application_id": attempt.application_id,
        "test_id": test.id,
        "test_number": test.test_number,
        "test_type": test.test_type,
        "title": test.title,
        "instructions": test.instructions,
        "duration_minutes": test.duration_minutes,
        "ai_allowed": test.ai_allowed,
        "allowed_tools": test.allowed_tools,
        "internet_allowed": test.internet_allowed,
        "proof_of_work_required": bool(test.proof_of_work_required),
        "content": _sanitize_content(content),
        "status": attempt.status,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "answers": answers,
        "files": files,
    }


@router.get("/candidate/{candidate_id}/assessments")
def get_candidate_assessments(candidate_id: int, db: Session = Depends(get_db)):
    """Every approved assessment tied to a job this candidate applied to,
    plus their attempt status on each of its 3 tests."""
    applications = (
        db.query(models.Application)
        .filter(models.Application.candidate_id == candidate_id)
        .all()
    )

    results = []
    for application in applications:
        assessment = (
            db.query(models.Assessment)
            .filter(
                models.Assessment.job_id == application.job_id,
                models.Assessment.status == "approved",
            )
            .first()
        )
        if not assessment:
            continue

        tests_out = []
        for test in assessment.tests:
            attempt = (
                db.query(models.TestAttempt)
                .filter(
                    models.TestAttempt.application_id == application.id,
                    models.TestAttempt.assessment_test_id == test.id,
                )
                .first()
            )
            tests_out.append({
                "test_id": test.id,
                "test_number": test.test_number,
                "test_type": test.test_type,
                "title": test.title,
                "duration_minutes": test.duration_minutes,
                "ai_allowed": test.ai_allowed,
                "allowed_tools": test.allowed_tools,
                "internet_allowed": test.internet_allowed,
                "proof_of_work_required": bool(test.proof_of_work_required),
                "status": attempt.status if attempt else "not_started",
            })

        results.append({
            "application_id": application.id,
            "job_id": application.job_id,
            "job_title": application.job.title,
            "assessment_id": assessment.id,
            "assessment_title": assessment.title,
            "tests": tests_out,
        })

    return results


@router.get("/preview/{assessment_test_id}")
def preview_test(assessment_test_id: int, db: Session = Depends(get_db)):
    """A read-only look at a test's rules -- duration, AI/internet policy,
    required software, submission format -- WITHOUT starting the clock or
    creating an attempt. Powers the pre-test instructions/consent screen."""
    test = db.query(models.AssessmentTest).filter(models.AssessmentTest.id == assessment_test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    try:
        content = json.loads(test.content_json) if test.content_json else {}
    except (json.JSONDecodeError, TypeError):
        content = {}

    return {
        "test_id": test.id,
        "test_number": test.test_number,
        "test_type": test.test_type,
        "title": test.title,
        "instructions": test.instructions,
        "duration_minutes": test.duration_minutes,
        "ai_allowed": test.ai_allowed,
        "allowed_tools": test.allowed_tools,
        "internet_allowed": test.internet_allowed,
        "proof_of_work_required": bool(test.proof_of_work_required),
        "required_software": content.get("required_software", []),
        "submission_format": content.get("submission_format", ""),
        "required_files": content.get("required_files", []),
    }


@router.post("/start")
def start_attempt(application_id: int, assessment_test_id: int, candidate_id: int, db: Session = Depends(get_db)):
    """Begins (or resumes) a candidate's attempt at one test. Starts the
    clock the first time this is called -- calling it again just resumes
    the same attempt, it does not reset the timer."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to this candidate")

    test = db.query(models.AssessmentTest).filter(models.AssessmentTest.id == assessment_test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    assessment = db.query(models.Assessment).filter(models.Assessment.id == test.assessment_id).first()
    if not assessment or assessment.status != "approved" or assessment.job_id != application.job_id:
        raise HTTPException(status_code=400, detail="This test is not available for this application")

    attempt = (
        db.query(models.TestAttempt)
        .filter(
            models.TestAttempt.application_id == application_id,
            models.TestAttempt.assessment_test_id == assessment_test_id,
        )
        .first()
    )

    if not attempt:
        attempt = models.TestAttempt(
            application_id=application_id,
            assessment_test_id=assessment_test_id,
            status="in_progress",
            started_at=datetime.now(timezone.utc),
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
    elif attempt.status == "not_started":
        attempt.status = "in_progress"
        attempt.started_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(attempt)

    return _attempt_to_out(attempt, test, db)


@router.put("/{attempt_id}/save")
def save_attempt(attempt_id: int, update: schemas.TestAttemptSave, db: Session = Depends(get_db)):
    """Saves in-progress answers without finalizing the attempt."""
    attempt = db.query(models.TestAttempt).filter(models.TestAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status == "submitted":
        attempt.post_submission_attempts = (attempt.post_submission_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="This test has already been submitted and can no longer be edited")

    attempt.answers_json = json.dumps(update.answers)
    if update.integrity_events is not None:
        attempt.integrity_events_json = json.dumps(update.integrity_events)

    db.commit()
    return {"message": "Progress saved"}


@router.post("/{attempt_id}/submit")
def submit_attempt(attempt_id: int, submission: schemas.TestAttemptSubmit, db: Session = Depends(get_db)):
    """Finalizes a candidate's submission. Idempotent -- if it's already
    submitted (e.g. the countdown timer auto-submitted, then the candidate
    also clicked Submit), this just returns the existing submitted state
    rather than erroring or overwriting it."""
    attempt = db.query(models.TestAttempt).filter(models.TestAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status == "submitted":
        return {"message": "Already submitted", "status": "submitted", "submitted_at": attempt.submitted_at}

    test = attempt.assessment_test
    if test and test.test_type == "practical_simulation" and test.proof_of_work_required:
        file_count = (
            db.query(models.TestAttemptFile)
            .filter(models.TestAttemptFile.attempt_id == attempt_id)
            .count()
        )
        if file_count == 0:
            raise HTTPException(status_code=400, detail="Please upload at least one file with your completed work before submitting")

    attempt.answers_json = json.dumps(submission.answers)
    if submission.integrity_events is not None:
        attempt.integrity_events_json = json.dumps(submission.integrity_events)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)

    db.commit()
    return {"message": "Test submitted successfully", "status": "submitted", "submitted_at": attempt.submitted_at}


@router.post("/{attempt_id}/upload-file")
def upload_practical_test_file(attempt_id: int, candidate_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Module 5 (Practical Test File Upload) -- the candidate attaches a
    file of their completed work to their Practical Test (Test 3) attempt.
    Multiple files can be attached before submitting."""
    attempt = db.query(models.TestAttempt).filter(models.TestAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This attempt doesn't belong to you")
    if attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="This test has already been submitted and can no longer be edited")
    if attempt.assessment_test.test_type != "practical_simulation":
        raise HTTPException(status_code=400, detail="File upload is only available for the Practical Test")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext or '(none)'} isn't allowed")

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    safe_filename = f"attempt_{attempt_id}_{int(datetime.now(timezone.utc).timestamp())}_{file.filename}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE_BYTES:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="File is too large (max 25 MB)")

    record = models.TestAttemptFile(
        attempt_id=attempt_id,
        original_filename=file.filename,
        stored_path=file_path,
        file_size_bytes=file_size,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return _file_to_out(record)


@router.get("/{attempt_id}/files")
def list_practical_test_files(attempt_id: int, candidate_id: int, db: Session = Depends(get_db)):
    """The candidate's own list of files they've attached so far."""
    attempt = db.query(models.TestAttempt).filter(models.TestAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This attempt doesn't belong to you")

    files = (
        db.query(models.TestAttemptFile)
        .filter(models.TestAttemptFile.attempt_id == attempt_id)
        .order_by(models.TestAttemptFile.uploaded_at)
        .all()
    )
    return [_file_to_out(f) for f in files]


@router.delete("/file/{file_id}")
def delete_practical_test_file(file_id: int, candidate_id: int, db: Session = Depends(get_db)):
    """The candidate removes a file they attached, before submitting."""
    record = db.query(models.TestAttemptFile).filter(models.TestAttemptFile.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.attempt.application.candidate_id != candidate_id:
        raise HTTPException(status_code=403, detail="This file doesn't belong to you")
    if record.attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="This test has already been submitted and can no longer be edited")

    if os.path.exists(record.stored_path):
        try:
            os.remove(record.stored_path)
        except OSError:
            pass  # DB record removal still proceeds -- an orphaned file on disk isn't worth blocking on

    db.delete(record)
    db.commit()
    return {"message": "File removed"}


@router.get("/file/{file_id}/download")
def download_practical_test_file(file_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Lets a recruiter open/download a file the candidate submitted as
    proof of work for the Practical Test. Only the recruiter who owns the
    job this application belongs to can access it."""
    record = db.query(models.TestAttemptFile).filter(models.TestAttemptFile.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.attempt.application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This file doesn't belong to one of your jobs")
    if not os.path.exists(record.stored_path):
        raise HTTPException(status_code=404, detail="File is missing from storage")

    return FileResponse(record.stored_path, filename=record.original_filename)


@router.get("/application/{application_id}/recruiter-view")
def get_attempts_for_recruiter(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Everything a recruiter needs to review one candidate's test
    attempts for a job: their answers, evaluation (once run), and an
    integrity report per test. Only the recruiter who owns this job can
    view it."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to one of your jobs")

    assessment = (
        db.query(models.Assessment)
        .filter(models.Assessment.job_id == application.job_id, models.Assessment.status == "approved")
        .first()
    )
    if not assessment:
        return {"tests": []}

    results = []
    test_ids = [t.id for t in assessment.tests]
    attempts_by_test_id = {
        at.assessment_test_id: at
        for at in db.query(models.TestAttempt).filter(
            models.TestAttempt.application_id == application_id,
            models.TestAttempt.assessment_test_id.in_(test_ids),
        ).all()
    } if test_ids else {}

    for test in assessment.tests:
        attempt = attempts_by_test_id.get(test.id)

        try:
            answers = json.loads(attempt.answers_json) if attempt and attempt.answers_json else {}
        except (json.JSONDecodeError, TypeError):
            answers = {}

        try:
            evaluation = json.loads(attempt.evaluation_json) if attempt and attempt.evaluation_json else None
        except (json.JSONDecodeError, TypeError):
            evaluation = None

        integrity_report = generate_integrity_report(attempt) if attempt else {"flags": [], "disclaimer": None}

        files = (
            [_file_to_out(f) for f in db.query(models.TestAttemptFile)
                .filter(models.TestAttemptFile.attempt_id == attempt.id)
                .order_by(models.TestAttemptFile.uploaded_at)
                .all()]
            if attempt else []
        )

        results.append({
            "test_id": test.id,
            "test_number": test.test_number,
            "test_type": test.test_type,
            "title": test.title,
            "status": attempt.status if attempt else "not_started",
            "started_at": attempt.started_at if attempt else None,
            "submitted_at": attempt.submitted_at if attempt else None,
            "answers": answers,
            "evaluation_score": attempt.evaluation_score if attempt else None,
            "evaluation": evaluation,
            "integrity_report": integrity_report,
            "files": files,
        })

    return {"tests": results}
