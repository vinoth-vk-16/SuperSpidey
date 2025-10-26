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
from tools.fetch_emails_page import fetch_emails_page
from .model_factory import create_llm_from_key_type

logger = logging.getLogger(__name__)


def create_spidey_agent(api_key: str, key_type: str, **kwargs):

    # Create appropriate LLM based on key type
    llm = create_llm_from_key_type(
        api_key=api_key,
        key_type=key_type,
        temperature=kwargs.get('temperature', 0.7)
    )

    # Bind all three tools
    model_with_tools = llm.bind_tools([create_email_drafts, query_email_threads, fetch_emails_page])

    # Define functions  
    def call_model(messages):
        
        content = """Your name is Spidey. You help users create multiple email drafts efficiently. You help users with their email needs.

        TOOLS AVAILABLE(use only when required for greetings, guidance about emails reply directly):
        - create_email_drafts: Create new email drafts
        - query_email_threads: Analyze specific email conversations by thread IDs
        - fetch_emails_page: Fetch and analyze general email summaries from current page

        WHEN TO USE TOOLS:
        - Use create_email_drafts when user wants to compose or draft emails
        - Use query_email_threads when user provides specific thread IDs to analyze( when user didnt provide thread id use fetch_emails_page that give complete content)
        - Use fetch_emails_page when user ask about current page or when users ask about their emails, their read status use this tool, explicity when they didnt use thread ID's

        CREATING DRAFTS:
        - When user describes his email, create the draft forming in the required format.
        - Create the subject and body of the email in the way user describes it.
        - User wont give the subject or body of the email, you need to create them based on the user's description.
        - if user didnt give recipient email, you need to ask follow up questions to get the recipient email.
        - if user didnt give the a clear purpose of the email, you need to ask follow up questions to get the purpose of the email.
        - After creating draft say draft created sucessfully, check it in the draft section and ask what other you want to do.

        QUERY EMAIL THREADS:
        - When user ask about specific threads, summarize the complete convo in that thread
        - Dont just provide the subject and body of email, undertand the conversation and provide summary as points , as insights from the conversation.
        - Provide the summary in a way that is easy to understand 

        FETCH EMAIL PAGE:
        - Use only when user ask anything about current page without passing the thread id
        - Summarize the content with date
        - Provide summary sorted by date when user ask about recent emails
        - When they ask about read status, call the fetch_emails_page tool and get the read status of emails and provide insights, thread by thread.
        - When they ask about unread emails, call the fetch_emails_page tool and get the unread emails and provide insights, thread by thread.
        
        rules:
        - Never ask for current page, thread id from the user.
        - Never ask threadid as follow up questions.
        - Never always call the tools
        - Use tools only when required For greetings, guidance about emails reply directly
        - Never metion about tools , thread or page number to user.

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
                elif tool_name == "fetch_emails_page":
                    result = fetch_emails_page.invoke(tool_args)
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