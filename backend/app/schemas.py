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