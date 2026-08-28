# test_attempt_routes.py
# Module 4 -- Candidate Assessment System.
#
# Connects Module 1's approved assessments to the candidate portal: a
# candidate sees the tests tied to jobs they've applied to, takes them
# with a timer, and submits. Correct answers/explanations are never sent
# to the candidate -- only the recruiter (via a later module) sees those.

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/test-attempts", tags=["Candidate Assessments (Module 4)"])

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


def _attempt_to_out(attempt: models.TestAttempt, test: models.AssessmentTest) -> dict:
    try:
        content = json.loads(test.content_json) if test.content_json else {}
    except (json.JSONDecodeError, TypeError):
        content = {}

    try:
        answers = json.loads(attempt.answers_json) if attempt.answers_json else {}
    except (json.JSONDecodeError, TypeError):
        answers = {}

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
        "content": _sanitize_content(content),
        "status": attempt.status,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "answers": answers,
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

    return _attempt_to_out(attempt, test)


@router.put("/{attempt_id}/save")
def save_attempt(attempt_id: int, update: schemas.TestAttemptSave, db: Session = Depends(get_db)):
    """Saves in-progress answers without finalizing the attempt."""
    attempt = db.query(models.TestAttempt).filter(models.TestAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status == "submitted":
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

    attempt.answers_json = json.dumps(submission.answers)
    if submission.integrity_events is not None:
        attempt.integrity_events_json = json.dumps(submission.integrity_events)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)

    db.commit()
    return {"message": "Test submitted successfully", "status": "submitted", "submitted_at": attempt.submitted_at}
