# create_first_admin.py
# One-time setup: creates the first Super Admin account, since there's no
# public registration endpoint for admin accounts (by design). Run this
# once, then delete the file or just leave it -- it's safe to leave since
# it only ever creates an account if one with that email doesn't exist yet.

from app.database import SessionLocal
from app import models, auth

db = SessionLocal()

email = input("Admin email: ").strip()
password = input("Admin password: ").strip()
full_name = input("Admin full name: ").strip() or "Super Admin"

existing = db.query(models.User).filter(models.User.email == email).first()
if existing:
    print(f"A user with email '{email}' already exists (role={existing.role}). Nothing created.")
else:
    admin = models.User(
        full_name=full_name,
        email=email,
        password_hash=auth.hash_password(password),
        role="admin",
        admin_level="super_admin",
        account_status="active",
    )
    db.add(admin)
    db.commit()
    print(f"Super Admin account created: {email}")

db.close()