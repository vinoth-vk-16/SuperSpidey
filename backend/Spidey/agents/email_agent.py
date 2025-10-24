"""
Email Agent - Simple LangGraph-based Agent with LLM-driven tool selection
"""

import logging
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from langchain.tools import BaseTool
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from .model_factory import create_llm_from_key_type

# Configure logging
logger = logging.getLogger(__name__)


# Spidey System Prompt
SPIDEY_SYSTEM_PROMPT = """You are Spidey, a friendly email assistant who helps people with all their email needs!

**PERSONALITY:**
- Friendly and approachable
- Helpful and encouraging
- Clear and concise

**WHAT YOU DO:**
- Help create email drafts
- Provide email writing guidance
- Assist with professional outreach
- Support job applications and networking

**TOOL USAGE:**
You have access to create_email_drafts tool. Use it ONLY when:
- User explicitly asks to create, write, draft, or generate emails
- You have both the user's email AND recipient email addresses

For questions, tips, or general advice - respond directly WITHOUT using tools.

**GUIDELINES:**
- Be conversational and natural
- When user provides recipient's name, use it as "Dear [name]" in the email body
- Don't use emojis in emails
- Keep responses helpful and focused
"""


class SpideyAgent:
    """
    Simple Spidey Email Agent using LangGraph with LLM-driven tool selection.
    
    This follows the clean pattern where:
    - Tools are bound to LLM
    - LLM decides when to use them
    - No hardcoded rules or patterns
    """

    def __init__(
        self,
        api_key: str,
        key_type: str,
        tools: List[BaseTool],
        temperature: float = 0.7,
        **kwargs
    ):
        """
        Initialize the Spidey Agent.

        Args:
            api_key: API key for the LLM provider
            key_type: Type of key ('gemini_api_key' or 'deepseek_v3_key')
            tools: List of LangChain tools available to the agent
            temperature: LLM temperature for response generation
        """
        self.api_key = api_key
        self.key_type = key_type
        self.tools = tools
        self.temperature = temperature

        # Initialize LLM
        self.llm = create_llm_from_key_type(
            api_key=api_key,
            key_type=key_type,
            temperature=temperature
        )

        # Bind tools to LLM - LLM decides when to use them
        self.llm_with_tools = self.llm.bind_tools(self.tools)

        # Create tool node for execution
        self.tool_node = ToolNode(self.tools)

        # Build the graph
        self.graph = self._build_graph()

        logger.info(f"Spidey Agent initialized with {key_type} and {len(tools)} tool(s)")

    def _build_graph(self):
        """Build the LangGraph state machine"""
        
        def should_continue(state: MessagesState):
            """Decide whether to continue with tool execution or end"""
            last_message = state["messages"][-1]
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                logger.info("LLM requested tool execution")
                return "tools"
            return END
        
        def call_model(state: MessagesState):
            """Invoke LLM with tools bound - LLM decides what to do"""
            messages = state["messages"]
            
            # Add system prompt as first message if not present
            if not any(isinstance(m, HumanMessage) and "Spidey" in m.content for m in messages[:1]):
                system_message = HumanMessage(content=SPIDEY_SYSTEM_PROMPT)
                messages = [system_message] + messages
            
            try:
                # LLM with bound tools autonomously decides tool usage
                response = self.llm_with_tools.invoke(messages)
                return {"messages": [response]}
            except AttributeError as e:
                logger.error(f"LLM error: {str(e)}")
                fallback = AIMessage(content="Hi! I'm Spidey, your email assistant. How can I help you today?")
                return {"messages": [fallback]}
            except Exception as e:
                logger.error(f"Error calling model: {str(e)}")
                error_msg = "Oops! Something went wrong. Could you please rephrase your request?"
                if "API_KEY_INVALID" in str(e) or "API key not valid" in str(e):
                    error_msg = "There seems to be an issue with the API configuration."
                elif "quota" in str(e).lower():
                    error_msg = "API quota reached. Please try again in a few minutes."
                return {"messages": [AIMessage(content=error_msg)]}
        
        # Build the graph
        builder = StateGraph(MessagesState)
        
        # Add nodes
        builder.add_node("call_model", call_model)
        builder.add_node("tools", self.tool_node)
        
        # Add edges
        builder.add_edge(START, "call_model")
        builder.add_conditional_edges("call_model", should_continue, ["tools", END])
        builder.add_edge("tools", "call_model")
        
        # Compile and return
        return builder.compile()

    def invoke(self, user_input: str, chat_history: str = "", user_email: str = "") -> Dict[str, Any]:
        """
        Invoke the agent with user input.

        Args:
            user_input: The user's message/request
            chat_history: Optional previous conversation context
            user_email: User's email address for tool execution

        Returns:
            Dictionary with agent response and metadata
        """
        try:
            logger.info(f"Agent invoked with: {user_input[:100]}...")

            # Build messages from chat history
            messages = []
            if chat_history:
                for line in chat_history.split('\n'):
                    if line.startswith('User: '):
                        messages.append(HumanMessage(content=line[6:]))
                    elif line.startswith('Spidey: '):
                        messages.append(AIMessage(content=line[8:]))

            # Add current user input
            # Include user_email in the message so LLM can use it for tool calls
            if user_email:
                user_input_with_email = f"{user_input}\n\n[User email: {user_email}]"
                messages.append(HumanMessage(content=user_input_with_email))
            else:
                messages.append(HumanMessage(content=user_input))

            # Invoke the graph
            result = self.graph.invoke({"messages": messages})

            # Extract final response
            final_messages = result["messages"]
            last_message = final_messages[-1]
            response_text = last_message.content if hasattr(last_message, 'content') else str(last_message)

            # Check if tools were used
            tool_used = any(hasattr(msg, "tool_calls") and msg.tool_calls for msg in final_messages)

            return {
                "success": True,
                "response": response_text,
                "action_taken": "tool_execution" if tool_used else "direct_response"
            }

        except Exception as e:
            logger.error(f"Error during agent execution: {str(e)}")
            return {
                "success": False,
                "response": "Sorry, I encountered an error. Please try again.",
                "action_taken": "error",
                "error": str(e)
            }


def create_spidey_agent(
    api_key: str,
    key_type: str,
    tools: List[BaseTool],
    **kwargs
) -> SpideyAgent:
    """
    Factory function to create a Spidey Agent.

    Args:
        api_key: API key for the LLM provider
        key_type: Type of key ('gemini_api_key' or 'deepseek_v3_key')
        tools: List of LangChain tools
        **kwargs: Additional arguments for SpideyAgent

    Returns:
        Initialized SpideyAgent instance
    """
    return SpideyAgent(
        api_key=api_key,
        key_type=key_type,
        tools=tools,
        **kwargs
    )


__all__ = ['SpideyAgent', 'create_spidey_agent']
