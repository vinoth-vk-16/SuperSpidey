# 🕷️ Spidey - Multi-Model Email Automation Agent

Spidey is an intelligent MCP (Model Context Protocol) server built with **LangChain's ReAct Agent Framework**, **FastAPI**, and **multiple AI models**. It specializes in email automation, lead generation, and professional outreach using secure encrypted API key storage and a structured, scalable agentic approach.

**Version 2.1.0** - Multi-Model Support & Secure Key Storage

## 🚀 Features

### 🤖 AI & Agent Features
- **Multi-Model Support**: Choose between Gemini (Google) and DeepSeek (OpenRouter)
- **Intelligent Agent Framework**: Built on LangChain's ReAct pattern for proper reasoning and action orchestration
- **Conversational Interface**: Natural dialogue for clarifying requirements and gathering information

### 📧 Email Automation
- **Email Draft Creation**: Generate multiple personalized email drafts with tool-based execution
- **Lead Generation**: Craft compelling outreach emails for potential clients
- **Job Applications**: Assist with job application emails and follow-ups
- **Professional Guidance**: Provide email best practices and strategic advice

### 🔐 Security & Architecture
- **Secure API Key Storage**: Encrypted keys stored in Firestore, decrypted server-side
- **Per-Request Authentication**: API keys never stored in memory or exposed to frontend
- **Multi-Tenant Ready**: Each user has isolated encrypted keys

## 🛠️ Technology Stack

### 🤖 AI Models
- **Google Gemini**: `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`
- **DeepSeek v3**: `deepseek/deepseek-chat-v3-0324:free` (via OpenRouter)

### 🏗️ Framework & Infrastructure
- **FastAPI**: Modern web framework for the MCP server
- **LangChain**: Agent orchestration framework with ReAct pattern
  - `create_react_agent`: For intelligent tool selection
  - `AgentExecutor`: For managing multi-step workflows
  - `StructuredTool`: For type-safe tool definitions
- **Firebase/Firestore**: Secure encrypted API key storage
- **Cryptography**: Fernet encryption for API keys

### 🔧 Utilities
- **Pydantic**: Data validation and serialization
- **Requests**: HTTP client for email management API calls
- **python-dotenv**: Environment variable management

## 📁 Project Structure

```
Spidey/
├── main.py                      # FastAPI server and agent management
├── tools/
│   ├── __init__.py
│   └── email_draft_tool.py      # LangChain tool for draft creation
├── agents/
│   ├── __init__.py
│   ├── email_agent.py           # ReAct agent implementation
│   └── model_factory.py         # AI model factory (Gemini/DeepSeek)
├── utils/
│   ├── __init__.py
│   ├── helpers.py               # Utility functions
│   ├── encryption.py            # Fernet encryption utilities
│   └── firestore_keys.py        # Firestore API key management
├── requirements.txt             # Python dependencies
├── test_langchain_agent.py      # Test suite
├── API_KEY_STORAGE.md          # API key storage guide
├── DEPLOYMENT.md               # Deployment guide
├── GET_API_KEY.md             # API key setup guide
├── CHANGELOG_v2.1.0.md        # Version changelog
├── MIGRATION_SUMMARY.md       # Migration guide
└── README.md                   # This file
```

## 📦 Installation

1. **Clone and Navigate**:
   ```bash
   cd backend/Spidey
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Setup**:
   ```bash
   # Required: Firebase service key path
   export FIREBASE_SERVICE_KEY_PATH=/path/to/access-key.json

   # Required: Fernet encryption key (generate using cryptography.fernet.Fernet.generate_key())
   export ENCRYPTION_KEY='your_fernet_key_here'

   # Optional: Set custom port
   export PORT=8004

   # Optional: Set email management service URL
   export EMAIL_MANAGEMENT_BASE_URL=https://superspidey-email-management.onrender.com
   ```

   **Setup Steps:**
   1. Generate Fernet key using Python:
      ```python
      from cryptography.fernet import Fernet
      key = Fernet.generate_key().decode()
      print(f"ENCRYPTION_KEY={key}")
      ```
   2. Download Firebase service key from Firebase Console
   3. Add both to your `.env` file

## 🎯 Usage

### Starting the Server

```bash
python main.py
```

The server will start on `http://localhost:8004` (or your specified PORT).

### API Endpoints

#### POST /invoke
Main agent interaction endpoint using LangChain's AgentExecutor.

**Request Body**:
```json
{
  "user_email": "user@example.com",
  "key_type": "gemini_api_key",
  "task": "Create outreach emails for potential clients in the tech industry",
  "context": "I'm a freelance web developer looking for new projects",
  "previous_convo": "Optional: Previous conversation history"
}
```

**Supported key_type values:**
- `"gemini_api_key"` - Uses Google Gemini models
- `"deepseek_v3_key"` - Uses DeepSeek v3 via OpenRouter

**Note:** API keys are stored encrypted in Firestore and fetched automatically. Never send actual API keys in requests!

**Response for Email Creation** (Agent uses `create_email_drafts` tool):
```json
{
  "success": true,
  "message": "✅ Successfully created 3 email draft(s)!\n📝 Draft IDs: abc-123, def-456, ghi-789",
  "action_taken": "agent_execution",
  "drafts_created": 3,
  "draft_ids": ["abc-123", "def-456", "ghi-789"]
}
```

**Response for Direct Advice** (Agent responds without tools):
```json
{
  "success": true,
  "message": "Here are some tips for writing effective cold emails:\n1. Keep subject lines under 50 characters...",
  "action_taken": "agent_execution",
  "drafts_created": null,
  "draft_ids": null
}
```

**Response for Greeting**:
```json
{
  "success": true,
  "message": "👋 Hi! I'm Spidey, your email buddy. I love helping with emails...",
  "action_taken": "agent_execution",
  "drafts_created": null,
  "draft_ids": null
}
```

#### GET /health
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "agent": "Spidey",
  "version": "2.0.0",
  "framework": "LangChain"
}
```

#### GET /
Root endpoint with agent information and capabilities.

## 🧠 LangChain Agent Architecture

### Multi-Model Support

Spidey supports multiple AI models with automatic selection:

- **Gemini** (Google): Professional, accurate, paid models
- **DeepSeek v3** (via OpenRouter): Fast, cost-effective, free tier available

Models are selected based on `key_type` in the request and automatically fall back if unavailable.

### ReAct Pattern

Spidey uses LangChain's **ReAct (Reasoning + Acting)** pattern:

```
User Request → Model Selection → Agent Reasoning → Tool Selection → Tool Execution → Final Answer
```

### Agent Workflow:

1. **Request**: User sends task with `key_type`
2. **Key Fetch**: Encrypted API key retrieved from Firestore
3. **Model Init**: Appropriate AI model initialized (Gemini/DeepSeek)
4. **Thought**: Agent analyzes the user's request
5. **Action**: Decides whether to use a tool or respond directly
6. **Action Input**: Prepares tool parameters if needed
7. **Observation**: Processes tool execution results
8. **Final Answer**: Provides response to the user

### Available Tools:

#### `create_email_drafts`
- **Type**: `StructuredTool` with defined input schema
- **Description**: Creates multiple email drafts via email management API
- **Input Schema**:
  ```python
  {
    "user_email": str,
    "drafts": List[Dict[str, str]]  # Each with to_email, subject, body
  }
  ```
- **When Used**: When user explicitly requests to CREATE/WRITE/DRAFT/GENERATE emails

### Agent Guidelines:

- **Use Tools**: Only when explicitly creating email drafts
- **Direct Response**: For advice, questions, tips, and general guidance
- **Clarification**: Ask follow-up questions when information is missing
- **User-Friendly**: Never expose system internals or technical details

## 🔧 Integration

Spidey integrates with the Email Management Service for draft storage:
- **Default URL**: `https://superspidey-email-management.onrender.com`
- **Endpoint Used**: `POST /create-multi-draft`

### Tool Implementation

Tools are implemented using LangChain's `StructuredTool`:

```python
from langchain.tools import StructuredTool
from langchain.pydantic_v1 import BaseModel

class EmailDraftInput(BaseModel):
    user_email: str
    drafts: List[Dict[str, str]]

create_email_drafts_tool = StructuredTool.from_function(
    func=_create_email_drafts_impl,
    name="create_email_drafts",
    description="Create multiple email drafts...",
    args_schema=EmailDraftInput
)
```

## 📝 Example Interactions

### 1. Simple Greeting
```json
{
  "task": "Hi"
}
```
Agent responds with friendly introduction without using tools.

### 2. Email Advice
```json
{
  "task": "How do I write better cold outreach emails?"
}
```
Agent provides direct guidance without using tools.

### 3. Draft Creation
```json
{
  "task": "Create 3 outreach emails for tech startups",
  "context": "I'm a UI/UX designer, targeting Series A companies"
}
```
Agent uses `create_email_drafts` tool to generate and store drafts.

### 4. Job Application
```json
{
  "task": "Write a job application email for a senior developer role",
  "context": "5 years React experience, looking for remote fintech positions"
}
```
Agent uses `create_email_drafts` tool with job application context.

## 🎨 Spidey's Personality

Spidey is designed to be:
- **Friendly & Approachable**: Like a helpful email buddy
- **Professional**: Maintains appropriate business tone in drafts
- **Helpful**: Proactively suggests improvements
- **Conversational**: Natural dialogue, not robotic
- **User-Focused**: Speaks to end users, not developers

**Key Principle**: Spidey acts as an assistant, not a system. It never exposes internal workings, prompt details, or technical architecture to users.

## 🔒 Security

### API Key Management
- **Encrypted Storage**: API keys encrypted with Fernet before Firestore storage
- **Server-Side Decryption**: Keys decrypted only in memory, never exposed to frontend
- **Per-Request Authentication**: Keys fetched fresh for each request
- **Multi-Tenant Isolation**: Each user has isolated encrypted keys

### Agent Security
- **Agent Caching**: Instances cached by API key hash (not the key itself)
- **Memory Isolation**: Decrypted keys never persist in memory
- **Request Scoping**: Keys used only for the duration of the request

### Network & Data Security
- **HTTPS Only**: All external API calls use HTTPS
- **Input Validation**: Pydantic models for request validation
- **Data Sanitization**: User inputs cleaned (max lengths, whitespace removal)
- **CORS Configuration**: Restricted to allowed origins
- **Firebase Security**: Service account keys properly managed

## 🚀 Deployment

### Local Development
```bash
python main.py
```

### Production (Render)

**Build Command**:
```bash
pip install -r requirements.txt
```

**Start Command**:
```bash
python main.py
```

**Environment Variables** (Required):
- `FIREBASE_SERVICE_KEY_PATH`: Path to Firebase service account key (upload as secret file)
- `ENCRYPTION_KEY`: Fernet encryption key (generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)

**Environment Variables** (Optional):
- `PORT`: Server port (default: 8004)
- `EMAIL_MANAGEMENT_BASE_URL`: Email API URL (default: https://superspidey-email-management.onrender.com)

### Scaling Considerations

The LangChain agent framework provides:
- **Extensibility**: Easy to add new tools
- **Maintainability**: Clear separation of concerns (tools, agents, main)
- **Scalability**: Agent caching and stateless design
- **Observability**: Built-in LangChain logging and callbacks

## 🧪 Testing

### Prerequisites

Before testing, ensure you have:

1. **Firebase Setup**: Service account key and Firestore access
2. **Encryption Key**: Generated with Fernet (see installation steps above)
3. **API Keys**: Encrypted and stored in Firestore using oauth_storage service
4. **Environment Variables**:
   ```bash
   export FIREBASE_SERVICE_KEY_PATH=/path/to/access-key.json
   export ENCRYPTION_KEY='your_fernet_key_here'
   export EMAIL_MANAGEMENT_BASE_URL=https://superspidey-email-management.onrender.com
   ```

### Run Tests

```bash
# Test the server health
curl http://localhost:8004/health

# Test agent with stored keys
curl -X POST http://localhost:8004/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "test@example.com",
    "key_type": "gemini_api_key",
    "task": "Hi"
  }'

# Run comprehensive test suite
python test_langchain_agent.py
```

## 📊 Monitoring

- **Health Check**: `GET /health` for uptime monitoring
- **Structured Logging**: Agent execution traces and errors
- **Error Handling**: User-friendly error messages for API issues
- **Performance**: Agent caching reduces initialization overhead

## 🔮 Future Enhancements

Potential additions to Spidey:

1. **More Tools**:
   - `send_email`: Direct email sending
   - `fetch_templates`: Retrieve email templates
   - `analyze_performance`: Email campaign analytics

2. **Enhanced Memory**:
   - Persistent conversation history
   - User preferences and style learning

3. **Advanced Orchestration**:
   - Multi-tool workflows (draft → review → send)
   - Conditional tool chaining

4. **Integration**:
   - CRM systems (Salesforce, HubSpot)
   - Calendar scheduling
   - Email tracking and analytics

## 🤝 Contributing

To add new tools:

1. Create tool in `tools/` directory
2. Define input schema with Pydantic
3. Implement tool function
4. Wrap with `StructuredTool.from_function()`
5. Add to agent's tool list in `main.py`

Example:
```python
# tools/new_tool.py
from langchain.tools import StructuredTool
from langchain.pydantic_v1 import BaseModel

class NewToolInput(BaseModel):
    param1: str
    param2: int

def _new_tool_impl(param1: str, param2: int) -> str:
    # Implementation
    return "Result"

new_tool = StructuredTool.from_function(
    func=_new_tool_impl,
    name="new_tool",
    description="What this tool does",
    args_schema=NewToolInput
)
```

## 📄 License

This project is part of the ContactRemedy suite.

---

## 📚 Additional Documentation

- **[API_KEY_STORAGE.md](./API_KEY_STORAGE.md)** - Complete API key storage and encryption guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[GET_API_KEY.md](./GET_API_KEY.md)** - How to obtain API keys
- **[CHANGELOG_v2.1.0.md](./CHANGELOG_v2.1.0.md)** - Version 2.1.0 changelog
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Migration guide

---

**Spidey v2.1.0 is ready to help you automate your email outreach using secure, multi-model AI! 🕷️🤖**

*Powered by LangChain, FastAPI, Gemini AI, and DeepSeek AI with secure encrypted key storage*
