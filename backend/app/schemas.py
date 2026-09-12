from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    """Data required to register a new user."""
    full_name: str
    email: EmailStr
    password: str
    role: str
    company_name: str | None = None  # required when role == "recruiter"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class JobCreate(BaseModel):
    title: str
    description: str
    required_skills: str
    location: str | None = None
    job_type: str | None = None


class JobOut(BaseModel):
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
    status: str


class AssessmentCreate(BaseModel):
    title: str
    jd_text: str
    job_id: int | None = None


class AssessmentTestOut(BaseModel):
    id: int
    assessment_id: int
    test_number: int
    test_type: str
    title: str
    instructions: str | None
    duration_minutes: int
    content: dict
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
    title: str
    instructions: str | None = None
    duration_minutes: int
    content: dict
    ai_allowed: str | None = None
    allowed_tools: str | None = None
    internet_allowed: str | None = None
    proof_of_work_required: bool = False


class AssessmentOut(BaseModel):
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
    id: int
    title: str
    status: str
    job_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateProfileUpdate(BaseModel):
    phone: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    skills: list[str] = []
    education: list[dict] = []
    experience: list[dict] = []
    internships: list[dict] = []
    certifications: list[dict] = []
    projects: list[dict] = []


class CandidateProfileOut(BaseModel):
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
    profile_completion: int


class TestAttemptSave(BaseModel):
    answers: dict
    integrity_events: dict | None = None


class TestAttemptSubmit(BaseModel):
    answers: dict
    integrity_events: dict | None = None


class EvaluationWeightsUpdate(BaseModel):
    test1_weight: int
    test2_weight: int
    test3_weight: int
    cv_match_weight: int = 30


class ScoreFeedbackShare(BaseModel):
    feedback: str | None = None


class InterviewQuestionUpdate(BaseModel):
    question_text: str


class InterviewQuestionCreate(BaseModel):
    question_text: str
    category: str = "general"


class InterviewFeedbackCreate(BaseModel):
    technical_competency: int | None = None
    communication: int | None = None
    problem_solving: int | None = None
    job_knowledge: int | None = None
    overall_feedback: str | None = None
    recommendation: str | None = None


class RecruiterFeedbackCreate(BaseModel):
    overall_usefulness: int | None = None
    ease_of_use: int | None = None
    jd_analysis_useful: int | None = None
    test_generation_useful: int | None = None
    cv_matching_useful: int | None = None
    practical_assessment_useful: int | None = None
    candidate_report_useful: int | None = None
    integrity_info_useful: int | None = None
    would_use_again: int | None = None
    improvement_suggestions: str | None = None
    company_name: str | None = None
    role_title: str | None = None


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class CompanyCreate(BaseModel):
    name: str


class RecruiterPermissionsUpdate(BaseModel):
    company_id: int | None = None
    is_company_admin: bool = False
    can_view_company_wide: bool = False
    can_manage_recruiters: bool = False


class UserStatusUpdate(BaseModel):
    account_status: str
    reason: str | None = None

class PhoneVerificationUpdate(BaseModel):
    status: str  # "confirmed" | "could_not_confirm" | "discrepancy_found"
    notes: str | None = None