import json
import re
from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.prompts import (
    LESSON_SYSTEM_PROMPT,
    LESSON_USER_PROMPT,
    REVIEW_SYSTEM_PROMPT,
    REVIEW_USER_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    SUMMARY_USER_PROMPT,
)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = text.strip()
    # Remove markdown code blocks if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from response: {text[:200]}")


def generate_lesson(child_name: str, child_age: int, content: str) -> dict:
    """Generate an interactive micro-lesson using GPT-4o."""
    client = OpenAI(api_key=OPENAI_API_KEY)

    user_prompt = LESSON_USER_PROMPT.format(
        child_name=child_name,
        child_age=child_age,
        content=content[:5000],
    )

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": LESSON_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=3000,
        response_format={"type": "json_object"},
    )

    result = _parse_json_response(response.choices[0].message.content or "{}")

    # Validate structure
    if "title" not in result or "blocks" not in result or "quiz" not in result:
        raise ValueError("Invalid lesson structure from AI")

    return result


def generate_review(
    child_name: str,
    child_age: int,
    wrong_questions: str,
    original_content: str,
) -> dict:
    """Generate adaptive review for wrong answers."""
    client = OpenAI(api_key=OPENAI_API_KEY)

    user_prompt = REVIEW_USER_PROMPT.format(
        child_name=child_name,
        child_age=child_age,
        wrong_questions=wrong_questions,
        original_content=original_content[:3000],
    )

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )

    return _parse_json_response(response.choices[0].message.content or "{}")


def generate_parent_summary(
    child_name: str,
    child_age: int,
    topic: str,
    duration_min: int,
    total_questions: int,
    correct_answers: int,
    wrong_details: str,
) -> dict:
    """Generate a session summary for parents."""
    client = OpenAI(api_key=OPENAI_API_KEY)

    wrong_answers = total_questions - correct_answers

    user_prompt = SUMMARY_USER_PROMPT.format(
        child_name=child_name,
        child_age=child_age,
        topic=topic,
        duration=duration_min,
        total_questions=total_questions,
        correct_answers=correct_answers,
        wrong_answers=wrong_answers,
        wrong_details=wrong_details if wrong_details else "Nenhum erro",
    )

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.5,
        max_tokens=1000,
        response_format={"type": "json_object"},
    )

    return _parse_json_response(response.choices[0].message.content or "{}")
