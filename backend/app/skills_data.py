# skills_data.py
# A curated list of skills our AI looks for inside resumes and job descriptions.
# This is the simplest, most reliable way to detect skills for a college
# project — no heavy AI model needed, just careful keyword matching.

KNOWN_SKILLS = [
    # Programming languages
    "python", "java", "javascript", "typescript", "c++", "c#", "php", "ruby", "go", "kotlin", "swift", "r",

    # Web development
    "react", "angular", "vue", "html", "css", "tailwind", "bootstrap", "next.js", "node.js", "express",
    "django", "flask", "fastapi", "rest api", "graphql",

    # Databases
    "sql", "mysql", "postgresql", "mongodb", "sqlite", "redis", "oracle", "firebase",

    # Data & AI
    "machine learning", "deep learning", "data analysis", "pandas", "numpy", "scikit-learn",
    "tensorflow", "pytorch", "nlp", "computer vision", "data visualization", "power bi", "tableau",

    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "jenkins", "linux", "git", "github",

    # Mobile
    "android", "ios", "flutter", "react native",

    # Design
    "figma", "ui/ux", "adobe xd", "photoshop",

    # Soft / business skills
    "communication", "teamwork", "leadership", "problem solving", "project management",
    "agile", "scrum", "time management", "critical thinking",

    # Office tools
    "excel", "microsoft office", "powerpoint", "word",
]