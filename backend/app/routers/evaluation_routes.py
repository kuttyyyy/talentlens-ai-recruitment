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
from app.ai_engine import generate_candidate_summary

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

    # Module 8 -- regenerate the consolidated candidate summary whenever
    # at least one test was (re-)evaluated, so the report always reflects
    # the latest results.
    if evaluated_count > 0:
        try:
            jd_match = json.loads(application.jd_match_json) if application.jd_match_json else {}
        except (json.JSONDecodeError, TypeError):
            jd_match = {}

        test_summaries = []
        for test in assessment.tests:
            attempt = (
                db.query(models.TestAttempt)
                .filter(
                    models.TestAttempt.application_id == application_id,
                    models.TestAttempt.assessment_test_id == test.id,
                )
                .first()
            )
            if attempt and attempt.evaluation_json:
                try:
                    ev = json.loads(attempt.evaluation_json)
                    test_summaries.append({
                        "test_number": test.test_number,
                        "score": attempt.evaluation_score,
                        "strengths": ev.get("strengths", []),
                        "weaknesses": ev.get("weaknesses", []),
                        "skills_demonstrated": ev.get("skills_demonstrated", []),
                    })
                except (json.JSONDecodeError, TypeError):
                    pass

        summary = generate_candidate_summary(jd_match.get("summary", ""), test_summaries)
        if summary:
            application.candidate_summary_json = json.dumps(summary)
            db.commit()

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

    # Batch-fetch all of this application's TestAttempts in one query
    # (3 tests = 1 query now, instead of 3).
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

    try:
        candidate_summary = json.loads(application.candidate_summary_json) if application.candidate_summary_json else None
    except (json.JSONDecodeError, TypeError):
        candidate_summary = None

    return {
        "application_id": application_id,
        "assessment_id": assessment.id,
        "weights": weights,
        "tests": tests_out,
        "overall_score": overall_score,
        "candidate_summary": candidate_summary,
        "recommendation": "AI Assessment -> Recruiter Review Required",
    }


@router.get("/job/{job_id}/comparison")
def get_candidate_comparison(job_id: int, recruiter_id: int, db: Session = Depends(get_db)):
    """Module 8's Candidate Comparison table: one row per applicant to this
    job, with their JD match score, each test score, overall weighted
    score, an integrity summary, and their current status. Built for
    sorting/filtering client-side, so it returns everything in one call."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This job doesn't belong to you")

    assessment = (
        db.query(models.Assessment)
        .filter(models.Assessment.job_id == job_id, models.Assessment.status == "approved")
        .first()
    )
    weights = (
        {1: assessment.test1_weight, 2: assessment.test2_weight, 3: assessment.test3_weight}
        if assessment else {1: 30, 2: 25, 3: 45}
    )

    applications = db.query(models.Application).filter(models.Application.job_id == job_id).all()
    rows = []

    # Batch-fetch every TestAttempt for every applicant in ONE query,
    # grouped by application id -- this used to run one query per test per
    # applicant (e.g. 10 applicants x 3 tests = 30 round trips), which was
    # the single biggest slowdown on this page.
    application_ids = [a.id for a in applications]
    attempts_by_application = {}
    if application_ids and assessment:
        all_attempts = (
            db.query(models.TestAttempt)
            .filter(models.TestAttempt.application_id.in_(application_ids))
            .all()
        )
        for at in all_attempts:
            attempts_by_application.setdefault(at.application_id, {})[at.assessment_test_id] = at

    for application in applications:
        try:
            jd_match = json.loads(application.jd_match_json) if application.jd_match_json else {}
        except (json.JSONDecodeError, TypeError):
            jd_match = {}

        test_scores = {1: None, 2: None, 3: None}
        integrity_flag_count = 0
        highest_severity = None
        weighted_sum = 0.0
        weight_total_scored = 0

        if assessment:
            application_attempts = attempts_by_application.get(application.id, {})
            for test in assessment.tests:
                attempt = application_attempts.get(test.id)
                if not attempt:
                    continue

                test_scores[test.test_number] = attempt.evaluation_score

                if attempt.evaluation_score is not None:
                    w = weights.get(test.test_number, 0)
                    weighted_sum += attempt.evaluation_score * w / 100
                    weight_total_scored += w

                if attempt.status == "submitted":
                    report = generate_integrity_report(attempt)
                    integrity_flag_count += len(report["flags"])
                    for f in report["flags"]:
                        if f["severity"] == "high":
                            highest_severity = "high"
                        elif f["severity"] == "medium" and highest_severity != "high":
                            highest_severity = "medium"
                        elif f["severity"] == "low" and highest_severity is None:
                            highest_severity = "low"

        overall_score = round(weighted_sum) if weight_total_scored == 100 else None

        rows.append({
            "application_id": application.id,
            "candidate_id": application.candidate_id,
            "candidate_name": application.candidate.full_name,
            "jd_match_score": jd_match.get("alignment_score"),
            "test1_score": test_scores[1],
            "test2_score": test_scores[2],
            "test3_score": test_scores[3],
            "overall_score": overall_score,
            "integrity_flag_count": integrity_flag_count,
            "integrity_highest_severity": highest_severity,
            "status": application.status,
        })

    return {"job_id": job_id, "job_title": job.title, "candidates": rows}
    