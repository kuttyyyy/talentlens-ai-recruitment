# auth_routes.py
# All authentication-related endpoints: register and login.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user.role not in ("candidate", "recruiter", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'candidate', 'recruiter', or 'admin'")

    # Module 2 -- a recruiter must provide their company name at registration.
    if user.role == "recruiter" and not (user.company_name and user.company_name.strip()):
        raise HTTPException(status_code=400, detail="Company name is required for recruiter accounts")

    new_user = models.User(
        full_name=user.full_name,
        email=user.email,
        password_hash=auth.hash_password(user.password),
        role=user.role,
    )

    # Module 2 -- link (or create) the company by name, case-insensitively,
    # so "Acme Inc" and "acme inc" resolve to the same company instead of
    # silently creating duplicates every time someone registers.
    if user.role == "recruiter":
        company_name = user.company_name.strip()
        company = (
            db.query(models.Company)
            .filter(models.Company.name.ilike(company_name))
            .first()
        )
        if not company:
            company = models.Company(name=company_name)
            db.add(company)
            db.commit()
            db.refresh(company)
        new_user.company_id = company.id

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if user.role == "candidate":
        profile = models.CandidateProfile(user_id=new_user.id)
        db.add(profile)
        db.commit()

    return new_user


@router.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()

    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_access_token({"sub": str(user.id), "role": user.role})

    return {"access_token": token, "token_type": "bearer", "user": user}
