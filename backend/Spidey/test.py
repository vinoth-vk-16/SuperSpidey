# spidey_email_agent.py

import requests
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage
from langchain_core.messages import ToolMessage
from langgraph.graph import MessageGraph, END
import os
# ---------------------------------------------------------------
# ✅ CONFIGURATION
# ---------------------------------------------------------------
API_URL = os.getenv(
    "EMAIL_MANAGEMENT_BASE_URL",
    "https://superspidey-email-management.onrender.com"
 ) + "/create-multi-draft" 

AGENT_NAME = "Spidey"

# ---------------------------------------------------------------
# ✅ TOOL DEFINITION – calls your /create-multi-draft endpoint
# ---------------------------------------------------------------
@tool
def create_email_drafts(user_email: str, drafts: list) -> dict:
    """
    Tool to create multiple email drafts at once.

    Each draft must include:
        user_email, to_email, subject, body
    """

    # Enforce the correct structure per item
    for draft in drafts:
        draft["user_email"] = user_email

    payload = {
        "user_email": user_email,
        "drafts": drafts
    }
    headers = {
        "Content-Type": "application/json"
    }

    print(f"→ Calling {API_URL} with payload: {payload}")  # Debug log
    response = requests.post(API_URL, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

# ---------------------------------------------------------------
# ✅ SETUP GEMINI 1.5 MODEL
# ---------------------------------------------------------------
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite", 
    google_api_key="AIzaSyBAZ623equvQfrJ8nckahINy0h4rOygdc8",
    temperature=0.7
)

# Bind the tool
model_with_tools = llm.bind_tools([create_email_drafts])

# ---------------------------------------------------------------
# ✅ BUILD AGENT WITH MessageGraph
# ---------------------------------------------------------------
def call_model(messages):
    # Add system message
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

# Build the graph
workflow = MessageGraph()

workflow.add_node("agent", call_model)
workflow.add_node("tools", call_tools)

workflow.set_entry_point("agent")

workflow.add_conditional_edges("agent", route, {"tools": "tools", END: END})
workflow.add_edge("tools", "agent")

graph = workflow.compile()

# ---------------------------------------------------------------
# ✅ RUN EXAMPLE
# ---------------------------------------------------------------
if __name__ == "__main__":
    messages = [
        HumanMessage(content=(
            "Hi tell about yourself"
        ))
    ]

    result = graph.invoke(messages)
    print("\nFinal Output:")
    print(result[-1].content)
    print(result[-1].tool_calls)