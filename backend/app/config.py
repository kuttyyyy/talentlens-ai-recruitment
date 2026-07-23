# config.py
# Loads secret values (API keys, email credentials) from the .env file,
# so we never write secrets directly into our code.

from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")