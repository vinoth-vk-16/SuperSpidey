"""
Email Date Query Tool - Simple tool that lets LLM choose dates
"""

import logging
import requests
from langchain.tools import tool
import os
from datetime import datetime
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

# Base API URL for email management
BASE_API_URL = os.getenv(
    "EMAIL_MANAGEMENT_BASE_URL",
    "https://superspidey-email-management.onrender.com"
)


# Tool for fetching emails by date - LLM chooses the dates
@tool
def fetch_email_by_date(user_email: str, date: str, end_date: Optional[str] = None) -> dict:
    """
    Tool to fetch emails by date. The LLM gets the current date and chooses what dates to use.

    When this tool is called, it always provides the current date to the LLM so it can
    calculate proper start_date and end_date values.

    Args:
        user_email: The email address of the user
        date: Start date in ISO format (YYYY-MM-DD) chosen by LLM
        end_date: Optional end date in ISO format (YYYY-MM-DD) chosen by LLM

    Returns:
        Dictionary containing email threads for the specified date range
    """
    # Build the URL with query parameters - LLM has already chosen the dates
    api_url = BASE_API_URL + "/fetch-by-date-spidey"
    params = {
        "user_email": user_email,
        "date": date  # Start date chosen by LLM
    }

    # Add end_date if provided by LLM
    if end_date:
        params["end_date"] = end_date

    logger.info(f"→ Calling {api_url} with params: {params}")

    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()

        # Log what we got back
        thread_count = len(data.get('threads', []))
        logger.info(f"Retrieved {thread_count} threads for date range: {date}" +
                   (f" to {end_date}" if end_date else ""))

        # Add current date context for LLM to use in future calculations
        current_date = datetime.now().date().isoformat()
        data["_current_date"] = current_date

        return data

    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching emails by date: {str(e)}")
        return {
            "error": f"Failed to fetch emails by date: {str(e)}",
            "threads": [],
            "total_count": 0,
            "_current_date": datetime.now().date().isoformat()
        }


# Function to get current date for LLM context
def get_current_date_for_llm() -> str:
    """
    Returns current date information that should be provided to LLM
    when it needs to make date calculations for this tool.
    """
    today = datetime.now().date()
    return f"Current date: {today.isoformat()} ({today.strftime('%A, %B %d, %Y')})"


__all__ = ['fetch_email_by_date', 'get_current_date_for_llm']
