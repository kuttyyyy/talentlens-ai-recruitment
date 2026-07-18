# email_utils.py
# Handles actually sending emails via Gmail's free SMTP service.
# This function only runs when a recruiter explicitly clicks "Send" —
# nothing here ever sends automatically.

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import EMAIL_ADDRESS, EMAIL_APP_PASSWORD


def send_email(to_address: str, subject: str, body: str) -> bool:
    """Sends a plain-text email via Gmail. Returns True on success,
    False on failure (so the caller can show an error instead of crashing)."""
    if not EMAIL_ADDRESS or not EMAIL_APP_PASSWORD:
        print("[EMAIL] No email credentials configured — cannot send.")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = EMAIL_ADDRESS
        msg["To"] = to_address
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
            server.send_message(msg)

        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send: {e}")
        return False