# ai_engine.py
# Centralizes every call we make to the AI model (via Groq).
# Later modules (match-score reasoning, interview questions, email
# drafting) will add more functions here too.

import json
from groq import Groq
from app.config import GROQ_API_KEY


MODEL_NAME = "openai/gpt-oss-20b"

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def analyze_resume_with_ai(resume_text: str):
    if not client:
        return None

    prompt = f"""You are an expert technical recruiter reading a resume.

Read the resume text below and extract information professionally.

Return ONLY valid JSON, in exactly this shape, no extra commentary:
{{
  "skills": ["skill1", "skill2"],
  "education": "One clear sentence summarizing their highest/most relevant qualification, including institution and field if mentioned.",
  "experience": "One to two clear sentences summarizing their work experience: roles, companies, and approximate duration if mentioned. If they have no real work experience, say so plainly.",
  "summary": "A 2-sentence professional summary of this candidate, written the way a recruiter would describe them to a hiring manager."
}}

Resume text:
\"\"\"
{resume_text[:6000]}
\"\"\"
"""
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=2000,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"[AI ENGINE] Groq call failed, falling back to keyword method: {e}", flush=True)
        return None


def analyze_match_with_ai(resume_text: str, candidate_skills: str, job_title: str, job_description: str, required_skills: str):
    if not client:
        return None

    prompt = f"""You are an expert technical recruiter evaluating a candidate for a role.

JOB TITLE: {job_title}
JOB DESCRIPTION: {job_description}
REQUIRED SKILLS: {required_skills}

CANDIDATE'S RESUME:
\"\"\"
{resume_text[:5000]}
\"\"\"

CANDIDATE'S DETECTED SKILLS: {candidate_skills}

Evaluate how well this candidate matches this specific job. Consider skill
overlap, relevant experience, and education. Be honest and fair — not every
candidate is a good fit, and the score should reflect that.

Return ONLY valid JSON in exactly this shape, no extra commentary:
{{
  "match_score": <integer 0-100>,
  "reasoning": "2-4 sentences explaining the score in plain language: which required skills they have, which they're missing, and how their experience/education fits or doesn't. Written the way a recruiter would explain their reasoning to a hiring manager."
}}
"""
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=2000,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"[AI ENGINE] Match scoring failed, using fallback method: {e}", flush=True)
        return None


def fallback_match_score(candidate_skills: str, required_skills: str):
    candidate_set = set(s.strip().lower() for s in candidate_skills.split(",") if s.strip())
    required_set = set(s.strip().lower() for s in required_skills.split(",") if s.strip())

    if not required_set:
        return 0, "No required skills were listed for this job, so a score could not be calculated."

    matched = candidate_set & required_set
    missing = required_set - candidate_set
    score = round((len(matched) / len(required_set)) * 100)

    reasoning = f"Matched {len(matched)} of {len(required_set)} required skills"
    if matched:
        reasoning += f" ({', '.join(matched)})"
    if missing:
        reasoning += f". Missing: {', '.join(missing)}"
    reasoning += ". (Basic keyword-based score — AI analysis was unavailable.)"

    return score, reasoning


def generate_interview_questions(resume_text: str, job_title: str, job_description: str, ai_reasoning: str):
    if not client:
        return {"error": "No Groq API key configured"}

    prompt = f"""You are an expert technical interviewer preparing for a candidate interview.

JOB TITLE: {job_title}
JOB DESCRIPTION: {job_description}

CANDIDATE'S RESUME:
\"\"\"
{resume_text[:5000]}
\"\"\"

PREVIOUS AI ASSESSMENT OF THIS CANDIDATE: {ai_reasoning}

Write 5 interview questions specifically tailored to this candidate and this
role. Include a mix of: their actual experience/projects, gaps or weak areas
worth probing, and role-relevant scenario questions. Avoid generic questions
that could apply to anyone.

Return ONLY valid JSON in exactly this shape, no extra commentary:
{{
  "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
}}
"""
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=2000,
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("questions", [])
    except Exception as e:
        print(f"[AI ENGINE] Question generation failed: {e}", flush=True)
        return {"error": str(e)}


def draft_interview_email(candidate_name: str, job_title: str, company_name: str, recruiter_name: str):
    if not client:
        return {"error": "No Groq API key configured"}

    prompt = f"""Write a warm, professional interview invitation email.

Candidate name: {candidate_name}
Job title: {job_title}
Company name: {company_name}
Recruiter name (sender): {recruiter_name}

The email should: congratulate them on moving forward, briefly express
enthusiasm about their background, ask them to share their availability for
an interview in the next week, and be signed off by the recruiter. Keep it
concise — 120-160 words. Do not invent a specific date/time; ask them for
their availability instead.

Return ONLY valid JSON in exactly this shape, no extra commentary:
{{
  "subject": "email subject line",
  "body": "the full email body text, with \\n for line breaks"
}}
"""
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.5,
            max_tokens=2000,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"[AI ENGINE] Email drafting failed: {e}", flush=True)
        return {"error": str(e)}