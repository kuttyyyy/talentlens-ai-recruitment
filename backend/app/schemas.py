# schemas.py
# These classes define what data looks like when it comes IN to our API
# (e.g. registration form data) and what goes OUT (e.g. user info in responses).
# This is different from models.py — models.py is the database structure,
# schemas.py is the API's "contract" with the frontend.

from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    """Data required to register a new user."""
    full_name: str
    email: EmailStr          # automatically validates it looks like a real email
    password: str
    role: str                 # "candidate" or "recruiter"


class UserLogin(BaseModel):
    """Data required to log in."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """What we send back about a user — notice: NO password field here.
    We must never send password data back to the frontend, even hashed."""
    id: int
    full_name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True  # allows this to be built directly from a database object


class Token(BaseModel):
    """What we send back after a successful login."""
    access_token: str
    token_type: str
    user: UserOut


class JobCreate(BaseModel):
    """Data required to create or edit a job posting."""
    title: str
    description: str
    required_skills: str      # comma-separated, e.g. "python, sql, react"
    location: str | None = None
    job_type: str | None = None   # e.g. "Full-time", "Internship"


class JobOut(BaseModel):
    """What we send back when returning job info."""
    id: int
    recruiter_id: int
    title: str
    description: str
    required_skills: str
    location: str | None
    job_type: str | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    """Used when a recruiter changes an applicant's status."""
    status: str  # "applied", "shortlisted", "interview_scheduled", "rejected", "hired"


# ---------------------------------------------------------------------------
# JD-Based Agentic AI Assessment System
# ---------------------------------------------------------------------------

class AssessmentCreate(BaseModel):
    """Data required to start a new assessment: a title and the JD text.
    job_id is optional — set it if this assessment is built from an
    existing job posting, leave it out for a standalone pasted-in JD."""
    title: str
    jd_text: str
    job_id: int | None = None


class AssessmentTestOut(BaseModel):
    """One of the 3 tests belonging to an assessment."""
    id: int
    assessment_id: int
    test_number: int
    test_type: str
    title: str
    instructions: str | None
    duration_minutes: int
    content: dict           # parsed from content_json for the API response
    ai_allowed: str | None
    allowed_tools: str | None
    internet_allowed: str | None
    proof_of_work_required: bool
    status: str
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class AssessmentTestUpdate(BaseModel):
    """Data a recruiter can edit on a generated test before approving it."""
    title: str
    instructions: str | None = None
    duration_minutes: int
    content: dict
    ai_allowed: str | None = None      # "allowed" | "not_allowed" (Test 3 only)
    allowed_tools: str | None = None
    internet_allowed: str | None = None       # "allowed" | "not_allowed" (Test 3 only)
    proof_of_work_required: bool = False      # Test 3 only


class AssessmentOut(BaseModel):
    """Full assessment detail: JD, extracted requirements, and its tests."""
    id: int
    recruiter_id: int
    job_id: int | None
    title: str
    jd_text: str
    status: str
    extracted_technical_skills: str | None
    extracted_soft_skills: str | None
    extracted_qualifications: str | None
    extracted_experience: str | None
    extracted_responsibilities: str | None
    analysis_summary: str | None
    created_at: datetime
    updated_at: datetime | None
    tests: list[AssessmentTestOut] = []

    class Config:
        from_attributes = True


class AssessmentSummaryOut(BaseModel):
    """Lightweight version used for the assessments list page."""
    id: int
    title: str
    status: str
    job_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Candidate Registration & Profile
# ---------------------------------------------------------------------------

class CandidateProfileUpdate(BaseModel):
    """Everything a candidate can edit about their own profile."""
    phone: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    skills: list[str] = []
    education: list[dict] = []        # [{degree, institution, year}]
    experience: list[dict] = []       # [{company, role, duration, description}]
    internships: list[dict] = []      # [{company, role, duration, description}]
    certifications: list[dict] = []   # [{name, issuer, year}]
    projects: list[dict] = []         # [{title, description, link}]


class CandidateProfileOut(BaseModel):
    """Full profile detail shown on the candidate's own profile page."""
    user_id: int
    full_name: str
    email: str
    phone: str | None
    linkedin_url: str | None
    portfolio_url: str | None
    skills: list[str]
    education: list[dict]
    experience: list[dict]
    internships: list[dict]
    certifications: list[dict]
    projects: list[dict]
    has_resume: bool
    extracted_skills: str | None
    extracted_education: str | None
    extracted_experience: str | None
    profile_completion: int  # 0-100

# ---------------------------------------------------------------------------
# Module 4 -- Candidate Assessment System (test-taking)
# ---------------------------------------------------------------------------

class TestAttemptSave(BaseModel):
    """A candidate saving progress on a test, without submitting."""
    answers: dict
    integrity_events: dict | None = None


class TestAttemptSubmit(BaseModel):
    """A candidate's final submission of a test."""
    answers: dict
    integrity_events: dict | None = None
