"""
Email Agent - Uses the exact working pattern from test.py
"""

import logging
from langchain_core.messages import ToolMessage
from langgraph.graph import MessageGraph, END
from .model_factory import create_llm_from_key_type

# Import tool from tools module
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from tools.email_draft_tool import create_email_drafts

logger = logging.getLogger(__name__)


def create_spidey_agent(api_key: str, key_type: str, **kwargs):
    """
    Create Spidey agent using the exact working pattern from test.py
    """
    # Get LLM with the provided API key
    llm = create_llm_from_key_type(
        api_key=api_key,
        key_type=key_type,
        temperature=kwargs.get('temperature', 0.7)
    )
    
    # Bind the tool - exact from test.py
    model_with_tools = llm.bind_tools([create_email_drafts])
    
    # Define functions - exact from test.py
    def call_model(messages):
        # Add system message - exact from test.py
        from langchain.schema import SystemMessage
        system_msg = SystemMessage(content="Your name is Spidey. You help users create multiple email drafts efficiently.You help users with their email needs.")
        full_messages = [system_msg] + messages
        
        response = model_with_tools.invoke(full_messages)
        return response
    
    def route(messages):
        last_message = messages[-1]
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            return "tools"
        return END
    
    def call_tools(messages):
        last_message = messages[-1]
        tool_calls = last_message.tool_calls
        
        results = []
        for tool_call in tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]
            
            if tool_name == "create_email_drafts":
                result = create_email_drafts.invoke(tool_args)
                results.append(result)
        
        # Return tool results as a message
        tool_messages = [
            ToolMessage(content=str(result), tool_call_id=tool_calls[i]["id"])
            for i, result in enumerate(results)
        ]
        return tool_messages
    
    # Build the graph - exact from test.py
    workflow = MessageGraph()
    
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tools)
    
    workflow.set_entry_point("agent")
    
    workflow.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")
    
    graph = workflow.compile()
    
    logger.info(f"Spidey Agent created with {key_type}")
    
    return graph


__all__ = ['create_spidey_agent']

