# assessment_routes.py
# JD-Based Agentic AI Assessment System.
#
# Pipeline built here (recruiter-side only, for now):
#   JD Input -> JD Analysis Agent -> 3 Test Generation (Assessment Agent)
#   -> Recruiter Review/Edit -> Recruiter Approval
#
# Candidate-facing testing, the Evaluation Agent, and the Integrity Agent
# are later phases and are intentionally NOT built here yet.

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.ai_engine import analyze_jd_with_ai, generate_assessment_tests_with_ai

router = APIRouter(prefix="/assessments", tags=["JD Assessment System"])

# Fixed order/shape for the 3 tests every assessment always gets.
TEST_DEFINITIONS = [
    (1, "knowledge_reasoning"),
    (2, "situational_judgment"),
    (3, "practical_simulation"),
]


def _test_to_out(test: models.AssessmentTest) -> schemas.AssessmentTestOut:
    """Converts a DB row into the API shape, parsing content_json back into a dict."""
    try:
        content = json.loads(test.content_json) if test.content_json else {}
    except (json.JSONDecodeError, TypeError):
        content = {}

    return schemas.AssessmentTestOut(
        id=test.id,
        assessment_id=test.assessment_id,
        test_number=test.test_number,
        test_type=test.test_type,
        title=test.title,
        instructions=test.instructions,
        duration_minutes=test.duration_minutes,
        content=content,
        ai_allowed=test.ai_allowed,
        allowed_tools=test.allowed_tools,
        internet_allowed=test.internet_allowed,
        proof_of_work_required=bool(test.proof_of_work_required),
        status=test.status,
        created_at=test.created_at,
        updated_at=test.updated_at,
    )


def _assessment_to_out(assessment: models.Assessment) -> schemas.AssessmentOut:
    # Built field-by-field (rather than model_validate on the ORM object)
    # because Assessment.tests are AssessmentTest rows whose content lives
    # in content_json — they need _test_to_out's JSON parsing, not a
    # direct from_attributes pass-through.
    return schemas.AssessmentOut(
        id=assessment.id,
        recruiter_id=assessment.recruiter_id,
        job_id=assessment.job_id,
        title=assessment.title,
        jd_text=assessment.jd_text,
        status=assessment.status,
        extracted_technical_skills=assessment.extracted_technical_skills,
        extracted_soft_skills=assessment.extracted_soft_skills,
        extracted_qualifications=assessment.extracted_qualifications,
        extracted_experience=assessment.extracted_experience,
        extracted_responsibilities=assessment.extracted_responsibilities,
        analysis_summary=assessment.analysis_summary,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        tests=[_test_to_out(t) for t in assessment.tests],
    )


def _get_assessment_or_404(assessment_id: int, db: Session) -> models.Assessment:
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@router.post("/", response_model=schemas.AssessmentOut)
def create_assessment(assessment: schemas.AssessmentCreate, recruiter_id: int, db: Session = Depends(get_db)):
    """Recruiter starts a new assessment: give it a title and the JD text
    (typed/pasted in, or copied over from an existing job posting)."""
    recruiter = db.query(models.User).filter(
        models.User.id == recruiter_id, models.User.role == "recruiter"
    ).first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    if not assessment.jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description text is required")

    if assessment.job_id is not None:
        job = db.query(models.Job).filter(models.Job.id == assessment.job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Linked job not found")

    new_assessment = models.Assessment(
        recruiter_id=recruiter_id,
        job_id=assessment.job_id,
        title=assessment.title,
        jd_text=assessment.jd_text,
        status="draft",
    )
    db.add(new_assessment)
    db.commit()
    db.refresh(new_assessment)
    return _assessment_to_out(new_assessment)


@router.get("/recruiter/{recruiter_id}", response_model=list[schemas.AssessmentSummaryOut])
def list_assessments(recruiter_id: int, db: Session = Depends(get_db)):
    """All assessments created by one recruiter, newest first."""
    return (
        db.query(models.Assessment)
        .filter(models.Assessment.recruiter_id == recruiter_id)
        .order_by(models.Assessment.created_at.desc())
        .all()
    )


@router.get("/{assessment_id}", response_model=schemas.AssessmentOut)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Full assessment detail: JD text, extracted requirements, and its tests."""
    assessment = _get_assessment_or_404(assessment_id, db)
    return _assessment_to_out(assessment)


@router.post("/{assessment_id}/analyze", response_model=schemas.AssessmentOut)
def analyze_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """JD Analysis Agent: extracts skills, qualifications, experience, and
    responsibilities from the JD text. Safe to re-run — a fresh analysis
    simply overwrites the previous one."""
    assessment = _get_assessment_or_404(assessment_id, db)

    result = analyze_jd_with_ai(assessment.jd_text)
    if not result or "error" in result:
        detail = (result or {}).get("error", "AI analysis failed. Please try again.")
        raise HTTPException(status_code=502, detail=detail)

    assessment.extracted_technical_skills = ", ".join(result.get("technical_skills", []) or [])
    assessment.extracted_soft_skills = ", ".join(result.get("soft_skills", []) or [])
    assessment.extracted_qualifications = "; ".join(result.get("qualifications", []) or [])
    assessment.extracted_experience = result.get("experience_required", "")
    assessment.extracted_responsibilities = "; ".join(result.get("responsibilities", []) or [])
    assessment.analysis_summary = result.get("summary", "")
    assessment.status = "analyzed"

    db.commit()
    db.refresh(assessment)
    return _assessment_to_out(assessment)


@router.post("/{assessment_id}/generate-tests", response_model=schemas.AssessmentOut)
def generate_tests(assessment_id: int, db: Session = Depends(get_db)):
    """Assessment Agent: generates the 3 job-specific tests from the JD +
    its extracted requirements. Re-running this REPLACES any existing
    tests for this assessment (and resets their approval status) — only
    call it again if the recruiter wants a fresh set."""
    assessment = _get_assessment_or_404(assessment_id, db)

    if assessment.status == "draft":
        raise HTTPException(
            status_code=400,
            detail="Run JD analysis before generating tests.",
        )

    analysis = {
        "technical_skills": (assessment.extracted_technical_skills or "").split(", "),
        "soft_skills": (assessment.extracted_soft_skills or "").split(", "),
        "qualifications": (assessment.extracted_qualifications or "").split("; "),
        "experience_required": assessment.extracted_experience or "",
        "responsibilities": (assessment.extracted_responsibilities or "").split("; "),
    }

    result = generate_assessment_tests_with_ai(assessment.jd_text, analysis)
    if not result or "error" in result:
        detail = (result or {}).get("error", "AI test generation failed. Please try again.")
        raise HTTPException(status_code=502, detail=detail)

    # Wipe any previously generated tests before writing the fresh set
    db.query(models.AssessmentTest).filter(models.AssessmentTest.assessment_id == assessment_id).delete()

    test_payloads = {
        1: result.get("test_1", {}),
        2: result.get("test_2", {}),
        3: result.get("test_3", {}),
    }

    for test_number, test_type in TEST_DEFINITIONS:
        payload = test_payloads.get(test_number, {}) or {}

        if test_number == 3:
            content = {
                "task_description": payload.get("task_description", ""),
                "deliverable_instructions": payload.get("deliverable_instructions", ""),
                "evaluation_criteria": payload.get("evaluation_criteria", []),
                "required_software": payload.get("required_software", []),
                "submission_format": payload.get("submission_format", ""),
                "required_files": payload.get("required_files", []),
            }
            ai_allowed = payload.get("suggested_ai_policy") or "not_allowed"
            allowed_tools = ", ".join(payload.get("suggested_allowed_tools", []) or [])
            internet_allowed = payload.get("suggested_internet_policy") or "not_allowed"
            instructions = payload.get("deliverable_instructions", "")
        elif test_number == 2:
            content = {"scenarios": payload.get("scenarios", [])}
            ai_allowed = None
            allowed_tools = None
            internet_allowed = None
            instructions = payload.get("instructions", "")
        else:
            content = {"questions": payload.get("questions", [])}
            ai_allowed = None
            allowed_tools = None
            internet_allowed = None
            instructions = payload.get("instructions", "")

        new_test = models.AssessmentTest(
            assessment_id=assessment_id,
            test_number=test_number,
            test_type=test_type,
            title=payload.get("title", f"Test {test_number}"),
            instructions=instructions,
            duration_minutes=payload.get("duration_minutes", 30),
            content_json=json.dumps(content),
            ai_allowed=ai_allowed,
            allowed_tools=allowed_tools,
            internet_allowed=internet_allowed,
            proof_of_work_required=False,  # recruiter opts in explicitly -- AI shouldn't decide this
            status="draft",
        )
        db.add(new_test)

    assessment.status = "tests_generated"
    db.commit()
    db.refresh(assessment)
    return _assessment_to_out(assessment)


@router.put("/{assessment_id}/tests/{test_id}", response_model=schemas.AssessmentTestOut)
def update_test(assessment_id: int, test_id: int, update: schemas.AssessmentTestUpdate, db: Session = Depends(get_db)):
    """Recruiter edits a generated test's content before approving it.
    Any edit un-approves the test — it must be explicitly re-approved."""
    test = db.query(models.AssessmentTest).filter(
        models.AssessmentTest.id == test_id, models.AssessmentTest.assessment_id == assessment_id
    ).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    test.title = update.title
    test.instructions = update.instructions
    test.duration_minutes = update.duration_minutes
    test.content_json = json.dumps(update.content)
    test.ai_allowed = update.ai_allowed
    test.allowed_tools = update.allowed_tools
    test.internet_allowed = update.internet_allowed
    test.proof_of_work_required = update.proof_of_work_required
    test.status = "draft"  # editing invalidates a prior approval

    db.commit()
    db.refresh(test)
    return _test_to_out(test)


@router.post("/{assessment_id}/tests/{test_id}/approve", response_model=schemas.AssessmentTestOut)
def approve_test(assessment_id: int, test_id: int, db: Session = Depends(get_db)):
    """Recruiter approves one test as ready for candidates."""
    test = db.query(models.AssessmentTest).filter(
        models.AssessmentTest.id == test_id, models.AssessmentTest.assessment_id == assessment_id
    ).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    test.status = "approved"
    db.commit()
    db.refresh(test)
    return _test_to_out(test)


@router.post("/{assessment_id}/tests/{test_id}/unapprove", response_model=schemas.AssessmentTestOut)
def unapprove_test(assessment_id: int, test_id: int, db: Session = Depends(get_db)):
    """Recruiter pulls a test back into draft, e.g. to make further edits."""
    test = db.query(models.AssessmentTest).filter(
        models.AssessmentTest.id == test_id, models.AssessmentTest.assessment_id == assessment_id
    ).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    test.status = "draft"
    if db.query(models.Assessment).get(assessment_id).status == "approved":
        db.query(models.Assessment).get(assessment_id).status = "tests_generated"
    db.commit()
    db.refresh(test)
    return _test_to_out(test)


@router.post("/{assessment_id}/approve", response_model=schemas.AssessmentOut)
def approve_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Finalizes the assessment: requires all 3 tests to already be
    individually approved. This is the recruiter's sign-off that the
    assessment is ready to be given to candidates (candidate-facing
    delivery is a later phase)."""
    assessment = _get_assessment_or_404(assessment_id, db)

    if len(assessment.tests) < 3:
        raise HTTPException(status_code=400, detail="Generate all 3 tests before approving.")

    not_approved = [t.test_number for t in assessment.tests if t.status != "approved"]
    if not_approved:
        raise HTTPException(
            status_code=400,
            detail=f"Test(s) {', '.join(str(n) for n in not_approved)} still need approval.",
        )

    assessment.status = "approved"
    db.commit()
    db.refresh(assessment)
    return _assessment_to_out(assessment)


@router.delete("/{assessment_id}")
def delete_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Deletes an assessment and its tests. This cannot be undone."""
    assessment = _get_assessment_or_404(assessment_id, db)
    db.delete(assessment)
    db.commit()
    return {"message": "Assessment deleted"}
