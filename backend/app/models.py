# models.py
# This file defines all our database tables as Python classes.
# Each class = one table. Each attribute = one column.

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float
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
    """Extra details that only candidates need — resume, extracted AI info."""
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    phone = Column(String, nullable=True)
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