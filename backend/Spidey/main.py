#!/usr/bin/env python3
"""
Spidey MCP Server - Email Automation Agent
Uses the exact working pattern from test.py with FastAPI and Firestore integration
"""

import logging
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from dotenv import load_dotenv
import os
from langchain.schema import HumanMessage

# Import agent and utilities
from agents import create_spidey_agent
from utils.helpers import sanitize_input, validate_email
from utils.firestore_keys import get_user_api_key, get_user_selected_key, initialize_firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Firestore
try:
    initialize_firestore()
    logger.info("Firestore initialized successfully")
except Exception as e:
    logger.warning(f"Firestore initialization skipped: {str(e)}")

# FastAPI app
app = FastAPI(
    title="Spidey MCP Server", 
    version="3.1.0", 
    description="Email Automation Agent"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "https://superspidey-contact-remedy.onrender.com", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Request/Response Models
class SpideyRequest(BaseModel):
    """Request model for Spidey agent"""
    user_email: str = Field(..., description="User's email address")
    task: str = Field(..., description="Task description")
    previous_convo: Optional[str] = Field(None, description="Previous conversation history")
    thread_ids: Optional[List[str]] = Field(None, description="Thread IDs to query (for conversation analysis)")
    page: Optional[int] = Field(1, description="Page number for email fetching (default: 1)")


class SpideyResponse(BaseModel):
    """Response model for Spidey agent"""
    success: bool
    message: str
    action_taken: Optional[str] = None


# Agent cache
agent_cache = {}


def get_or_create_agent(api_key: str, key_type: str, user_email: str):
    """Get existing agent from cache or create new one"""
    cache_key = hash(f"{api_key}_{key_type}")
    
    if cache_key in agent_cache:
        logger.info(f"Using cached agent for user: {user_email}")
        return agent_cache[cache_key]
    
    logger.info(f"Creating new agent for user: {user_email}")
    
    try:
        agent = create_spidey_agent(
            api_key=api_key,
            key_type=key_type,
            temperature=0.7
        )
        
        agent_cache[cache_key] = agent
        return agent
        
    except Exception as e:
        logger.error(f"Failed to create agent: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize agent: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "agent": "Spidey",
        "version": "3.1.0",
        "description": "Email Automation Agent",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "Spidey",
        "version": "3.1.0"
    }


@app.post("/invoke", response_model=SpideyResponse)
async def invoke_spidey(request: SpideyRequest):
    """
    Invoke Spidey agent to process user requests.
    Uses the exact working pattern from test.py
    """
    try:
        logger.info(f"Received request from user: {request.user_email}")
        
        # Validate email
        if not validate_email(request.user_email):
            raise HTTPException(
                status_code=400,
                detail="Invalid user email address"
            )

        # Fetch the user's selected API key and key type from Firestore
        try:
            api_key = get_user_api_key(request.user_email)
            key_type = get_user_selected_key(request.user_email)
            logger.info(f"Successfully fetched selected {key_type} for user: {request.user_email}")
        except ValueError as e:
            raise HTTPException(
                status_code=404,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Error fetching API key: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch API key: {str(e)}"
            )
        
        # Sanitize input
        task = sanitize_input(request.task, max_length=5000)
        previous_convo = sanitize_input(request.previous_convo or "", max_length=10000)
        
        if not task:
            raise HTTPException(
                status_code=400,
                detail="Task cannot be empty"
            )
        
        # Get or create agent
        agent = get_or_create_agent(api_key, key_type, request.user_email)
        
        # Build messages - exact pattern from test.py
        messages = []
        
        # Add previous conversation if exists
        if previous_convo:
            for line in previous_convo.split('\n'):
                if line.startswith('User: '):
                    messages.append(HumanMessage(content=line[6:]))
                elif line.startswith('Spidey: '):
                    from langchain.schema import AIMessage
                    messages.append(AIMessage(content=line[8:]))
        
        # Build current message
        current_message = task

        # Add context based on what's being asked
        if request.thread_ids and len(request.thread_ids) > 0:
            # Specific thread analysis
            current_message = f"{current_message}\n\n[Please analyze these specific email threads: {', '.join(request.thread_ids)}. Use the query_email_threads tool to get the conversation data first, then answer my question about them.]"
        elif any(keyword in task.lower() for keyword in ['summarize', 'summary', 'recent', 'emails', 'sent', 'received', 'unread', 'view', 'show me']):
            # General email summarization - use page fetching
            current_message = f"{current_message}\n\n[This appears to be a general email summarization request. Use the fetch_emails_page tool with page {request.page} to get the current page of emails, then summarize or answer the user's question about their emails.]"

        # Add user email and page info to message for tool execution
        current_message = f"{current_message}\n\n[User email: {request.user_email}, Current page: {request.page}]"
        messages.append(HumanMessage(content=current_message))
        
        # Invoke the agent - exact from test.py
        logger.info(f"Invoking agent with task: {task[:100]}...")
        result = agent.invoke(messages)
        
        # Extract response
        final_message = result[-1]
        response_text = final_message.content if hasattr(final_message, 'content') else str(final_message)
        
        # Check if tools were used
        tool_used = any(hasattr(msg, 'tool_calls') and msg.tool_calls for msg in result)
        
        return SpideyResponse(
            success=True,
            message=response_text,
            action_taken="tool_execution" if tool_used else "direct_response"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in invoke_spidey: {str(e)}")
        return SpideyResponse(
            success=False,
            message=f"Oops! Something went wrong. Please try again.",
            action_taken="error"
        )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8004))
    logger.info(f"Starting Spidey MCP Server on port {port}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )

