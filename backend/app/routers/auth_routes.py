# auth_routes.py
# All authentication-related endpoints: register and login.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

# A "router" groups related endpoints together.
# prefix="/auth" means every URL here starts with /auth
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if this email is already registered
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user.role not in ("candidate", "recruiter", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'candidate', 'recruiter', or 'admin'")

    # Create the new user with a HASHED password (never store plain text!)
    new_user = models.User(
        full_name=user.full_name,
        email=user.email,
        password_hash=auth.hash_password(user.password),
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If they're a candidate, automatically create their empty profile too
    if user.role == "candidate":
        profile = models.CandidateProfile(user_id=new_user.id)
        db.add(profile)
        db.commit()

    return new_user


@router.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()

    # Check both: does this user exist, AND does the password match?
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create their login token, embedding their id and role inside it
    token = auth.create_access_token({"sub": str(user.id), "role": user.role})

    return {"access_token": token, "token_type": "bearer", "user": user}