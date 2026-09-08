# admin_auth.py
# Real bearer-token authentication for the Admin Portal.
#
# IMPORTANT CONTEXT: the rest of this application (candidate/recruiter
# side) does NOT verify tokens anywhere -- every other endpoint trusts a
# plain user id passed by the client. This file deliberately does better
# for the Admin Portal specifically, since it's the highest-privilege
# surface on the platform: it decodes and verifies the JWT already issued
# by app/auth.py's create_access_token(), and re-checks the user's current
# role/status in the database on every request (so a token issued before
# a suspension stops working immediately, not just at expiry).
#
# This does NOT retroactively secure the rest of the app -- the
# candidate/recruiter/public API surface still relies on trusting a
# client-supplied id, which is a real limitation of the existing system
# this Admin Portal is built on top of.

from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import SECRET_KEY, ALGORITHM


def get_current_admin(authorization: str = Header(None), db: Session = Depends(get_db)) -> models.User:
    """Decodes and verifies the bearer token, then re-fetches the user
    from the database to confirm they still exist, are still an admin,
    and are still active. Raises 401 on any failure."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session -- please log in again")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token")

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=401, detail="Not an admin account")
    if user.account_status != "active":
        raise HTTPException(status_code=403, detail="This admin account is not active")

    return user


def require_super_admin(admin: models.User = Depends(get_current_admin)) -> models.User:
    """Layered on top of get_current_admin -- for endpoints only the
    platform Owner/Super Admin may use."""
    if admin.admin_level != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return admin


def log_action(db: Session, actor_id: int | None, action: str, target_type: str = None, target_id: int = None, details: str = None):
    """Writes one audit log entry. Never raises -- a logging failure
    should never block the action it's trying to record."""
    try:
        entry = models.AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
