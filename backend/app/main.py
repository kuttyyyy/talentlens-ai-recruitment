# main.py
# This is the entry point of our backend server.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
)

app = FastAPI(title="AI Recruitment System API")

Base.metadata.create_all(bind=engine)

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


@app.get("/")
def read_root():
    return {"message": "AI Recruitment System backend is running!"}