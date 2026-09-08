# cleanup_orphaned_assessments.py
# Run once: python cleanup_orphaned_assessments.py
# Finds and removes Assessment rows that are either (a) orphaned — their
# job_id doesn't match any existing Job — or (b) duplicates, where more
# than one approved assessment shares the same job_id (keeps the newest).

from app.database import SessionLocal
from app import models

db = SessionLocal()

all_job_ids = {j.id for j in db.query(models.Job).all()}
assessments = db.query(models.Assessment).order_by(models.Assessment.created_at.desc()).all()

seen_job_ids = set()
to_delete = []

for a in assessments:
    if a.job_id is not None and a.job_id not in all_job_ids:
        print(f"Orphaned: Assessment {a.id} ('{a.title}') points to deleted job_id={a.job_id}")
        to_delete.append(a)
    elif a.job_id is not None and a.job_id in seen_job_ids:
        print(f"Duplicate: Assessment {a.id} ('{a.title}') shares job_id={a.job_id} with a newer assessment")
        to_delete.append(a)
    elif a.job_id is not None:
        seen_job_ids.add(a.job_id)

if not to_delete:
    print("No orphaned or duplicate assessments found.")
else:
    confirm = input(f"\nDelete {len(to_delete)} assessment(s) listed above? [y/N] ")
    if confirm.lower() == "y":
        for a in to_delete:
            db.delete(a)
        db.commit()
        print("Done.")
    else:
        print("Cancelled, nothing deleted.")

db.close()