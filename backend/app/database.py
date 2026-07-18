# database.py
# This file sets up the connection to our database.
# We're using SQLite — a database that's just a single file, no separate
# server needed. Perfect for a college project.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# This tells SQLAlchemy: "create a file called recruitment.db in this folder,
# and treat it as our database"
DATABASE_URL = "sqlite:///./recruitment.db"

# The "engine" is the actual connection to that database file
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # needed for SQLite + FastAPI
)

# A "session" is like a temporary workspace for talking to the database
# (adding, reading, updating, deleting data)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# "Base" is what all our table classes will inherit from
Base = declarative_base()

# This function gives each API request its own database session,
# and automatically closes it when done. FastAPI will call this for us.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()