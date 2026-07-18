# auth.py
# Helper functions for password security and login tokens.

from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

# In a real company project, this secret would be hidden in an environment
# variable, never written in code. For a college project, this is fine.
SECRET_KEY = "college-project-secret-key-change-this-later"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # token stays valid for 1 day

# This sets up bcrypt as our password scrambling method
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Scrambles a plain password into something safe to store."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Checks a typed-in password against the stored scrambled version."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """Creates a login token containing the user's id and role,
    which expires automatically after ACCESS_TOKEN_EXPIRE_MINUTES."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)