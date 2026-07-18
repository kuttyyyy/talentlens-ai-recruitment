# resume_parser.py
# Reads resumes and extracts structured information.
# Tries real AI understanding first (via ai_engine.py); if that's
# unavailable for any reason, falls back to our original keyword
# search so the feature never fully breaks.

import re
import pdfplumber
import docx
from app.skills_data import KNOWN_SKILLS
from app.ai_engine import analyze_resume_with_ai


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def extract_text_from_docx(file_path: str) -> str:
    doc = docx.Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])


def extract_text(file_path: str) -> str:
    if file_path.lower().endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    elif file_path.lower().endswith(".docx"):
        return extract_text_from_docx(file_path)
    else:
        raise ValueError("Unsupported file type. Please upload a PDF or DOCX file.")


def find_skills(text: str) -> list:
    """Our original keyword-based skill finder — now used as a backup
    AND as a safety net to catch any skills the AI might phrase differently."""
    text_lower = text.lower()
    found = []
    for skill in KNOWN_SKILLS:
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill)
    return found


def find_education(text: str) -> str:
    degree_keywords = [
        "b.tech", "btech", "bachelor", "b.sc", "bsc", "b.e", "be ",
        "m.tech", "mtech", "master", "m.sc", "msc", "mba", "phd", "diploma",
    ]
    lines = text.split("\n")
    matches = []
    for line in lines:
        line_lower = line.lower()
        for keyword in degree_keywords:
            if keyword in line_lower:
                matches.append(line.strip())
                break
    unique_matches = list(dict.fromkeys(matches))
    return " | ".join(unique_matches) if unique_matches else "Not clearly detected"


def find_experience(text: str) -> str:
    experience_keywords = [
        "years of experience", "yrs of experience", "experience:",
        "intern", "internship", "work experience", "professional experience",
    ]
    lines = text.split("\n")
    matches = []
    for line in lines:
        line_lower = line.lower()
        for keyword in experience_keywords:
            if keyword in line_lower:
                matches.append(line.strip())
                break
    unique_matches = list(dict.fromkeys(matches))
    return " | ".join(unique_matches[:5]) if unique_matches else "Not clearly detected"


def parse_resume(file_path: str) -> dict:
    """
    Main function other parts of the app call.
    Tries AI-powered understanding first; falls back to keyword
    matching only if the AI call fails (e.g. no internet, rate limit).
    """
    text = extract_text(file_path)

    ai_result = analyze_resume_with_ai(text)

    if ai_result:
        # Trust the AI's skill list, but also add any known skills our
        # keyword list catches that the AI might have phrased differently.
        keyword_skills = find_skills(text)
        ai_skills = [s.lower().strip() for s in ai_result.get("skills", [])]
        combined_skills = list(dict.fromkeys(ai_skills + [s for s in keyword_skills if s not in ai_skills]))

        return {
            "resume_text": text,
            "skills": combined_skills,
            "education": ai_result.get("education", "Not clearly detected"),
            "experience": ai_result.get("experience", "Not clearly detected"),
            "summary": ai_result.get("summary", ""),
            "ai_powered": True,
        }

    # Fallback: AI unavailable for some reason — use the original method
    return {
        "resume_text": text,
        "skills": find_skills(text),
        "education": find_education(text),
        "experience": find_experience(text),
        "summary": "",
        "ai_powered": False,
    }