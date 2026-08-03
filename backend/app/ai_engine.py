# ai_engine.py
# Centralizes every call we make to the AI model (via Groq).

import json
import re
import time
from difflib import SequenceMatcher
from groq import Groq
from app.config import GROQ_API_KEY

MODEL_NAME = "openai/gpt-oss-20b"

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def _generate_json(prompt: str, temperature: float = 0.3, max_tokens: int = 2000, retries: int = 2):
    """
    Shared helper for every AI call that expects JSON back. Retries
    automatically if Groq returns malformed JSON or a transient error —
    this fixes the occasional 'json_validate_failed' error that isn't
    caused by our prompt, just an inconsistent model response.
    Returns a dict on success, or {"error": "..."} after all retries fail.
    """
    if not client:
        return {"error": "No Groq API key configured"}

    last_error = "Unknown error"
    for attempt in range(retries + 1):
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            last_error = str(e)
            print(f"[AI ENGINE] Attempt {attempt + 1} failed: {e}", flush=True)
            if attempt < retries:
                time.sleep(1)  # brief pause before retrying

    return {"error": last_error}


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
    result = _generate_json(prompt, temperature=0.2, max_tokens=2000)
    return None if "error" in result else result


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

Also decide a recommendation: "auto_reject" if this candidate clearly does
not meet the core requirements, "auto_shortlist" if they clearly meet or
exceed them, or "needs_review" if it's genuinely borderline and a human
should look closer. Be conservative — only recommend auto_reject or
auto_shortlist when you're confident; default to needs_review otherwise.

Return ONLY valid JSON in exactly this shape, no extra commentary:
{{
  "match_score": <integer 0-100>,
  "reasoning": "2-4 sentences explaining the score in plain language: which required skills they have, which they're missing, and how their experience/education fits or doesn't. Written the way a recruiter would explain their reasoning to a hiring manager.",
  "recommendation": "auto_reject" | "needs_review" | "auto_shortlist"
}}
"""
    result = _generate_json(prompt, temperature=0.3, max_tokens=2000)
    return None if "error" in result else result


def fallback_match_score(candidate_skills: str, required_skills: str):
    candidate_set = set(s.strip().lower() for s in candidate_skills.split(",") if s.strip())
    required_set = set(s.strip().lower() for s in required_skills.split(",") if s.strip())

    if not required_set:
        return 0, "No required skills were listed for this job, so a score could not be calculated.", "needs_review"

    matched = candidate_set & required_set
    missing = required_set - candidate_set
    score = round((len(matched) / len(required_set)) * 100)

    reasoning = f"Matched {len(matched)} of {len(required_set)} required skills"
    if matched:
        reasoning += f" ({', '.join(matched)})"
    if missing:
        reasoning += f". Missing: {', '.join(missing)}"
    reasoning += ". (Basic keyword-based score — AI analysis was unavailable.)"

    if score < 30:
        recommendation = "auto_reject"
    elif score >= 75:
        recommendation = "auto_shortlist"
    else:
        recommendation = "needs_review"

    return score, reasoning, recommendation


def generate_interview_questions(resume_text: str, job_title: str, job_description: str, ai_reasoning: str):
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
    result = _generate_json(prompt, temperature=0.4, max_tokens=2000)
    if "error" in result:
        return {"error": result["error"]}
    return result.get("questions", [])


def draft_interview_email(candidate_name: str, job_title: str, company_name: str, recruiter_name: str):
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
    return _generate_json(prompt, temperature=0.5, max_tokens=2000)


def draft_status_email(candidate_name: str, job_title: str, company_name: str, recruiter_name: str, email_type: str):
    """Drafts a rejection or shortlist-notice email. email_type must be
    'rejected' or 'shortlisted' (matches the application's status)."""
    if email_type == "rejected":
        instruction = (
            f"Write a warm, respectful rejection email to {candidate_name} for the "
            f"{job_title} position at {company_name}. Be kind and encouraging, keep it "
            f"concise (100-140 words), thank them for their time, and do not give a "
            f"specific reason for the rejection. Sign off as {recruiter_name}."
        )
    elif email_type == "shortlisted":
        instruction = (
            f"Write a warm, encouraging email to {candidate_name} letting them know "
            f"they've been shortlisted for the {job_title} position at {company_name}, "
            f"and that the team will follow up soon with next steps. Keep it concise "
            f"(100-140 words) and positive. Sign off as {recruiter_name}."
        )
    else:
        return {"error": f"Unknown email_type: {email_type}"}

    prompt = f"""{instruction}

Return ONLY valid JSON in exactly this shape, no extra commentary:
{{
  "subject": "email subject line",
  "body": "the full email body text, with \\n for line breaks"
}}
"""
    return _generate_json(prompt, temperature=0.5, max_tokens=2000)


def answer_copilot_question(question: str, context_data: str):
    prompt = f"""You are a recruiter's AI assistant with access to their real
hiring data below. Answer their question using ONLY this data — do not
invent candidates, jobs, or numbers that aren't present. If the data doesn't
contain enough information to answer, say so plainly.

RECRUITER'S DATA:
\"\"\"
{context_data[:6000]}
\"\"\"

RECRUITER'S QUESTION: {question}

Answer in plain, direct language, the way a helpful colleague would —
2-5 sentences, referencing specific candidates/jobs/numbers from the data
when relevant.

Return ONLY valid JSON in exactly this shape, no extra commentary:
{{
  "answer": "your answer here"
}}
"""
    result = _generate_json(prompt, temperature=0.3, max_tokens=1000)
    if "error" in result:
        return {"error": result["error"]}
    return result.get("answer", "")


def check_job_description_quality(title: str, description: str, required_skills: str, location: str, job_type: str):
    """Reviews a job posting before it goes live: checks the title,
    description, and required skills together for completeness AND
    writing quality (spelling, grammar, sentence structure)."""

    # --- Rule-based pre-check: catches obvious issues without relying on AI ---
    rule_issues = []

    stripped = description.strip()

    if stripped and not stripped.endswith((".", "!", "?")):
        rule_issues.append(
            "The description doesn't end with proper punctuation, or has extra unrelated text at the end — please review it."
        )

    if re.findall(r"[a-z]\.[A-Za-z]", description):
        rule_issues.append("There's a missing space after a period somewhere in the description.")

    weird_case = set(re.findall(r"\b[a-z]+[A-Z][a-zA-Z]*\b", description))
    if weird_case:
        rule_issues.append(f"Unusual capitalization found in: {', '.join(weird_case)} — check for typos.")

    # --- AI check ---
    if not client:
        return {
            "overall_quality": "needs_improvement" if rule_issues else "good",
            "suggestions": rule_issues,
        }

    prompt = f"""You are an expert copy editor reviewing a job posting for
publication. Your MOST IMPORTANT job is to catch every spelling mistake,
grammar error, missing punctuation (commas, periods, capitalization), and
awkward phrasing — do not let a single one slip through.

JOB TITLE: {title}
DESCRIPTION: {description}
REQUIRED SKILLS: {required_skills}
LOCATION: {location or "Not specified"}
JOB TYPE: {job_type or "Not specified"}

Go through the DESCRIPTION sentence by sentence. For each sentence, check:
- Spelling: any misspelled word, even common ones
- Punctuation: missing or wrong commas, periods, capitalization
- Grammar: subject-verb agreement, tense consistency, run-on sentences
- Clarity: awkward or broken phrasing

Then separately check the TITLE and REQUIRED SKILLS for the same issues,
plus whether they're specific/complete enough for a real job posting.

Do not assume the text is clean — actively look for at least one issue.
If you truly find nothing wrong after this sentence-by-sentence check,
only then say so.

For every issue found, quote the EXACT problematic phrase from the text
and give the specific correction.

Respond with JSON in exactly this shape:
{{
  "overall_quality": "good or needs_improvement",
  "suggestions": ["one string per issue found, empty array if none"]
}}
"""
    result = _generate_json(prompt, temperature=0.1, max_tokens=1500)

    if "error" in result:
        return {
            "overall_quality": "needs_improvement" if rule_issues else "good",
            "suggestions": rule_issues or [
                "AI review was temporarily unavailable — you can post as-is, or try checking again in a moment."
            ],
        }

    ai_suggestions = result.get("suggestions", [])
    if not isinstance(ai_suggestions, list):
        ai_suggestions = []

    combined_suggestions = rule_issues + ai_suggestions
    overall = "needs_improvement" if combined_suggestions else result.get("overall_quality", "good")

    return {
        "overall_quality": overall,
        "suggestions": combined_suggestions,
    }


def detect_duplicate_applicant(resume_text: str, other_applications: list):
    """Checks if this resume looks like a near-duplicate of any other
    applicant's resume for the SAME job. Pure text similarity — no AI
    call needed, so it's instant and free."""
    if not resume_text:
        return None

    for other in other_applications:
        other_text = other.get("resume_text") or ""
        if not other_text:
            continue

        similarity = SequenceMatcher(None, resume_text[:3000], other_text[:3000]).ratio()
        if similarity > 0.85:
            return other.get("candidate_name")

    return None