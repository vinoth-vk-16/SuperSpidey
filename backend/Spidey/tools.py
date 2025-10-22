#!/usr/bin/env python3
"""
Spidey Tools - Email automation tools for the Spidey MCP Server
"""

import logging
import os
import requests
from typing import Any, Dict, List
from pydantic import BaseModel

# Configure logging
logger = logging.getLogger(__name__)

# Configuration - Make it configurable via environment variable
EMAIL_MANAGEMENT_BASE_URL = os.getenv(
    "EMAIL_MANAGEMENT_BASE_URL"
)

class DraftItem(BaseModel):
    """Model for individual draft items"""
    user_email: str
    to_email: str
    subject: str
    body: str

class CreateMultiDraftRequest(BaseModel):
    """Request model for creating multiple drafts"""
    user_email: str
    drafts: List[DraftItem]

def create_email_drafts(user_email: str, drafts_data: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Create multiple email drafts using the email management service.
    
    This tool connects to the email management API to create multiple email drafts
    at once. It's perfect for bulk email creation, campaign preparation, and 
    automated outreach sequences.
    
    Args:
        user_email (str): The user's email address who owns the drafts
        drafts_data (List[Dict[str, str]]): List of draft dictionaries, each containing:
            - to_email (str): Recipient's email address
            - subject (str): Email subject line
            - body (str): Email content/body
            
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the operation succeeded
            - drafts_created (int): Number of drafts successfully created
            - draft_ids (List[str]): List of unique draft IDs
            - message (str): Status message
            
    Example:
        drafts = [
            {
                "to_email": "client@example.com",
                "subject": "Partnership Proposal",
                "body": "Dear Client, I'd like to discuss..."
            },
            {
                "to_email": "lead@company.com", 
                "subject": "Web Development Services",
                "body": "Hello, I specialize in modern web development..."
            }
        ]
        result = create_email_drafts("user@example.com", drafts)
    """
    try:
        logger.info(f"Creating {len(drafts_data)} email drafts for user: {user_email}")
        
        # Validate input data
        if not user_email or not isinstance(user_email, str):
            return {
                "success": False,
                "message": "Invalid user_email provided"
            }
            
        if not drafts_data or not isinstance(drafts_data, list):
            return {
                "success": False,
                "message": "Invalid drafts_data provided - must be a list"
            }
        
        # Prepare the request payload
        drafts = []
        for i, draft in enumerate(drafts_data):
            # Validate each draft
            if not isinstance(draft, dict):
                logger.warning(f"Skipping invalid draft at index {i}: not a dictionary")
                continue
                
            required_fields = ["to_email", "subject", "body"]
            missing_fields = [field for field in required_fields if field not in draft or not draft[field]]
            
            if missing_fields:
                logger.warning(f"Skipping draft at index {i}: missing fields {missing_fields}")
                continue
            
            drafts.append(DraftItem(
                user_email=user_email,
                to_email=draft["to_email"].strip(),
                subject=draft["subject"].strip(),
                body=draft["body"].strip()
            ))
        
        if not drafts:
            return {
                "success": False,
                "message": "No valid drafts to create. Please check your draft data."
            }
        
        # Create the request
        request_data = CreateMultiDraftRequest(
            user_email=user_email,
            drafts=drafts
        )
        
        logger.info(f"Sending API request to create {len(drafts)} drafts")
        
        # Make API call to email management service
        response = requests.post(
            f"{EMAIL_MANAGEMENT_BASE_URL}/create-multi-draft",
            json=request_data.dict(),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Spidey-MCP-Server/1.0.0"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Successfully created {result.get('drafts_created', 0)} drafts")
            return {
                "success": True,
                "drafts_created": result.get("drafts_created", 0),
                "draft_ids": result.get("draft_ids", []),
                "message": result.get("message", "Drafts created successfully")
            }
        else:
            error_msg = f"API call failed with status {response.status_code}"
            try:
                error_detail = response.json().get("detail", response.text)
                error_msg += f": {error_detail}"
            except:
                error_msg += f": {response.text}"
            
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg
            }
            
    except requests.exceptions.Timeout:
        error_msg = "Request timed out - the email service may be busy"
        logger.error(error_msg)
        return {
            "success": False,
            "message": error_msg
        }
    except requests.exceptions.ConnectionError:
        error_msg = "Could not connect to email service - please check your internet connection"
        logger.error(error_msg)
        return {
            "success": False,
            "message": error_msg
        }
    except Exception as e:
        error_msg = f"Unexpected error creating drafts: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "message": error_msg
        }

# Additional tools can be added here as the system grows
# For example:


# Export all available tools (will be wrapped with @tool decorator in main.py)
TOOL_FUNCTIONS = {
    "create_email_drafts": create_email_drafts
}
