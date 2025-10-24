# 🏗️ Spidey Multi-Agent Architecture - Complete Guide

## 🎯 System Overview

Spidey is a **truly agentic** email automation system where the **LLM makes all decisions** about tool usage. There are **zero hardcoded rules** - the LLM autonomously decides when to create drafts, ask questions, or provide guidance based on natural language understanding.

---

## 🧠 Core Principle: LLM-Driven Decision Making

### Why Not Rule-Based?

**Rule-based systems** (keyword matching, regex patterns) are:
- ❌ Brittle and inflexible
- ❌ Require constant maintenance
- ❌ Can't handle natural language variations
- ❌ Lack context understanding
- ❌ Not truly "agentic"

**LLM-driven systems** (tool binding) are:
- ✅ Adaptive and flexible
- ✅ Self-maintaining (improve with model updates)
- ✅ Handle infinite variations naturally
- ✅ Context-aware across conversations
- ✅ Truly autonomous agents

---

## 🔧 Technical Architecture

### 1. Tool Binding (The Magic)

```python
# Tools are bound to LLM at initialization
self.llm_with_tools = self.llm.bind_tools(self.tools)
```

**What happens behind the scenes:**
1. LangChain converts tool definitions to function schemas
2. Schemas are injected into LLM context
3. LLM is instructed how to format tool calls
4. LLM autonomously decides when to use each tool

**Tool Schema Example:**
```json
{
  "name": "create_email_drafts",
  "description": "Create multiple email drafts and store them in the system",
  "parameters": {
    "type": "object",
    "properties": {
      "user_email": {"type": "string"},
      "drafts": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "to_email": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"}
          }
        }
      }
    }
  }
}
```

### 2. LangGraph State Machine

```
┌─────────────────────────────────────────────────────────┐
│                      START                               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  NODE: call_model                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Inject system prompt + conversation history  │   │
│  │ 2. Call LLM with bound tools                    │   │
│  │ 3. LLM returns response or tool_calls           │   │
│  └─────────────────────────────────────────────────┘   │
└───────┬─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  CONDITIONAL: should_continue                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Check: Does response have tool_calls?           │   │
│  └─────────────────────────────────────────────────┘   │
└───┬──────────────────────────────────────────┬──────────┘
    │                                           │
    │ No tool_calls                             │ Has tool_calls
    │                                           │
    ▼                                           ▼
┌───────────┐                     ┌──────────────────────────┐
│    END    │                     │ NODE: execute_tools      │
└───────────┘                     │ ┌──────────────────────┐ │
                                  │ │ 1. Parse tool_calls  │ │
                                  │ │ 2. Inject user_email │ │
                                  │ │ 3. Execute tool func │ │
                                  │ │ 4. Create ToolMessage│ │
                                  │ └──────────────────────┘ │
                                  └──────────┬───────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────┐
                                  │  Back to call_model      │
                                  │  (LLM generates final    │
                                  │   response with results) │
                                  └──────────┬───────────────┘
                                             │
                                             ▼
                                         ┌───────┐
                                         │  END  │
                                         └───────┘
```

### 3. State Management

```python
class AgentState(TypedDict):
    messages: List[BaseMessage]  # Full conversation history
    user_email: str              # User identification
    key_type: str                # Model selection
    api_key: str                 # Decrypted API key
    error: Optional[str]         # Error tracking
```

**State Flow:**
1. **Initial State**: User message + metadata
2. **call_model**: State + LLM response
3. **execute_tools**: State + tool results
4. **Final State**: Complete conversation history

---

## 🔄 Complete Request Flow

### Example: "create email to john@example.com about our product"

#### Step 1: User Request
```json
{
  "user_input": "create email to john@example.com about our product",
  "user_email": "me@company.com",
  "key_type": "gemini_api_key"
}
```

#### Step 2: State Initialization
```python
initial_state = {
    "messages": [HumanMessage("create email to john@example.com about our product")],
    "user_email": "me@company.com",
    "key_type": "gemini_api_key",
    "api_key": "decrypted_key_here",
    "error": None
}
```

#### Step 3: call_model Node
```python
# System prompt + user message injected
system_prompt = """You are Spidey...
Available tools:
- create_email_drafts: Create multiple email drafts..."""

# LLM invoked with tools bound
response = llm_with_tools.invoke([
    HumanMessage(system_prompt),
    HumanMessage("create email to john@example.com about our product")
])
```

#### Step 4: LLM Decision
```python
# LLM autonomously decides to use tool
response = AIMessage(
    content="I'll create that draft for you!",
    tool_calls=[{
        "id": "call_123",
        "name": "create_email_drafts",
        "args": {
            "user_email": "me@company.com",
            "drafts": [{
                "to_email": "john@example.com",
                "subject": "Exciting Product Update",
                "body": "Hi John,\n\nI wanted to reach out..."
            }]
        }
    }]
)
```

#### Step 5: Conditional Routing
```python
# should_continue checks for tool_calls
if response.tool_calls:
    # Route to execute_tools
    return "execute_tools"
```

#### Step 6: Tool Execution
```python
# Execute the tool
result = create_email_drafts_tool.func(
    user_email="me@company.com",
    drafts=[{
        "to_email": "john@example.com",
        "subject": "Exciting Product Update",
        "body": "Hi John,\n\nI wanted to reach out..."
    }]
)

# Result: {"success": True, "drafts_created": 1, "draft_ids": ["uuid-123"]}
```

#### Step 7: Tool Message Created
```python
tool_message = ToolMessage(
    content='{"success": true, "drafts_created": 1, "draft_ids": ["uuid-123"]}',
    tool_call_id="call_123",
    name="create_email_drafts"
)
```

#### Step 8: Back to call_model
```python
# LLM generates final response with tool results
messages = [
    HumanMessage("create email to john@example.com..."),
    AIMessage("I'll create that draft...", tool_calls=[...]),
    ToolMessage('{"success": true, ...}')
]

final_response = llm.invoke(messages)
# "✅ I've created your email draft to John about your product! ..."
```

#### Step 9: Final Response
```json
{
  "success": true,
  "response": "✅ I've created your email draft to John about your product! You can review and send it from your drafts.",
  "action_taken": "tool_execution"
}
```

---

## 🧩 Component Details

### 1. Main Application (`main.py`)

**Responsibilities:**
- FastAPI server setup
- API key management (fetch + decrypt from Firestore)
- Agent lifecycle management (creation + caching)
- Request/response handling

**Key Functions:**
```python
@app.post("/invoke")
async def invoke_spidey(request: SpideyRequest):
    # 1. Fetch + decrypt API key from Firestore
    api_key = await fetch_api_key(user_email, key_type)
    
    # 2. Get or create agent (with caching)
    agent = get_or_create_agent(api_key, key_type)
    
    # 3. Invoke agent
    result = agent.invoke(user_input, chat_history, user_email)
    
    # 4. Return response
    return SpideyResponse(**result)
```

### 2. Agent (`agents/email_agent.py`)

**Responsibilities:**
- LLM initialization with tool binding
- LangGraph workflow creation
- State management
- Error handling

**Core Logic:**
```python
class SpideyAgent:
    def __init__(self, api_key, key_type, tools):
        # Initialize LLM
        self.llm = create_llm_from_key_type(api_key, key_type)
        
        # Bind tools to LLM (THE KEY!)
        self.llm_with_tools = self.llm.bind_tools(tools)
        
        # Create LangGraph workflow
        self.graph = self._create_graph()
    
    def _create_graph(self):
        # Define nodes: call_model, execute_tools
        # Define edges: conditional routing
        # Compile and return
```

### 3. Tools (`tools/email_draft_tool.py`)

**Responsibilities:**
- Tool definition with clear descriptions
- Input validation (Pydantic)
- API integration (Email Management Service)
- Error handling

**Tool Structure:**
```python
create_email_drafts_tool = StructuredTool.from_function(
    func=create_email_drafts,
    name="create_email_drafts",
    description="Create multiple email drafts and store them in the system. Use this when user explicitly asks to create, write, draft, or generate emails.",
    args_schema=CreateMultiDraftRequest  # Pydantic schema
)
```

### 4. Model Factory (`agents/model_factory.py`)

**Responsibilities:**
- Multi-model support (Gemini, DeepSeek)
- Model initialization with fallbacks
- Configuration management

**Supported Models:**
```python
# Gemini (Google)
- gemini-1.5-flash (primary)
- gemini-1.5-pro (fallback)
- gemini-1.0-pro (fallback)

# DeepSeek (OpenRouter)
- deepseek/deepseek-chat-v3-0324:free
```

### 5. Utilities

**`utils/firestore_keys.py`:**
- Firebase initialization
- Encrypted key retrieval
- Key decryption

**`utils/encryption.py`:**
- Fernet encryption/decryption
- Key management

**`utils/helpers.py`:**
- Input sanitization
- Email validation

---

## 🎓 Why This Design?

### 1. Scalability
**Adding a new tool:**
```python
# Define tool
new_tool = StructuredTool.from_function(
    func=send_email,
    name="send_email",
    description="Send an email immediately"
)

# Add to tools list
tools = [create_email_drafts_tool, new_tool]

# Done! No other changes needed.
# LLM automatically knows about it.
```

### 2. Maintainability
**Natural language variations handled automatically:**
- "create email" ✅
- "draft a message" ✅
- "write to john" ✅
- "can you compose" ✅
- "make an email" ✅
- "send a note" ✅ (if send_email tool exists)

**No code changes needed!**

### 3. Intelligence
**Multi-turn conversations:**
```
User: "I need to reach out to john@example.com"
Spidey: "Sure! What would you like to say?"
User: "tell him about our new product"
Spidey: [Creates draft with context from both messages]
```

**LLM tracks:**
- Previous messages
- User intent
- Missing information
- Context across turns

### 4. Robustness
**Error handling at every level:**
- LLM errors → Graceful fallback
- Tool errors → User-friendly message
- State errors → Logged and tracked
- API errors → Retry with fallback models

---

## 📊 Performance & Optimization

### Caching Strategy
```python
# Agent instances are cached per (api_key, key_type)
agent_cache = {}

def get_or_create_agent(api_key, key_type):
    cache_key = f"{api_key[:10]}_{key_type}"
    if cache_key not in agent_cache:
        agent_cache[cache_key] = create_spidey_agent(...)
    return agent_cache[cache_key]
```

**Benefits:**
- Faster subsequent requests
- Reduced initialization overhead
- Memory efficient

### Model Fallbacks
```python
# Automatic fallback on model errors
try:
    response = llm_with_tools.invoke(messages)
except ModelError:
    # Try fallback model
    response = fallback_llm.invoke(messages)
```

### Async Support
```python
# FastAPI async endpoints
@app.post("/invoke")
async def invoke_spidey(request: SpideyRequest):
    # Allows concurrent request handling
```

---

## 🔐 Security Architecture

### 1. Encrypted Key Storage
```
User Request → Firestore (encrypted key) → Fernet Decrypt → Runtime Use → Discard
```

### 2. Per-Request Authentication
- Keys fetched per request
- Never stored in memory long-term
- User isolation via Firestore document structure

### 3. Input Sanitization
- Email validation
- Input length limits
- XSS prevention

---

## 🚀 Deployment

### Environment Variables
```bash
service_key='{"type": "service_account", ...}'  # Firebase config
ENCRYPTION_KEY='fernet_key_here'                 # For key decryption
PORT=8004                                        # Server port
EMAIL_MANAGEMENT_BASE_URL=https://...           # Email service URL
```

### Production Considerations
- **Horizontal Scaling**: Stateless design allows multiple instances
- **Load Balancing**: Round-robin or least-connections
- **Monitoring**: Structured logging with correlation IDs
- **Rate Limiting**: Per-user or global limits

---

## 🧪 Testing

```bash
# Run test suite
python test_langchain_agent.py

# Expected output:
# ✅ LLM autonomously decides tool usage
# ✅ No hardcoded patterns in logs
# ✅ Natural language variations handled
```

---

## 🔮 Future Enhancements

### Easy Additions (Thanks to LLM-Driven Design)
1. **New Tools**: Just define and add to list
2. **Multi-Tool Workflows**: LLM orchestrates automatically
3. **Improved Models**: Drop-in replacement in model factory
4. **Custom System Prompts**: Per-user personalization
5. **Tool Chaining**: LLM decides sequence automatically

### No Code Changes Needed For:
- New phrasings or keywords
- Multi-turn conversation patterns
- Context-aware requests
- Parameter extraction variations

---

## 📚 Key Takeaways

1. **LLM-Driven > Rule-Based**: Always prefer tool binding over hardcoded patterns
2. **State Machines are Powerful**: LangGraph provides robust workflow management
3. **Tool Descriptions Matter**: Clear descriptions = better LLM decisions
4. **Let LLMs Decide**: They're better at understanding intent than regex
5. **Agentic ≠ Autonomous**: True agents make decisions, not follow rules

---

**Version**: 3.0.0  
**Framework**: LangGraph + LangChain + FastAPI  
**Pattern**: ReAct (Reasoning + Acting) with Tool Binding  
**Philosophy**: LLM autonomy over hardcoded logic
