#!/usr/bin/env python3
"""
Spidey MCP Server - Email Automation Agent
An intelligent agent that helps with email automation, lead generation, and job outreach.
Uses LangChain's ReAct agent framework for proper orchestration and scalability.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from dotenv import load_dotenv
import os

# Import LangChain agent and tools
from agents import create_spidey_agent
from tools import create_email_drafts_tool
from utils.helpers import sanitize_input, validate_email
from utils.firestore_keys import fetch_api_key, initialize_firestore

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Firestore on startup
try:
    initialize_firestore()
    logger.info("Firestore initialized successfully on startup")
except Exception as e:
    logger.warning(f"Firestore initialization skipped: {str(e)}")

# FastAPI app
app = FastAPI(
    title="Spidey MCP Server", 
    version="2.0.0", 
    description="Email Automation Agent powered by LangChain"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "https://superspidey-contact-remedy.onrender.com", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class SpideyRequest(BaseModel):
    """Request model for Spidey agent interactions"""
    user_email: str = Field(..., description="User's email address")
    key_type: str = Field(..., description="Type of AI key to use: 'gemini_api_key' or 'deepseek_v3_key'")
    task: str = Field(..., description="Task description for Spidey to execute")
    context: Optional[str] = Field(None, description="Additional context for the task (e.g., writing style)")
    previous_convo: Optional[str] = Field(None, description="Previous conversation history for context")


class SpideyResponse(BaseModel):
    """Response model for Spidey agent interactions"""
    success: bool
    message: str
    action_taken: Optional[str] = None
    drafts_created: Optional[int] = None
    draft_ids: Optional[List[str]] = None


# ============================================================================
# Agent Management
# ============================================================================

# Cache for agent instances (keyed by API key hash for security)
agent_cache: Dict[str, Any] = {}


def get_or_create_agent(api_key: str, key_type: str, user_email: str):
    """
    Get existing agent from cache or create a new one.
    
    Args:
        api_key: API key for the LLM provider
        key_type: Type of key ('gemini_api_key' or 'deepseek_v3_key')
        user_email: User's email for logging
        
    Returns:
        SpideyAgent instance
    """
    # Use hash of API key + key_type as cache key (for security)
    cache_key = hash(f"{api_key}_{key_type}")
    
    if cache_key in agent_cache:
        logger.info(f"Using cached agent for user: {user_email}")
        return agent_cache[cache_key]
    
    logger.info(f"Creating new agent for user: {user_email} with key_type: {key_type}")
    
    # Create new agent with all available tools
    tools = [create_email_drafts_tool]
    
    try:
        agent = create_spidey_agent(
            api_key=api_key,
            key_type=key_type,
            tools=tools,
            temperature=0.7,
            max_iterations=5,
            verbose=True
        )
        
        # Cache the agent
        agent_cache[cache_key] = agent
        
        return agent
        
    except Exception as e:
        logger.error(f"Failed to create agent: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Spidey agent: {str(e)}"
        )


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "agent": "Spidey",
        "version": "2.0.0",
        "description": "Email Automation Agent powered by LangChain",
        "framework": "LangChain + FastAPI",
        "capabilities": [
            "Email draft creation",
            "Lead generation assistance", 
            "Job application support",
            "Professional outreach",
            "Email campaign planning",
            "Email best practices guidance"
        ],
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "Spidey",
        "version": "2.0.0",
        "framework": "LangChain"
    }


@app.post("/invoke", response_model=SpideyResponse)
async def invoke_spidey(request: SpideyRequest):
    """
    Invoke Spidey agent to process user requests.
    
    This endpoint uses LangChain's ReAct agent framework to:
    - Analyze user intent
    - Decide which tools to use
    - Execute multi-step workflows
    - Provide conversational responses
    
    Args:
        request: SpideyRequest with task, context, and credentials
        
    Returns:
        SpideyResponse with agent's output
    """
    try:
        logger.info(f"Received request from user: {request.user_email}")
        
        # Validate inputs
        if not validate_email(request.user_email):
            raise HTTPException(
                status_code=400,
                detail="Invalid user email address"
            )
        
        # Validate key_type
        if request.key_type not in ["gemini_api_key", "deepseek_v3_key"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid key_type. Must be 'gemini_api_key' or 'deepseek_v3_key'"
            )
        
        # Fetch API key from Firestore
        try:
            api_key = fetch_api_key(request.user_email, request.key_type)
            logger.info(f"Successfully fetched {request.key_type} for user: {request.user_email}")
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
        
        # Sanitize user input
        task = sanitize_input(request.task, max_length=5000)
        context = sanitize_input(request.context or "", max_length=2000)
        previous_convo = sanitize_input(request.previous_convo or "", max_length=5000)
        
        if not task:
            raise HTTPException(
                status_code=400,
                detail="Task cannot be empty"
            )
        
        # Get or create agent
        agent = get_or_create_agent(api_key, request.key_type, request.user_email)
        
        # Build the full input with context
        full_input = task
        if context:
            full_input = f"{task}\n\nContext: {context}"
        
        # Build chat history string
        chat_history = ""
        if previous_convo:
            chat_history = f"Previous conversation:\n{previous_convo}"
        
        # Invoke the agent
        logger.info(f"Invoking agent with task: {task[:100]}...")
        result = agent.invoke(
            user_input=full_input,
            chat_history=chat_history,
            user_email=user_email
        )
        
        # Process the agent's response
        if not result.get("success"):
            return SpideyResponse(
                success=False,
                message=result.get("response", "Sorry, I encountered an error processing your request."),
                action_taken="error"
            )
        
        # Extract the response
        agent_response = result.get("response", "")
        
        # Check if drafts were created by parsing the response
        drafts_created = None
        draft_ids = []
        
        # Look for draft creation indicators in the response
        if "Successfully created" in agent_response and "draft" in agent_response.lower():
            # Try to extract draft count and IDs from the response
            try:
                import re
                # Extract number of drafts
                draft_count_match = re.search(r'(\d+)\s+(?:email\s+)?draft', agent_response)
                if draft_count_match:
                    drafts_created = int(draft_count_match.group(1))
                
                # Extract draft IDs if present
                draft_id_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
                draft_ids = re.findall(draft_id_pattern, agent_response)
            except Exception as e:
                logger.warning(f"Could not extract draft info from response: {str(e)}")
        
        return SpideyResponse(
            success=True,
            message=agent_response,
            action_taken=result.get("action_taken", "agent_execution"),
            drafts_created=drafts_created,
            draft_ids=draft_ids if draft_ids else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in invoke_spidey: {str(e)}")
        return SpideyResponse(
            success=False,
            message=f"Oops! Something went wrong. Please try again or rephrase your request.",
            action_taken="error"
        )


# ============================================================================
# Server Startup
# ============================================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8004))
    logger.info(f"Starting Spidey MCP Server on port {port}")
    logger.info("Powered by LangChain ReAct Agent Framework")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
