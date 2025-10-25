"""
Email Thread Query Tool - Query and analyze specific email conversations
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


# Tool for querying email threads/conversations
@tool
def query_email_threads(user_email: str, thread_ids: list) -> dict:
    """
    Tool to query and retrieve specific email conversations (threads).

    Args:
        user_email: The email address of the user
        thread_ids: List of thread IDs to fetch

    Returns:
        Dictionary containing thread data with messages
    """
    # Convert thread_ids list to comma-separated string
    thread_ids_str = ",".join(thread_ids)

    # Build the URL with query parameters
    api_url = BASE_API_URL + "/fetch-specific-spidey"
    params = {
        "user_email": user_email,
        "thread_ids": thread_ids_str
    }

    logger.info(f"→ Calling {api_url} with params: {params}")

    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()

        # Log what we got back
        logger.info(f"Retrieved {len(data.get('threads', []))} threads")

        return data

    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching email threads: {str(e)}")
        return {"error": f"Failed to fetch email threads: {str(e)}", "threads": [], "total_count": 0}


__all__ = ['query_email_threads']
