"""
Email Page Fetch Tool - Fetch paginated emails for summarization
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


# Tool for fetching paginated emails
@tool
def fetch_emails_page(user_email: str, page: int = 1) -> dict:
    """
    Tool to fetch paginated emails for a user.

    Args:
        user_email: The email address of the user
        page: Page number (default: 1, 30 emails per page)

    Returns:
        Dictionary containing paginated email threads
    """
    # Build the URL with query parameters
    api_url = BASE_API_URL + "/fetch-email-spidey"
    params = {
        "user_email": user_email,
        "page": page
    }

    logger.info(f"→ Calling {api_url} with params: {params}")

    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()

        # Log what we got back
        total_count = data.get('total_count', 0)
        has_more = data.get('has_more', False)
        threads_count = len(data.get('threads', []))

        logger.info(f"Retrieved {threads_count} threads, total: {total_count}, page: {page}, has_more: {has_more}")

        return data

    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching emails page: {str(e)}")
        return {"error": f"Failed to fetch emails: {str(e)}", "threads": [], "total_count": 0, "page": page, "has_more": False}


__all__ = ['fetch_emails_page']
