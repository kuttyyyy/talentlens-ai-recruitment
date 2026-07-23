# email_utils.py
# Handles actually sending emails via Resend's HTTP API.
# This function only runs when a recruiter explicitly clicks "Send" —
# nothing here ever sends automatically.
# We use Resend instead of raw SMTP because free hosting platforms like
# Render often block outbound SMTP ports (587/465) as an anti-abuse
# measure — Resend sends over a normal HTTPS API call instead, which
# always works regardless of hosting provider.

import resend
from app.config import RESEND_API_KEY

resend.api_key = RESEND_API_KEY

# Resend's shared test sender — works instantly with no domain setup,
# but can only send to the email address you signed up to Resend with.
FROM_ADDRESS = "TalentLens <onboarding@resend.dev>"


def send_email(to_address: str, subject: str, body: str) -> bool:
    """Sends a plain-text email via Resend. Returns True on success,
    False on failure (so the caller can show an error instead of crashing)."""
    if not RESEND_API_KEY:
        print("[EMAIL] No Resend API key configured — cannot send.")
        return False

    try:
        # Convert plain text to simple HTML so line breaks render correctly
        html_body = body.replace("\n", "<br>")

        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_address],
            "subject": subject,
            "text": body,
            "html": html_body,
        })
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send: {e}")
        return False