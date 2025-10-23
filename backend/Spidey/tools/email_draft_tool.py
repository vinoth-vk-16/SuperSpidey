"""
Email Draft Tool - LangChain Tool implementation for creating email drafts
"""

import logging
import os
import requests
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from langchain.tools import Tool, StructuredTool
from langchain.pydantic_v1 import BaseModel as LangChainBaseModel

# Configure logging
logger = logging.getLogger(__name__)

# Configuration
EMAIL_MANAGEMENT_BASE_URL = os.getenv(
    "EMAIL_MANAGEMENT_BASE_URL",
    "https://superspidey-email-management.onrender.com"
)


class EmailDraftInput(LangChainBaseModel):
    """Input schema for creating email drafts"""
    user_email: str = Field(
        description="The email address of the user creating the drafts"
    )
    drafts: List[Dict[str, str]] = Field(
        description="List of email drafts to create. Each draft should have 'to_email', 'subject', and 'body' fields"
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


def _create_email_drafts_impl(user_email: str, drafts: List[Dict[str, str]]) -> str:
    """
    Implementation of email draft creation logic.
    
    Args:
        user_email: The user's email address
        drafts: List of draft dictionaries with to_email, subject, and body
        
    Returns:
        A string response with the result
    """
    try:
        logger.info(f"Creating {len(drafts)} email drafts for user: {user_email}")
        
        # Validate input data
        if not user_email or not isinstance(user_email, str):
            return "❌ Error: Invalid user email provided"
            
        if not drafts or not isinstance(drafts, list):
            return "❌ Error: Invalid drafts data - must be a list of email drafts"
        
        # Prepare the request payload
        valid_drafts = []
        skipped = 0
        
        for i, draft in enumerate(drafts):
            # Validate each draft
            if not isinstance(draft, dict):
                logger.warning(f"Skipping invalid draft at index {i}: not a dictionary")
                skipped += 1
                continue
                
            required_fields = ["to_email", "subject", "body"]
            missing_fields = [field for field in required_fields if field not in draft or not draft[field]]
            
            if missing_fields:
                logger.warning(f"Skipping draft at index {i}: missing fields {missing_fields}")
                skipped += 1
                continue
            
            valid_drafts.append(DraftItem(
                user_email=user_email,
                to_email=draft["to_email"].strip(),
                subject=draft["subject"].strip(),
                body=draft["body"].strip()
            ))
        
        if not valid_drafts:
            return "❌ Error: No valid drafts to create. Each draft needs 'to_email', 'subject', and 'body' fields."
        
        # Create the request
        request_data = CreateMultiDraftRequest(
            user_email=user_email,
            drafts=valid_drafts
        )
        
        logger.info(f"Sending API request to create {len(valid_drafts)} drafts")
        
        # Make API call to email management service
        response = requests.post(
            f"{EMAIL_MANAGEMENT_BASE_URL}/create-multi-draft",
            json=request_data.dict(),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Spidey-MCP-Server/2.0.0"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            drafts_created = result.get("drafts_created", 0)
            draft_ids = result.get("draft_ids", [])
            
            logger.info(f"Successfully created {drafts_created} drafts")
            
            success_msg = f"✅ Successfully created {drafts_created} email draft(s)!"
            if skipped > 0:
                success_msg += f" ({skipped} draft(s) were skipped due to invalid data)"
            
            success_msg += f"\n📝 Draft IDs: {', '.join(draft_ids[:3])}"
            if len(draft_ids) > 3:
                success_msg += f" and {len(draft_ids) - 3} more"
            
            return success_msg
        else:
            error_msg = f"API call failed with status {response.status_code}"
            try:
                error_detail = response.json().get("detail", response.text)
                error_msg += f": {error_detail}"
            except:
                error_msg += f": {response.text}"
            
            logger.error(error_msg)
            return f"❌ Error creating drafts: {error_msg}"
            
    except requests.exceptions.Timeout:
        error_msg = "Request timed out - the email service may be busy. Please try again."
        logger.error(error_msg)
        return f"❌ {error_msg}"
        
    except requests.exceptions.ConnectionError:
        error_msg = "Could not connect to email service. Please check your internet connection."
        logger.error(error_msg)
        return f"❌ {error_msg}"
        
    except Exception as e:
        error_msg = f"Unexpected error creating drafts: {str(e)}"
        logger.error(error_msg)
        return f"❌ {error_msg}"


# Create the LangChain Tool
create_email_drafts_tool = StructuredTool.from_function(
    func=_create_email_drafts_impl,
    name="create_email_drafts",
    description="""Create multiple email drafts and store them in the user's draft folder. 
    
    Use this tool when the user explicitly asks to CREATE, WRITE, DRAFT, or GENERATE actual emails.
    
    This tool is perfect for:
    - Creating email drafts when the user asks to create, write, draft, or generate actual emails.
    
    Input should include:
    - user_email: The user's email address
    - drafts: A list of email drafts, each with:
        * to_email: Recipient's email address
        * subject: Email subject line  
        * body: Full email content/message
    
    Example usage:
    If user says "Create 3 outreach emails for tech startups", use this tool with 3 draft objects.
    
    DO NOT use this tool if the user is just asking questions or seeking advice about emails.
    """,
    args_schema=EmailDraftInput,
    return_direct=False
)


__all__ = ['create_email_drafts_tool']

