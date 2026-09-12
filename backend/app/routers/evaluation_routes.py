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


def _cv_match_score(application: models.Application):
    """The CV-JD Match Detail score (Module 3's richer, evidence-based
    alignment_score) -- falls back to the quick apply-time match_score if
    the detailed analysis isn't available for some reason (e.g. an older
    application, or the AI call failed at apply time)."""
    if application.jd_match_json:
        try:
            jd_match = json.loads(application.jd_match_json)
            alignment_score = jd_match.get("alignment_score")
            if alignment_score is not None:
                return alignment_score
        except (json.JSONDecodeError, TypeError):
            pass
    return application.match_score


def _blend_overall_score(cv_match_score, assessment_weighted_sum, assessment_weight_scored, cv_match_weight):
    """Module 3 -- Overall Score Match: the TRUE overall score is never
    just the CV/resume + CV-JD match, and never just the assessment
    results -- it's a blend of both, using the recruiter-configurable
    cv_match_weight (defaults to 30% CV-JD match / 70% assessments).
    Returns None until BOTH halves are actually available, same
    "never fabricate a number" principle as the assessment-only score
    that existed before."""
    if assessment_weight_scored != 100 or assessment_weighted_sum is None:
        return None
    if cv_match_score is None:
        return None
    cv_w = cv_match_weight if cv_match_weight is not None else 30
    assessment_w = 100 - cv_w
    return round(cv_match_score * cv_w / 100 + assessment_weighted_sum * assessment_w / 100)


@router.put("/assessment/{assessment_id}/weights")
def update_weights(assessment_id: int, weights: schemas.EvaluationWeightsUpdate, recruiter_id: int, db: Session = Depends(get_db)):
    """Recruiter sets how much each test counts toward the assessment
    portion of the score, and how much the CV/resume + CV-JD match detail
    counts toward the overall score (Module 3)."""
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This assessment doesn't belong to you")

    total = weights.test1_weight + weights.test2_weight + weights.test3_weight
    if total != 100:
        raise HTTPException(status_code=400, detail=f"Test weights must sum to 100 (got {total})")
    if not (0 <= weights.cv_match_weight <= 100):
        raise HTTPException(status_code=400, detail="CV-JD match weight must be between 0 and 100")

    assessment.test1_weight = weights.test1_weight
    assessment.test2_weight = weights.test2_weight
    assessment.test3_weight = weights.test3_weight
    assessment.cv_match_weight = weights.cv_match_weight
    db.commit()

    return {
        "test1_weight": assessment.test1_weight,
        "test2_weight": assessment.test2_weight,
        "test3_weight": assessment.test3_weight,
        "cv_match_weight": assessment.cv_match_weight,
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
    if assessment.cv_match_weight is None:
        assessment.cv_match_weight = 30
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
            uploaded_files = (
                db.query(models.TestAttemptFile)
                .filter(models.TestAttemptFile.attempt_id == attempt.id)
                .order_by(models.TestAttemptFile.uploaded_at)
                .all()
            )
            # Module 5 -- use the candidate's ACTUALLY uploaded filenames as
            # evidence, rather than whatever they typed into the (now
            # removed) self-reported "files submitted" text field.
            answers["files_submitted"] = (
                ", ".join(f.original_filename for f in uploaded_files) if uploaded_files else "(no files uploaded)"
            )
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

    # Module 3 -- recompute and persist the TRUE overall score (CV/resume +
    # CV-JD match detail blended with assessment results) any time
    # evaluation runs, even if nothing changed this call -- weights may
    # have been edited since the last run.
    weighted_sum = 0.0
    weight_total_scored = 0
    weights = {1: assessment.test1_weight, 2: assessment.test2_weight, 3: assessment.test3_weight}
    for test in assessment.tests:
        attempt = (
            db.query(models.TestAttempt)
            .filter(
                models.TestAttempt.application_id == application_id,
                models.TestAttempt.assessment_test_id == test.id,
            )
            .first()
        )
        if attempt and attempt.evaluation_score is not None:
            w = weights.get(test.test_number) or 0
            weighted_sum += attempt.evaluation_score * w / 100
            weight_total_scored += w

    application.overall_score = _blend_overall_score(
        _cv_match_score(application), weighted_sum, weight_total_scored, assessment.cv_match_weight
    )
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
    cv_match_weight = assessment.cv_match_weight if assessment.cv_match_weight is not None else 30
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

        files = (
            [
                {
                    "id": f.id,
                    "original_filename": f.original_filename,
                    "file_size_bytes": f.file_size_bytes,
                    "uploaded_at": f.uploaded_at,
                }
                for f in db.query(models.TestAttemptFile)
                .filter(models.TestAttemptFile.attempt_id == attempt.id)
                .order_by(models.TestAttemptFile.uploaded_at)
                .all()
            ]
            if attempt and test.test_type == "practical_simulation"
            else []
        )

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
            "files": files,
        })

    # Only report an assessment score once every weighted test has actually been scored
    assessment_score = round(weighted_sum) if weight_total_scored == 100 else None

    # Module 3 -- the TRUE overall score blends this assessment score with
    # the candidate's CV/resume + CV-JD match detail. Persisted so it's
    # available elsewhere (e.g. the comparison table) without recomputing.
    cv_match_score = _cv_match_score(application)
    overall_score = _blend_overall_score(cv_match_score, weighted_sum, weight_total_scored, cv_match_weight)
    application.overall_score = overall_score
    db.commit()

    try:
        candidate_summary = json.loads(application.candidate_summary_json) if application.candidate_summary_json else None
    except (json.JSONDecodeError, TypeError):
        candidate_summary = None

    return {
        "application_id": application_id,
        "assessment_id": assessment.id,
        "weights": weights,
        "cv_match_weight": cv_match_weight,
        "tests": tests_out,
        "cv_match_score": cv_match_score,
        "assessment_score": assessment_score,
        "overall_score": overall_score,
        "candidate_summary": candidate_summary,
        "score_shared": application.score_shared,
        "shared_overall_score": application.shared_overall_score,
        "recruiter_score_feedback": application.recruiter_score_feedback,
        "score_shared_at": application.score_shared_at,
        "recommendation": "AI Assessment -> Recruiter Review Required",
    }


@router.post("/application/{application_id}/share-score")
def share_score_with_candidate(application_id: int, share: schemas.ScoreFeedbackShare, recruiter_id: int, db: Session = Depends(get_db)):
    """Module 3 -- the recruiter shares the candidate's current overall
    score plus an optional message. Takes a snapshot of the score at share
    time so it stays stable even if weights are edited afterward; the
    recruiter can re-share later to push an updated snapshot."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="This application doesn't belong to one of your jobs")
    if application.overall_score is None:
        raise HTTPException(status_code=400, detail="This candidate's overall score isn't ready yet -- run evaluation first")

    application.score_shared = True
    application.shared_overall_score = application.overall_score
    application.recruiter_score_feedback = share.feedback
    application.score_shared_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": "Score and feedback shared with the candidate",
        "shared_overall_score": application.shared_overall_score,
        "recruiter_score_feedback": application.recruiter_score_feedback,
        "score_shared_at": application.score_shared_at,
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
    cv_match_weight = (assessment.cv_match_weight if assessment and assessment.cv_match_weight is not None else 30)

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

        overall_score = _blend_overall_score(_cv_match_score(application), weighted_sum, weight_total_scored, cv_match_weight)

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
    