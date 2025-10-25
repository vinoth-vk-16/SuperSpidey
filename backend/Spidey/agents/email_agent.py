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

# Import tools from tools module
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from tools.email_draft_tool import create_email_drafts
from tools.query_email_threads import query_email_threads
from tools.fetch_email_by_date import fetch_email_by_date, get_current_date_for_llm

logger = logging.getLogger(__name__)


def create_spidey_agent(api_key: str, key_type: str, **kwargs):
    
    # Use the exact same model setup as test.py
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        google_api_key=api_key,
        temperature=kwargs.get('temperature', 0.7)
    )

    # Bind all three tools
    model_with_tools = llm.bind_tools([create_email_drafts, query_email_threads, fetch_email_by_date])

    # Define functions
    def call_model(messages):
        # Fetch current date dynamically for each conversation
        current_date_info = get_current_date_for_llm()

        content = f"""Your name is Spidey. You help users create multiple email drafts efficiently. You help users with their email needs.


        TOOLS AVAILABLE:
        - create_email_drafts: Create new email drafts
        - query_email_threads: Analyze specific email conversations by thread ID
        - fetch_email_by_date: Fetch and analyze emails from specific dates or date ranges

        WHEN TO USE TOOLS:
        - Use create_email_drafts when user wants to compose or draft emails
        - Use query_email_threads when user mentions specific thread IDs or wants to analyze conversations
        - Use fetch_email_by_date when user asks about emails from dates (calculate proper ISO dates using current date above)

        DATE CALCULATIONS:
        When using fetch_email_by_date, always calculate proper ISO date format (YYYY-MM-DD):
        - "today" = current date
        - "yesterday" = current date= {current_date_info} minus 1 day
        - "last week" = current date= {current_date_info} minus 7 days (as start_date) to current date (as end_date)
        - "last 3 days" = current date= {current_date_info} minus 3 days (as start_date) to current date (as end_date)

        CREATING DRAFTS:
        - When user describes his email, create the draft forming in the required format.
        - Create the subject and body of the email in the way user describes it.
        - User wont give the subject or body of the email, you need to create them based on the user's description.
        - if user didnt give recipient email, you need to ask follow up questions to get the recipient email.
        - if user didnt give the a clear purpose of the email, you need to ask follow up questions to get the purpose of the email.
        - After creating draft say draft created sucessfully, check it in the draft section and ask what other you want to do.

        ANALYZING CONVERSATIONS:
        - When user provides thread IDs, use query_email_threads to get the conversation data
        - Then analyze the conversation and answer their questions about it
        - Be helpful in summarizing, explaining, or providing insights about the email threads

        Rules:
        -Never ask current date, thread id from the user.

        """
        system_msg = SystemMessage(content=content)
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
                elif tool_name == "query_email_threads":
                    result = query_email_threads.invoke(tool_args)
                    results.append((result, tool_id))
                elif tool_name == "fetch_email_by_date":
                    result = fetch_email_by_date.invoke(tool_args)
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