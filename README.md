# TalentLens — AI Recruitment System

An agentic AI-powered recruitment platform that reads resumes, matches candidates to jobs, explains its reasoning, generates interview questions, and drafts (then sends, with confirmation) interview invitation emails.

**Live app:** https://talentlens-ai-recruitment.vercel.app
**API docs:** https://talentlens-ai-recruitment.onrender.com/docs

## Features
- **Candidates:** register, upload resume (AI-parsed), browse/search jobs, apply (instant AI match score + reasoning), track application status
- **Recruiters:** post jobs, view AI-ranked applicants with reasoning, update application status, generate tailored interview questions, draft & send interview invitation emails, view hiring reports
- **Admins:** platform-wide user/job overview and analytics

## Tech Stack
- **Frontend:** React (Vite) + Tailwind CSS, deployed on Vercel
- **Backend:** Python + FastAPI, deployed on Render
- **Database:** SQLite + SQLAlchemy
- **AI:** Groq API for resume parsing, match scoring, interview question generation, and email drafting
- **Email:** Gmail SMTP

## Running Locally

### Backend
cd backend, venv\Scripts\activate, uvicorn app.main:app --reload

### Frontend
cd frontend, npm run dev

## Author
Built by S.M.PRAJWEL VINAYAK — a full-stack agentic AI recruitment platform demonstrating resume analysis, candidate-job matching with visible reasoning, and human-in-the-loop email automation.