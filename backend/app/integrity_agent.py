# integrity_agent.py
# Module 6 -- Assessment Integrity Agent.
#
# Deliberately rule-based, not an LLM call: the inputs here are just a
# handful of counters and timestamps, and deterministic thresholds are
# more reliable and auditable than asking a model to "guess" from them.
#
# Hard rule throughout: this NEVER concludes a candidate cheated. It only
# ever produces "potential concern, recruiter review required" language,
# and every flag carries its own severity/confidence so the recruiter can
# judge how seriously to weigh it themselves.

import json

DISCLAIMER = (
    "This reflects basic browser activity signals only (tab switches, "
    "focus loss, timing) and cannot detect every form of academic "
    "dishonesty, nor prove any occurred. Treat it as one input among "
    "several -- not as proof of misconduct."
)


def _severity(count: int, medium_at: int, high_at: int) -> str:
    if count >= high_at:
        return "high"
    if count >= medium_at:
        return "medium"
    return "low"


def generate_integrity_report(attempt) -> dict:
    """Builds a recruiter-facing integrity report for one test attempt.
    Returns {flags: [...], disclaimer: str} -- flags is [] when nothing
    stood out, which is itself a normal, common result."""
    try:
        events = json.loads(attempt.integrity_events_json) if attempt.integrity_events_json else {}
    except (json.JSONDecodeError, TypeError):
        events = {}

    tab_switches = events.get("tab_switches", 0) or 0
    blur_count = events.get("blur_count", 0) or 0
    reference_time = attempt.submitted_at or attempt.started_at

    flags = []

    if tab_switches > 0:
        flags.append({
            "event": "Left the test page",
            "timestamp": reference_time,
            "evidence": f"The candidate navigated away from or hid the test page {tab_switches} time(s) during the attempt.",
            "severity": _severity(tab_switches, medium_at=2, high_at=5),
            "confidence": "medium",
        })

    if blur_count > 2:
        flags.append({
            "event": "Repeated window focus loss",
            "timestamp": reference_time,
            "evidence": f"The browser window lost focus {blur_count} time(s) during the attempt.",
            "severity": _severity(blur_count, medium_at=4, high_at=8),
            "confidence": "low",
        })

    if attempt.post_submission_attempts and attempt.post_submission_attempts > 0:
        flags.append({
            "event": "Attempted to modify a submitted assessment",
            "timestamp": attempt.submitted_at,
            "evidence": f"An edit was attempted {attempt.post_submission_attempts} time(s) after the test had already been submitted (blocked by the system).",
            "severity": "high",
            "confidence": "high",
        })

    if attempt.started_at and attempt.submitted_at and attempt.assessment_test:
        elapsed_minutes = (attempt.submitted_at - attempt.started_at).total_seconds() / 60
        allotted = attempt.assessment_test.duration_minutes or 0

        if allotted > 0 and 0 < elapsed_minutes < 0.2 * allotted:
            flags.append({
                "event": "Unusually fast completion",
                "timestamp": attempt.submitted_at,
                "evidence": f"Submitted in about {round(elapsed_minutes, 1)} minutes, out of {allotted} allotted.",
                "severity": "medium",
                "confidence": "low",
            })

        if allotted > 0 and elapsed_minutes > allotted + 2:
            flags.append({
                "event": "Submitted after the allotted time",
                "timestamp": attempt.submitted_at,
                "evidence": f"Submitted about {round(elapsed_minutes - allotted, 1)} minutes after the time limit.",
                "severity": "medium",
                "confidence": "medium",
            })

    return {"flags": flags, "disclaimer": DISCLAIMER}
