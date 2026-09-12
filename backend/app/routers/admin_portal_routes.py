# admin_portal_routes.py
# The separate, secure Admin Portal: login, Super Admin platform-wide
# dashboard, and the Company/Recruiter permission (RBAC) structure.

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.admin_auth import get_current_admin, require_super_admin, log_action

router = APIRouter(prefix="/admin-portal", tags=["Admin Portal (Super Admin / RBAC)"])


def _user_out(u: models.User) -> dict:
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "admin_level": u.admin_level,
        "company_id": u.company_id,
        "company_name": u.company.name if u.company_id and u.company else None,
        "is_company_admin": u.is_company_admin,
        "can_view_company_wide": u.can_view_company_wide,
        "can_manage_recruiters": u.can_manage_recruiters,
        "account_status": u.account_status,
        "suspension_reason": u.suspension_reason,
        "suspended_at": u.suspended_at,
        "created_at": u.created_at,
    }


@router.post("/login")
def admin_login(credentials: schemas.AdminLoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()

    if not user or not auth.verify_password(credentials.password, user.password_hash) or user.role != "admin":
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    if user.account_status != "active":
        raise HTTPException(status_code=403, detail="This admin account is not active")

    token = auth.create_access_token({"sub": str(user.id), "role": user.role, "admin_level": user.admin_level})
    log_action(db, actor_id=user.id, action="admin_login", target_type="user", target_id=user.id)

    return {"access_token": token, "token_type": "bearer", "admin": _user_out(user)}


@router.get("/me")
def get_me(admin: models.User = Depends(get_current_admin)):
    return _user_out(admin)


@router.post("/change-password")
def change_password(
    body: schemas.ChangePasswordRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Lets a logged-in admin change their own password, by proving they
    know the current one first."""
    if not auth.verify_password(body.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    admin.password_hash = auth.hash_password(body.new_password)
    db.commit()
    log_action(db, actor_id=admin.id, action="admin_changed_own_password", target_type="user", target_id=admin.id)
    return {"message": "Password changed successfully"}


@router.get("/super/stats")
def get_platform_stats(admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    total_companies = db.query(models.Company).count()
    total_recruiters = db.query(models.User).filter(models.User.role == "recruiter").count()
    total_candidates = db.query(models.User).filter(models.User.role == "candidate").count()
    total_jobs = db.query(models.Job).count()
    total_job_views = db.query(models.Job).with_entities(models.Job.views_count).all()
    job_views_sum = sum(v[0] or 0 for v in total_job_views)
    total_applications = db.query(models.Application).count()
    total_assessments = db.query(models.Assessment).count()
    total_interviews = db.query(models.Application).filter(models.Application.status == "interview_scheduled").count()
    selected_candidates = db.query(models.Application).filter(models.Application.status == "hired").count()
    suspended_or_banned = db.query(models.User).filter(
        models.User.account_status.in_(["suspended", "disabled", "banned"])
    ).count()

    return {
        "total_companies": total_companies,
        "total_recruiters": total_recruiters,
        "total_candidates": total_candidates,
        "total_jobs": total_jobs,
        "job_views": job_views_sum,
        "total_applications": total_applications,
        "total_assessments": total_assessments,
        "total_interviews": total_interviews,
        "selected_candidates": selected_candidates,
        "suspended_or_banned_accounts": suspended_or_banned,
    }


@router.get("/companies")
def list_companies(admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    companies = db.query(models.Company).order_by(models.Company.created_at.desc()).all()
    result = []
    for c in companies:
        recruiter_count = db.query(models.User).filter(models.User.company_id == c.id).count()
        job_count = (
            db.query(models.Job)
            .join(models.User, models.Job.recruiter_id == models.User.id)
            .filter(models.User.company_id == c.id)
            .count()
        )
        result.append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "recruiter_count": recruiter_count,
            "job_count": job_count,
            "created_at": c.created_at,
        })
    return result


@router.post("/companies")
def create_company(company: schemas.CompanyCreate, admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    new_company = models.Company(name=company.name)
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    log_action(db, actor_id=admin.id, action="company_created", target_type="company", target_id=new_company.id, details=company.name)
    return {"id": new_company.id, "name": new_company.name, "status": new_company.status}


@router.put("/companies/{company_id}/status")
def set_company_status(company_id: int, status: str, admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    if status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="status must be 'active' or 'suspended'")
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.status = status
    db.commit()
    log_action(db, actor_id=admin.id, action="company_status_changed", target_type="company", target_id=company_id, details=status)
    return {"id": company.id, "status": company.status}


@router.get("/recruiters")
def list_recruiters(admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    recruiters = db.query(models.User).filter(models.User.role == "recruiter").order_by(models.User.created_at.desc()).all()
    return [_user_out(r) for r in recruiters]


@router.put("/recruiters/{user_id}/permissions")
def update_recruiter_permissions(
    user_id: int,
    update: schemas.RecruiterPermissionsUpdate,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.role == "recruiter").first()
    if not user:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    if update.company_id is not None:
        company = db.query(models.Company).filter(models.Company.id == update.company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

    user.company_id = update.company_id
    user.is_company_admin = update.is_company_admin
    user.can_view_company_wide = update.can_view_company_wide
    user.can_manage_recruiters = update.can_manage_recruiters
    db.commit()

    log_action(
        db, actor_id=admin.id, action="permission_changed", target_type="user", target_id=user_id,
        details=f"company_id={update.company_id}, is_company_admin={update.is_company_admin}, "
                f"can_view_company_wide={update.can_view_company_wide}, can_manage_recruiters={update.can_manage_recruiters}",
    )
    return _user_out(user)


@router.put("/users/{user_id}/status")
def set_user_status(user_id: int, update: schemas.UserStatusUpdate, admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    if update.account_status not in ("active", "warned", "suspended", "disabled", "banned"):
        raise HTTPException(status_code=400, detail="Invalid account_status")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own account status")

    user.account_status = update.account_status
    user.suspension_reason = update.reason
    user.suspended_at = datetime.now(timezone.utc) if update.account_status != "active" else None
    user.suspended_by_id = admin.id if update.account_status != "active" else None
    db.commit()

    log_action(
        db, actor_id=admin.id, action="account_status_changed", target_type="user", target_id=user_id,
        details=f"status={update.account_status}, reason={update.reason}",
    )
    return _user_out(user)


@router.get("/audit-log")
def get_audit_log(admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db), limit: int = 200):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(limit).all()
    result = []
    for entry in logs:
        actor = db.query(models.User).filter(models.User.id == entry.actor_id).first() if entry.actor_id else None
        result.append({
            "id": entry.id,
            "actor_id": entry.actor_id,
            "actor_name": actor.full_name if actor else "System",
            "action": entry.action,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
            "details": entry.details,
            "created_at": entry.created_at,
        })
    return result


# ---------------------------------------------------------------------------
# Module 1 fix -- Recruiter Feedback, visible to the Super Admin
# ---------------------------------------------------------------------------

@router.get("/feedback")
def list_recruiter_feedback(admin: models.User = Depends(require_super_admin), db: Session = Depends(get_db)):
    """Every recruiter feedback submission, with who sent it. This is the
    full detail view -- the old public-site AdminDashboard.jsx only ever
    showed aggregate averages, never the individual submissions or their
    free-text comments. That page is untouched; this is new and additive."""
    submissions = (
        db.query(models.RecruiterFeedback)
        .order_by(models.RecruiterFeedback.created_at.desc())
        .all()
    )
    result = []
    for f in submissions:
        recruiter = db.query(models.User).filter(models.User.id == f.recruiter_id).first()
        result.append({
            "id": f.id,
            "recruiter_id": f.recruiter_id,
            "recruiter_name": recruiter.full_name if recruiter else "Unknown",
            "recruiter_email": recruiter.email if recruiter else None,
            "company_name": recruiter.company.name if recruiter and recruiter.company_id and recruiter.company else f.company_name,
            "role_title": f.role_title,
            "overall_usefulness": f.overall_usefulness,
            "ease_of_use": f.ease_of_use,
            "jd_analysis_useful": f.jd_analysis_useful,
            "test_generation_useful": f.test_generation_useful,
            "cv_matching_useful": f.cv_matching_useful,
            "practical_assessment_useful": f.practical_assessment_useful,
            "candidate_report_useful": f.candidate_report_useful,
            "integrity_info_useful": f.integrity_info_useful,
            "would_use_again": f.would_use_again,
            "improvement_suggestions": f.improvement_suggestions,
            "created_at": f.created_at,
        })
    return result
