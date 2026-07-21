# TalentLens — AI Recruitment System

An agentic AI-powered recruitment platform that reads resumes, matches candidates to jobs, explains its reasoning, generates interview questions, and drafts (then sends, with human confirmation) interview invitation and status-notification emails.

**Live app:** https://talentlens-ai-recruitment.vercel.app
**API docs:** https://talentlens-ai-recruitment.onrender.com/docs

## Features

### Candidates
- Register, upload resume (AI-parsed: skills, education, experience, summary)
- Browse/search open jobs by title, skill, or location
- Apply with one click — instant AI match score + human-readable reasoning
- Track application status across every job applied to

### Recruiters
- Post jobs, with an AI quality check that flags vague or incomplete postings before they go live
- View AI-ranked applicants with match scores and detailed reasoning
- Autonomous Screening Agent — AI recommends Auto-Shortlist / Needs Review / Auto-Reject for each applicant, with a one-click "Accept AI suggestion" button (human always confirms — AI never changes status on its own)
- Duplicate applicant detection — flags when a new application's resume closely matches an existing applicant's, so recruiters can catch repeat submissions
- Generate tailored interview questions per candidate (based on their actual resume + fit)
- Draft and send interview invitations, rejection notices, and shortlist notices — all reviewed and edited by the recruiter before sending
- Recruiter Copilot — ask free-form questions ("who are my top 3 candidates?") answered from real hiring data, no hallucinated results
- Hiring funnel analytics — visual funnel (Applied to Shortlisted to Interviewed to Hired) plus average time-to-hire
- Reports dashboard: totals, average match score, status breakdown, per-job performance

### Admins
- Platform-wide user/job overview and analytics

## Agentic AI Architecture

The system uses a sequence of purpose-built AI agents, each with a clear, narrow responsibility:

1. Resume Parsing Agent — extracts skills, education, and experience from uploaded resumes
2. Matching Agent — scores candidate-job fit (0-100%) with plain-language reasoning
3. Screening Agent — makes a shortlist/reject/review recommendation, with a human-in-the-loop confirmation step
4. Interview Agent — generates candidate-specific interview questions
5. Communication Agent — drafts interview invitations and status emails (never sends without explicit recruiter confirmation)
6. Copilot Agent — answers recruiter questions using only real platform data
7. Quality Agent — reviews job postings for clarity before they go live

Every AI-driven decision that affects a real person (rejection, shortlisting, sending an email) requires explicit human confirmation — the AI recommends, a person decides.

## Tech Stack

- Frontend: React (Vite) + Tailwind CSS, deployed on Vercel
- Backend: Python + FastAPI, deployed on Render
- Database: SQLite + SQLAlchemy
- AI: Groq API (resume parsing, match scoring, interview questions, email drafting, job quality checks, copilot Q&A)
- Email: Gmail SMTP

## Running Locally

### Backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

### Frontend
cd frontend
npm run dev

Requires a .env file in backend/ with GROQ_API_KEY, EMAIL_ADDRESS, and EMAIL_APP_PASSWORD, and a .env.local file in frontend/ with VITE_API_URL=http://127.0.0.1:8000.

## Author

Built by S.M.PRAJWEL VINAYAK — a full-stack agentic AI recruitment platform demonstrating resume analysis, candidate-job matching with visible reasoning, autonomous screening with human oversight, and end-to-end recruiter workflow automation.