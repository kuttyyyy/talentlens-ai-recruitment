# evaluation_agent.py
# Module 7 -- AI Evaluation & Scoring.
#
# MCQ/numerical items are scored deterministically (exact match) --
# reliable, zero-cost, and not worth an AI call. Free-text items (technical,
# situational, and the whole practical task) go through the AI grading
# functions in ai_engine.py. Every result carries evidence, never a bare
# number -- that's a hard requirement from the spec, not a nice-to-have.

import json
from app.ai_engine import evaluate_open_ended_items, evaluate_practical_submission


def _normalize(value) -> str:
    return str(value or "").strip().lower()


def evaluate_test1_or_2(test_type: str, content: dict, answers: dict) -> dict:
    """Scores a submitted Test 1 (knowledge_reasoning) or Test 2
    (situational_judgment) attempt. Returns a score out of 100 plus a
    per-item evidence breakdown and a narrative summary."""
    items = content.get("questions") or content.get("scenarios") or []
    breakdown = []
    total_points_possible = 0
    total_points_earned = 0.0
    items_needing_ai = []

    for i, item in enumerate(items):
        points = item.get("points", 0) or 0
        total_points_possible += points
        candidate_answer = answers.get(str(i), "")
        question_text = item.get("question") or item.get("scenario") or ""

        if "options" in item:
            correct = item.get("correct_answer") or item.get("best_option")
            is_correct = _normalize(candidate_answer) == _normalize(correct)
            points_earned = points if is_correct else 0
            total_points_earned += points_earned
            breakdown.append({
                "question": question_text,
                "candidate_answer": candidate_answer,
                "expected_answer": correct,
                "is_correct": is_correct,
                "points_earned": points_earned,
                "points_possible": points,
                "evidence": "Exact match" if is_correct else "Did not match the expected answer",
            })
        elif item.get("type") == "numerical":
            correct = item.get("correct_answer")
            is_correct = _normalize(candidate_answer) == _normalize(correct)
            points_earned = points if is_correct else 0
            total_points_earned += points_earned
            breakdown.append({
                "question": question_text,
                "candidate_answer": candidate_answer,
                "expected_answer": correct,
                "is_correct": is_correct,
                "points_earned": points_earned,
                "points_possible": points,
                "evidence": "Matched the expected value" if is_correct else "Did not match the expected value",
            })
        else:
            # Free-text item (technical/situational) -- needs AI grading
            items_needing_ai.append({
                "index": i,
                "question": question_text,
                "candidate_answer": candidate_answer,
                "expected_answer_points": item.get("expected_answer_points", []),
                "points_possible": points,
            })
            breakdown.append({
                "question": question_text,
                "candidate_answer": candidate_answer,
                "expected_answer": None,
                "is_correct": None,  # filled in below once AI grades it
                "points_earned": None,
                "points_possible": points,
                "evidence": None,
            })

    strengths, weaknesses, skills_demonstrated = [], [], []

    if items_needing_ai:
        deterministic_summary = f"{round(total_points_earned)} / {sum(b['points_possible'] for b in breakdown if b['is_correct'] is not None)} points on the auto-graded items so far."
        ai_result = evaluate_open_ended_items(test_type, items_needing_ai, deterministic_summary)
        if ai_result:
            graded_by_index = {g["index"]: g for g in ai_result.get("graded_items", [])}
            for b_index, item in enumerate(items_needing_ai):
                grade = graded_by_index.get(item["index"])
                target = breakdown[item["index"]]
                if grade:
                    fraction = max(0.0, min(1.0, float(grade.get("score_fraction", 0))))
                    earned = round(fraction * item["points_possible"], 1)
                    total_points_earned += earned
                    target["is_correct"] = fraction >= 0.5
                    target["points_earned"] = earned
                    target["evidence"] = grade.get("evidence", "")
                else:
                    target["is_correct"] = False
                    target["points_earned"] = 0
                    target["evidence"] = "Could not be graded automatically -- needs manual review."
            strengths = ai_result.get("strengths", [])
            weaknesses = ai_result.get("weaknesses", [])
            skills_demonstrated = ai_result.get("skills_demonstrated", [])
        else:
            # AI unavailable -- leave these items flagged for manual review rather than guessing
            for item in items_needing_ai:
                target = breakdown[item["index"]]
                target["is_correct"] = None
                target["points_earned"] = 0
                target["evidence"] = "AI grading unavailable -- needs manual review."
    else:
        # Fully objective test -- a simple, honest deterministic narrative
        correct_count = sum(1 for b in breakdown if b["is_correct"])
        strengths = [f"Answered {correct_count} of {len(breakdown)} items correctly"] if correct_count else []
        weaknesses = [f"Missed {len(breakdown) - correct_count} of {len(breakdown)} items"] if correct_count < len(breakdown) else []

    score = round((total_points_earned / total_points_possible) * 100) if total_points_possible else 0

    return {
        "score": max(0, min(100, score)),
        "breakdown": breakdown,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "skills_demonstrated": skills_demonstrated,
        "ai_collaboration_assessment": None,
    }


def evaluate_test3(content: dict, answers: dict) -> dict:
    """Scores a submitted Test 3 (practical_simulation) attempt entirely
    via AI, since there's no objective answer key for a hands-on task."""
    criteria = content.get("evaluation_criteria", [])
    ai_result = evaluate_practical_submission(
        task_description=content.get("task_description", ""),
        deliverable_instructions=content.get("deliverable_instructions", ""),
        evaluation_criteria=criteria,
        submission=answers or {},
    )

    if not ai_result:
        return {
            "score": 0,
            "breakdown": [],
            "strengths": [],
            "weaknesses": [],
            "skills_demonstrated": [],
            "ai_collaboration_assessment": None,
            "needs_manual_review": True,
        }

    criteria_scores = ai_result.get("criteria_scores", [])
    weighted_total = sum(
        (c.get("score", 0) or 0) * (c.get("weight", 0) or 0) / 100 for c in criteria_scores
    )

    return {
        "score": round(max(0, min(100, weighted_total))),
        "breakdown": criteria_scores,
        "strengths": ai_result.get("strengths", []),
        "weaknesses": ai_result.get("weaknesses", []),
        "skills_demonstrated": ai_result.get("skills_demonstrated", []),
        "ai_collaboration_assessment": ai_result.get("ai_collaboration_assessment"),
    }
