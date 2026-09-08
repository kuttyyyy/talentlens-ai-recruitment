# delete_assessment_by_title.py
# One-off cleanup: deletes an assessment (and its 3 tests) by matching its
# title, for assessments that aren't tied to a real job (or whose job is
# already gone) so there's nothing in "Applicants" to delete it from.

from app.database import SessionLocal
from app import models

db = SessionLocal()

search_term = "start up training"

matches = (
    db.query(models.Assessment)
    .filter(models.Assessment.title.ilike(f"%{search_term}%"))
    .all()
)

if not matches:
    print(f"No assessments found matching '{search_term}'.")
else:
    for a in matches:
        print(f"Found: Assessment {a.id} — '{a.title}' (job_id={a.job_id}, status={a.status})")

    confirm = input(f"\nDelete {len(matches)} assessment(s) listed above? [y/N] ")
    if confirm.lower() == "y":
        for a in matches:
            db.delete(a)  # cascade="all, delete-orphan" removes its 3 tests too
        db.commit()
        print("Done.")
    else:
        print("Cancelled, nothing deleted.")

db.close()