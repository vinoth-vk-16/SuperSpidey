"""
Helper utilities for Spidey Email Assistant
"""

import re
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def validate_email(email: str) -> bool:
    """
    Validate email address format.
    
    Args:
        email: Email address to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not email or not isinstance(email, str):
        return False
    
    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def format_email_response(response_data: Dict[str, Any]) -> str:
    """
    Format agent response data into a user-friendly message.
    
    Args:
        response_data: Dictionary containing response information
        
    Returns:
        Formatted response string
    """
    if not response_data:
        return "I'm not sure how to respond to that. Can you provide more details?"
    
    if response_data.get("success") is False:
        error = response_data.get("error", "Unknown error")
        return f"❌ Sorry, something went wrong: {error}"
    
    response = response_data.get("response", "")
    
    # If the response already has formatting, return as-is
    if "✅" in response or "❌" in response or "📝" in response:
        return response
    
    # Otherwise, add some friendly formatting
    return f"💬 {response}"


def sanitize_input(text: str, max_length: int = 5000) -> str:
    """
    Sanitize user input text.
    
    Args:
        text: Input text to sanitize
        max_length: Maximum allowed length
        
    Returns:
        Sanitized text
    """
    if not text or not isinstance(text, str):
        return ""
    
    # Remove excessive whitespace
    text = " ".join(text.split())
    
    # Truncate if too long
    if len(text) > max_length:
        text = text[:max_length] + "..."
        logger.warning(f"Input truncated to {max_length} characters")
    
    return text.strip()


def extract_email_addresses(text: str) -> list:
    """
    Extract email addresses from text.
    
    Args:
        text: Text to extract emails from
        
    Returns:
        List of email addresses found
    """
    if not text:
        return []
    
    # Email regex pattern
    pattern = r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
    emails = re.findall(pattern, text)
    
    return list(set(emails))  # Remove duplicates


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    Truncate text to a maximum length.
    
    Args:
        text: Text to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
        
    Returns:
        Truncated text
    """
    if not text or len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)].strip() + suffix


def parse_conversation_history(history: str) -> list:
    """
    Parse conversation history into a list of messages.
    
    Args:
        history: Raw conversation history string
        
    Returns:
        List of message dictionaries
    """
    if not history:
        return []
    
    messages = []
    
    # Simple parsing - split by common delimiters
    lines = history.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Try to identify user vs assistant messages
        if line.startswith("User:") or line.startswith("You:"):
            messages.append({
                "role": "user",
                "content": line.split(":", 1)[1].strip()
            })
        elif line.startswith("Spidey:") or line.startswith("Assistant:"):
            messages.append({
                "role": "assistant",
                "content": line.split(":", 1)[1].strip()
            })
        else:
            # Default to user message
            messages.append({
                "role": "user",
                "content": line
            })
    
    return messages


__all__ = [
    'validate_email',
    'format_email_response',
    'sanitize_input',
    'extract_email_addresses',
    'truncate_text',
    'parse_conversation_history'
]

