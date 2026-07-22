# database.py
# This file sets up the connection to our database.
# In production (Render), we use a persistent PostgreSQL database so
# data survives restarts and redeploys. Locally, we fall back to SQLite
# for simplicity — no separate database server needed for development.

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Render's DATABASE_URL sometimes starts with "postgres://" but
    # SQLAlchemy needs "postgresql://" — fix it if needed
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    # Local development fallback — a simple SQLite file
    DATABASE_URL = "sqlite:///./recruitment.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()