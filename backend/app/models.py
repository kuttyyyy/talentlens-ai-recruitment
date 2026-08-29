# models.py
# This file defines all our database tables as Python classes.
# Each class = one table. Each attribute = one column.

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """Every person who can log in: candidates, recruiters, and admins."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)  # we NEVER store plain passwords
    role = Column(String, nullable=False)  # "candidate", "recruiter", or "admin"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships let us easily access related data, e.g. user.candidate_profile
    candidate_profile = relationship("CandidateProfile", back_populates="user", uselist=False)
    jobs_posted = relationship("Job", back_populates="recruiter")


class CandidateProfile(Base):
    """Extra details that only candidates need — self-entered profile info,
    plus the resume file and whatever the AI extracted from it."""
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    phone = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)

    # Candidate-entered profile fields (Module 2). Stored as JSON text so
    # each one can hold a flexible list of entries (e.g. multiple degrees,
    # multiple jobs) without needing separate tables for an MVP.
    skills = Column(Text, nullable=True)              # comma-separated, self-reported
    education_json = Column(Text, nullable=True)       # [{degree, institution, year}]
    experience_json = Column(Text, nullable=True)      # [{company, role, duration, description}]
    internships_json = Column(Text, nullable=True)      # [{company, role, duration, description}]
    certifications_json = Column(Text, nullable=True)   # [{name, issuer, year}]
    projects_json = Column(Text, nullable=True)         # [{title, description, link}]

    # Resume upload + AI extraction (already existed — untouched)
    resume_file_path = Column(String, nullable=True)      # where the uploaded file is saved
    resume_text = Column(Text, nullable=True)              # raw text extracted from resume
    extracted_skills = Column(Text, nullable=True)         # AI-found skills (comma-separated)
    extracted_education = Column(Text, nullable=True)      # AI-found education
    extracted_experience = Column(Text, nullable=True)     # AI-found work experience
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="candidate_profile")


class Job(Base):
    """A job posting created by a recruiter."""
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    required_skills = Column(Text, nullable=False)   # comma-separated, used for AI matching
    location = Column(String, nullable=True)
    job_type = Column(String, nullable=True)          # e.g. Full-time, Internship
    status = Column(String, default="open")           # "open" or "closed"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recruiter = relationship("User", back_populates="jobs_posted")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    """A candidate applying to a specific job, plus the AI's evaluation of them."""
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    candidate_id = Column(Integer, ForeignKey("users.id"))
    match_score = Column(Float, nullable=True)         # AI-calculated 0-100 score
    ai_reasoning = Column(Text, nullable=True)          # AI's explanation for the score
    ai_recommendation = Column(String, nullable=True)   # "auto_reject", "needs_review", or "auto_shortlist"
    possible_duplicate_of = Column(String, nullable=True)  # candidate name, if resume looks like a near-duplicate
    hired_at = Column(DateTime(timezone=True), nullable=True)  # set automatically when status becomes "hired"

    # Module 3 — AI CV Analysis & CV-JD Matching (richer, evidence-based
    # detail alongside the quick match_score/ai_reasoning above)
    cv_analysis_json = Column(Text, nullable=True)   # {education, skills, experience, internships, certifications, projects, achievements}
    jd_match_json = Column(Text, nullable=True)       # {requirements: [{requirement, evidence, match}], alignment_score, strong_matches, partial_matches, missing_requirements, summary}

    status = Column(String, default="applied")          # applied, shortlisted, interview_scheduled, rejected, hired
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="applications")
    candidate = relationship("User")
    interview_questions = relationship("InterviewQuestion", back_populates="application")


class InterviewQuestion(Base):
    """AI-generated interview questions for a specific application."""
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    question_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="interview_questions")


class Assessment(Base):
    """A JD-Based Agentic AI Assessment container: one job description,
    its AI-extracted requirements, and the 3 AI-generated tests built
    from it. Can optionally link back to an existing Job posting, or
    stand alone with its own pasted-in JD text."""
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"))
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)  # optional link to a real job posting
    title = Column(String, nullable=False)
    jd_text = Column(Text, nullable=False)

    # status moves forward: draft -> analyzed -> tests_generated -> approved
    status = Column(String, default="draft")

    # JD Analysis Agent output (comma-separated lists stored as text, same pattern as Job.required_skills)
    extracted_technical_skills = Column(Text, nullable=True)
    extracted_soft_skills = Column(Text, nullable=True)
    extracted_qualifications = Column(Text, nullable=True)
    extracted_experience = Column(Text, nullable=True)
    extracted_responsibilities = Column(Text, nullable=True)
    analysis_summary = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    recruiter = relationship("User")
    job = relationship("Job")
    tests = relationship(
        "AssessmentTest",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentTest.test_number",
    )


class AssessmentTest(Base):
    """One of the 3 AI-generated tests belonging to an Assessment.
    content_json holds the full test body (questions/scenarios/task
    spec) as a JSON string — its shape depends on test_type, so we
    don't force it into rigid columns."""
    __tablename__ = "assessment_tests"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"))
    test_number = Column(Integer, nullable=False)  # 1, 2, or 3
    test_type = Column(String, nullable=False)  # knowledge_reasoning | situational_judgment | practical_simulation
    title = Column(String, nullable=False)
    instructions = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=30)
    content_json = Column(Text, nullable=False)  # JSON-encoded questions/scenarios/task spec

    # Mainly used by Test 3 (Practical Job Simulation) — the recruiter's
    # explicit calls on the rules of the practical task, per the spec.
    ai_allowed = Column(String, nullable=True)      # "allowed" | "not_allowed" | None (n/a for tests 1 & 2)
    allowed_tools = Column(Text, nullable=True)      # comma-separated
    internet_allowed = Column(String, nullable=True)      # "allowed" | "not_allowed" | None (n/a for tests 1 & 2)
    proof_of_work_required = Column(Boolean, default=False)  # candidate must confirm/describe proof of work

    status = Column(String, default="draft")  # draft | approved
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship("Assessment", back_populates="tests")


class TestAttempt(Base):
    """A candidate's attempt at one of an approved assessment's tests
    (Module 4). Tied to their Application, since that's what connects a
    candidate to a specific job's approved assessment."""
    __tablename__ = "test_attempts"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    assessment_test_id = Column(Integer, ForeignKey("assessment_tests.id"))

    answers_json = Column(Text, nullable=True)   # candidate's saved answers, shape depends on test_type
    status = Column(String, default="not_started")  # not_started | in_progress | submitted
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Lightweight instrumentation captured now so the Integrity Agent
    # (a later module) doesn't need to touch this test-taking UI again —
    # nothing reads or flags this data yet.
    integrity_events_json = Column(Text, nullable=True)  # {tab_switches, blur_count, ...}

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application")
    assessment_test = relationship("AssessmentTest")


class EmailLog(Base):
    """Interview invitation, rejection, and shortlist emails — kept as
    drafts until the recruiter confirms sending."""
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String, default="draft")   # "draft" or "sent"
    email_type = Column(String, default="interview_invite")   # "interview_invite", "rejected", or "shortlisted"
    created_at = Column(DateTime(timezone=True), server_default=func.now())