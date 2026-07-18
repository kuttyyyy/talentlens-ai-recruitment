# TalentLens — AI Recruitment System

An agentic AI-powered recruitment platform that reads resumes, matches candidates to jobs, explains its reasoning, generates interview questions, and drafts (then sends, with confirmation) interview invitation emails.

## Features
- Candidates: register, upload resume (AI-parsed), browse/search jobs, apply (instant AI match score + reasoning), track application status
- Recruiters: post jobs, view AI-ranked applicants with reasoning, update application status, generate tailored interview questions, draft & send interview invitation emails, view hiring reports
- Admins: platform-wide user/job overview and analytics

## Tech Stack
- Frontend: React (Vite) + Tailwind CSS
- Backend: Python + FastAPI
- Database: SQLite + SQLAlchemy
- AI: Groq API for resume parsing, match scoring, interview question generation, and email drafting
- Email: Gmail SMTP

## Author
Built as a college project by [S.M.PRAJWEL VINAYAK].