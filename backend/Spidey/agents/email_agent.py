"""
Email Agent - Uses the exact working pattern from test.py
"""

import logging
import os
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from langchain_core.messages import ToolMessage
from langgraph.graph import MessageGraph, END

# Import tool from tools module
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from tools.email_draft_tool import create_email_drafts

logger = logging.getLogger(__name__)


def create_spidey_agent(api_key: str, key_type: str, **kwargs):
    """
    Create Spidey agent using the EXACT working pattern from test.py
    """
    # Use the exact same model setup as test.py
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        google_api_key=api_key,
        temperature=kwargs.get('temperature', 0.7)
    )

    # Bind the tool - exact from test.py
    model_with_tools = llm.bind_tools([create_email_drafts])

    # Define functions - exact from test.py
    def call_model(messages):
        # Add system message - exact from test.py
        system_msg = SystemMessage(content="Your name is Spidey. You help users create multiple email drafts efficiently. You help users with their email needs.")
        full_messages = [system_msg] + messages

        try:
            response = model_with_tools.invoke(full_messages)
            logger.info(f"Model response type: {type(response)}")
            logger.info(f"Has tool_calls: {hasattr(response, 'tool_calls')}")
            if hasattr(response, 'tool_calls'):
                logger.info(f"Tool calls: {response.tool_calls}")
            return response
        except Exception as e:
            logger.error(f"Error calling model: {str(e)}", exc_info=True)
            return AIMessage(content="Error! Please try again later.")
    
    def route(messages):
        last_message = messages[-1]
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            return "tools"
        return END
    
    def call_tools(messages):
        last_message = messages[-1]
        tool_calls = last_message.tool_calls
        
        results = []
        for i, tool_call in enumerate(tool_calls):
            try:
                # Handle different tool_call formats
                if isinstance(tool_call, dict):
                    tool_name = tool_call.get("name")
                    tool_args = tool_call.get("args", {})
                    tool_id = tool_call.get("id", f"call_{i}")
                else:
                    # If tool_call is an object with attributes
                    tool_name = getattr(tool_call, 'name', None)
                    tool_args = getattr(tool_call, 'args', {})
                    tool_id = getattr(tool_call, 'id', f"call_{i}")
                
                logger.info(f"Processing tool call: {tool_name} with args: {tool_args}")
                
                if tool_name == "create_email_drafts":
                    result = create_email_drafts.invoke(tool_args)
                    results.append((result, tool_id))
                else:
                    logger.warning(f"Unknown tool: {tool_name}")
                    results.append(({"error": f"Unknown tool: {tool_name}"}, tool_id))
                    
            except Exception as e:
                logger.error(f"Error executing tool: {str(e)}", exc_info=True)
                results.append(({"error": str(e)}, f"call_{i}"))
        
        # Return tool results as messages
        tool_messages = [
            ToolMessage(content=str(result), tool_call_id=tool_id)
            for result, tool_id in results
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