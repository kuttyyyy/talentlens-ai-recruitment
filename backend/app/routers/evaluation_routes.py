# evaluation_routes.py
# Module 7 -- AI Evaluation & Scoring.
#
# Orchestrates evaluation across a candidate's 3 test attempts for one
# application: runs (or reuses) each test's score, combines them into a
# weighted overall score, and attaches Module 6's integrity report per
# test. Never produces a hire/reject decision -- every report ends with
# "AI Assessment -> Recruiter Review Required."

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.evaluation_agent import evaluate_test1_or_2, evaluate_test3
from app.integrity_agent import generate_integrity_report

router = APIRouter(prefix="/evaluations", tags=["Evaluation & Scoring (Module 7)"])


@router.put("/assessment/{assessment_id}/weights")
def update_weights(assessment_id: int, weights: schemas.EvaluationWeightsUpdate, recruiter_id: int, db: Session = Depends(get_db)):
    """Recruiter sets how much each test counts toward the overall score."""
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This assessment doesn't belong to you")

    total = weights.test1_weight + weights.test2_weight + weights.test3_weight
    if total != 100:
        raise HTTPException(status_code=400, detail=f"Weights must sum to 100 (got {total})")

    assessment.test1_weight = weights.test1_weight
    assessment.test2_weight = weights.test2_weight
    assessment.test3_weight = weights.test3_weight
    db.commit()

    return {
        "test1_weight": assessment.test1_weight,
        "test2_weight": assessment.test2_weight,
        "test3_weight": assessment.test3_weight,
    }


@router.post("/application/{application_id}/evaluate")
def evaluate_application(application_id: int, recruiter_id: int, force: bool = False, db: Session = Depends(get_db)):
    """Runs evaluation on every submitted test attempt for this
    application that hasn't been evaluated yet (or all of them, if
    force=True). Safe to call repeatedly -- already-evaluated attempts are
    skipped unless force is set, so this never wastes an AI call re-scoring
    something unchanged."""
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
        raise HTTPException(status_code=404, detail="No approved assessment found for this job")
    if assessment.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This assessment doesn't belong to you")

    # Assessments created before Module 7 existed have NULL weight columns
    # (auto-migrate adds the column but can't know what value old rows should
    # have) -- backfill the spec's default split of 30/25/45 the first time
    # we touch one of these, so both this endpoint and the report endpoint
    # see real numbers instead of None from here on.
    if assessment.test1_weight is None or assessment.test2_weight is None or assessment.test3_weight is None:
        assessment.test1_weight = 30
        assessment.test2_weight = 25
        assessment.test3_weight = 45
        db.commit()

    evaluated_count = 0
    skipped_count = 0

    for test in assessment.tests:
        attempt = (
            db.query(models.TestAttempt)
            .filter(
                models.TestAttempt.application_id == application_id,
                models.TestAttempt.assessment_test_id == test.id,
            )
            .first()
        )
        if not attempt or attempt.status != "submitted":
            continue
        if attempt.evaluated_at is not None and not force:
            skipped_count += 1
            continue

        try:
            content = json.loads(test.content_json) if test.content_json else {}
        except (json.JSONDecodeError, TypeError):
            content = {}
        try:
            answers = json.loads(attempt.answers_json) if attempt.answers_json else {}
        except (json.JSONDecodeError, TypeError):
            answers = {}

        if test.test_type == "practical_simulation":
            result = evaluate_test3(content, answers)
        else:
            result = evaluate_test1_or_2(test.test_type, content, answers)

        attempt.evaluation_score = result["score"]
        attempt.evaluation_json = json.dumps(result)
        attempt.evaluated_at = datetime.now(timezone.utc)
        db.commit()
        evaluated_count += 1

    return {"message": f"Evaluated {evaluated_count} test(s), skipped {skipped_count} already-evaluated test(s)."}


@router.get("/application/{application_id}")
def get_evaluation_report(application_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """The full evidence-based report for one candidate's application:
    per-test scores with breakdowns, integrity flags, and a weighted
    overall score. This never recommends hire/reject -- only the
    recruiter decides."""
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
        return {"tests": [], "overall_score": None, "recommendation": "AI Assessment -> Recruiter Review Required"}

    # Assessments created before Module 7 existed have NULL weight columns
    # (auto-migrate adds the column but can't know what value old rows should
    # have) -- fall back to the spec's default split of 30/25/45 in that case,
    # rather than letting a None weight silently break the weighted-sum math.
    weights = {
        1: assessment.test1_weight if assessment.test1_weight is not None else 30,
        2: assessment.test2_weight if assessment.test2_weight is not None else 25,
        3: assessment.test3_weight if assessment.test3_weight is not None else 45,
    }
    tests_out = []
    weighted_sum = 0.0
    weight_total_scored = 0

    for test in assessment.tests:
        attempt = (
            db.query(models.TestAttempt)
            .filter(
                models.TestAttempt.application_id == application_id,
                models.TestAttempt.assessment_test_id == test.id,
            )
            .first()
        )

        evaluation = None
        if attempt and attempt.evaluation_json:
            try:
                evaluation = json.loads(attempt.evaluation_json)
            except (json.JSONDecodeError, TypeError):
                evaluation = None

        integrity_report = generate_integrity_report(attempt) if attempt else {"flags": [], "disclaimer": None}

        if attempt and attempt.evaluation_score is not None:
            w = weights.get(test.test_number) or 0
            weighted_sum += attempt.evaluation_score * w / 100
            weight_total_scored += w

        tests_out.append({
            "test_id": test.id,
            "test_number": test.test_number,
            "test_type": test.test_type,
            "title": test.title,
            "weight": weights.get(test.test_number, 0),
            "status": attempt.status if attempt else "not_started",
            "score": attempt.evaluation_score if attempt else None,
            "evaluation": evaluation,
            "integrity_report": integrity_report,
        })

    # Only report an overall score once every weighted test has actually been scored
    overall_score = round(weighted_sum) if weight_total_scored == 100 else None

    return {
        "application_id": application_id,
        "assessment_id": assessment.id,
        "weights": weights,
        "tests": tests_out,
        "overall_score": overall_score,
        "recommendation": "AI Assessment -> Recruiter Review Required",
    }
    