"""
Email Draft Tool - Exact implementation from test.py
"""

import logging
import requests
from langchain.tools import tool
import os
# Configure logging
logger = logging.getLogger(__name__)

# Base API URL for email management
BASE_API_URL = os.getenv(
    "EMAIL_MANAGEMENT_BASE_URL",
    "https://superspidey-email-management.onrender.com"
)

# API URL for creating drafts
API_URL = BASE_API_URL + "/create-multi-draft"


# Tool definition - exact from test.py
@tool
def create_email_drafts(user_email: str, drafts: list) -> dict:
    """
    Tool to create multiple email drafts at once.

    Each draft must include:
        user_email, to_email, subject, body
    """
    # Enforce the correct structure per item
    for draft in drafts:
        draft["user_email"] = user_email

    payload = {
        "user_email": user_email,
        "drafts": drafts
    }
    headers = {
        "Content-Type": "application/json"
    }

    logger.info(f"→ Calling {API_URL} with payload: {payload}")
    response = requests.post(API_URL, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()


__all__ = ['create_email_drafts']
