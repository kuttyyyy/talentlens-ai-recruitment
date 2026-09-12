# main.py
# This is the entry point of our backend server.

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.database import engine, Base, SessionLocal
from app import models, auth
from app.routers import (
    auth_routes,
    candidate_routes,
    job_routes,
    application_routes,
    interview_routes,
    dashboard_routes,
    admin_routes,
    copilot_routes,
    assessment_routes,
    test_attempt_routes,
    evaluation_routes,
    verification_routes,
    feedback_routes,
    admin_portal_routes,
)

app = FastAPI(title="AI Recruitment System API")

Base.metadata.create_all(bind=engine)


# ==========================================================
# AUTO-MIGRATION: automatically adds any missing columns
# Runs on every startup. Safe to leave in permanently.
# This means future modules that add new columns to existing
# tables will no longer crash production with
# "column does not exist" errors -- it self-heals on deploy.
# ==========================================================
def auto_migrate(engine, Base):
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                # Brand-new table -- create_all() above already handles this
                continue

            existing_columns = {
                col["name"] for col in inspector.get_columns(table_name)
            }

            for column in table.columns:
                if column.name in existing_columns:
                    continue

                col_type = column.type.compile(dialect=engine.dialect)
                ddl = f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {col_type}'

                try:
                    conn.execute(text(ddl))
                    conn.commit()
                    print(f"[auto_migrate] Added missing column: {table_name}.{column.name}")
                except Exception as e:
                    print(f"[auto_migrate] Skipped {table_name}.{column.name}: {e}")


auto_migrate(engine, Base)


# ==========================================================
# AUTO-INDEXING: creates any missing database indexes on
# startup, same self-healing pattern as auto_migrate() above.
# SQLAlchemy's create_all() only adds indexes to BRAND NEW
# tables -- it never retroactively indexes a column on a table
# that already exists, which is exactly the situation on an
# existing deployed database. This fixes that automatically,
# without requiring a manual migration step.
# ==========================================================
def auto_index(engine, Base):
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            existing_index_columns = set()
            for idx in inspector.get_indexes(table_name):
                existing_index_columns.update(idx["column_names"])
            # Also treat the primary key as "already indexed" -- it always is.
            pk_columns = set(inspector.get_pk_constraint(table_name).get("constrained_columns", []))
            existing_index_columns |= pk_columns

            for column in table.columns:
                if not column.index:
                    continue
                if column.name in existing_index_columns:
                    continue

                index_name = f"ix_{table_name}_{column.name}"
                ddl = f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table_name}" ("{column.name}")'

                try:
                    conn.execute(text(ddl))
                    conn.commit()
                    print(f"[auto_index] Added missing index: {table_name}.{column.name}")
                except Exception as e:
                    print(f"[auto_index] Skipped {table_name}.{column.name}: {e}")


auto_index(engine, Base)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all our routers with the main app
app.include_router(auth_routes.router)
app.include_router(candidate_routes.router)
app.include_router(job_routes.router)
app.include_router(application_routes.router)
app.include_router(interview_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(admin_routes.router)
app.include_router(copilot_routes.router)
app.include_router(assessment_routes.router)
app.include_router(test_attempt_routes.router)
app.include_router(evaluation_routes.router)
app.include_router(verification_routes.router)
app.include_router(feedback_routes.router)
app.include_router(admin_portal_routes.router)


@app.get("/")
def read_root():
    return {"message": "AI Recruitment System backend is running!"}


# ==========================================================
# TEMPORARY -- DATABASE RESET (for hosts without Shell access,
# e.g. Render's free plan). Protected by a secret so a random
# visitor can't trigger it -- set RESET_SECRET as an environment
# variable on your host, then visit this URL once with that
# secret to wipe and recreate the database plus a fresh admin.
#
# REMOVE THIS ENDPOINT (and the RESET_SECRET env var) once you've
# used it -- a destructive, always-available reset route is not
# something to leave running in production long-term.
# ==========================================================
@app.get("/system/reset-database")
def reset_database_and_seed_admin(
    secret: str,
    admin_email: str = "admin@talentlens.com",
    admin_password: str = "changeme123",
    admin_full_name: str = "Super Admin",
):
    expected_secret = os.getenv("RESET_SECRET")
    if not expected_secret or secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        admin = models.User(
            full_name=admin_full_name,
            email=admin_email,
            password_hash=auth.hash_password(admin_password),
            role="admin",
            admin_level="super_admin",
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()

    return {
        "message": "Database wiped and recreated. Admin account created.",
        "admin_email": admin_email,
        "admin_password": admin_password,
    }


@app.get("/system/set-password")
def set_user_password(secret: str, email: str, new_password: str):
    """TEMPORARY, non-destructive helper: updates ONE user's password by
    email, without touching anything else in the database. Protected by
    the same RESET_SECRET. Remove this endpoint once the admin portal has
    its own proper change-password feature."""
    expected_secret = os.getenv("RESET_SECRET")
    if not expected_secret or secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"No user found with email {email}")
        user.password_hash = auth.hash_password(new_password)
        db.commit()
        return {"message": f"Password updated for {email}"}
    finally:
        db.close()
