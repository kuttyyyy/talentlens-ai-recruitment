# main.py
# This is the entry point of our backend server.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.database import engine, Base
from app import models
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


@app.get("/")
def read_root():
    return {"message": "AI Recruitment System backend is running!"}
