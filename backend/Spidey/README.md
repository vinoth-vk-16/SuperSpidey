# 🕷️ Spidey - Email Automation Agent

Spidey is an intelligent MCP (Model Context Protocol) server built with Python, LangChain, and Gemini AI. It specializes in email automation, lead generation, and professional outreach.

## 🚀 Features

- **Email Draft Creation**: Generate multiple personalized email drafts
- **Lead Generation**: Craft compelling outreach emails for potential clients
- **Job Applications**: Assist with job application emails and follow-ups
- **Professional Communication**: Ensure well-structured, effective emails
- **Strategic Planning**: Suggest email sequences and campaign strategies

## 🛠️ Technology Stack

- **FastAPI**: Web framework for the MCP server
- **LangChain**: Agent orchestration and tool management
- **Gemini AI**: Large language model for intelligent responses
- **Pydantic**: Data validation and serialization
- **Requests**: HTTP client for API calls

## 📦 Installation

1. **Install Dependencies**:
   ```bash
   cd Spidey
   pip install -r requirements.txt
   ```

2. **Environment Setup**:
   ```bash
   # Optional: Set custom port
   export PORT=8002
   ```

## 🎯 Usage

### Starting the Server

```bash
python main.py
```

The server will start on `http://localhost:8004` (or your specified PORT).

### API Endpoints

#### POST /invoke
Main agent interaction endpoint.

**Request Body**:
```json
{
  "user_email": "user@example.com",
  "gemini_api_key": "your_gemini_api_key",
  "task": "Create outreach emails for potential clients in the tech industry",
  "context": "I'm a freelance web developer looking for new projects",
  "previous_convo": "Optional: Previous conversation history for better context"
}
```

**Response**:
```json
{
  "success": true,
  "message": "I've created 3 personalized outreach email drafts for tech industry clients...",
  "action_taken": "Created email drafts",
  "drafts_created": 3,
  "draft_ids": ["uuid1", "uuid2", "uuid3"],
  "questions": null
}
```

**Or when more information is needed**:
```json
{
  "success": true,
  "message": "I need recipient email addresses to create effective drafts...",
  "action_taken": "need_info",
  "drafts_created": null,
  "draft_ids": null,
  "questions": [
    "What are the recipient email addresses?",
    "What type of emails do you want to create?"
  ]
}
```

#### GET /health
Health check endpoint.

#### GET /
Root endpoint with agent information.

## 🧠 Spidey's Capabilities

### Email Types Spidey Can Help With:

1. **Cold Outreach**
   - Lead generation emails
   - Partnership proposals
   - Client acquisition

2. **Job Applications**
   - Application emails
   - Follow-up messages
   - Thank you notes

3. **Professional Networking**
   - LinkedIn connection requests
   - Industry networking
   - Conference follow-ups

4. **Email Campaigns**
   - Multi-email sequences
   - Drip campaigns
   - Newsletter content

### Spidey's Workflow:

1. **Analyze**: Understands your email requirements
2. **Gather**: Asks for recipient details and context when needed
3. **Create**: Generates professional email content
4. **Execute**: Creates and saves email drafts automatically

## 🔧 Integration

Spidey integrates with the Email Management Service at:
`https://superspidey-email-management.onrender.com`

### Available Tools:

- **create_email_drafts**: Creates multiple email drafts using the `/create-multi-draft` endpoint

## 📝 Example Interactions

### Lead Generation
```json
{
  "task": "Create 5 outreach emails for SaaS companies",
  "context": "I offer UI/UX design services, targeting Series A startups"
}
```

### Job Applications
```json
{
  "task": "Help me apply for senior developer positions",
  "context": "5 years experience in React and Node.js, looking for remote work"
}
```

### Follow-up Campaigns
```json
{
  "task": "Create a follow-up sequence for cold leads",
  "context": "Initial emails sent last week, need 3 follow-up emails spaced 1 week apart"
}
```

## 🎨 Spidey's Personality

- **Professional**: Maintains business-appropriate tone
- **Strategic**: Thinks about email effectiveness and conversion
- **Helpful**: Proactively suggests improvements
- **Detail-oriented**: Ensures all emails are well-crafted
- **Results-focused**: Optimizes for responses and engagement

## 🔒 Security

- Gemini API keys are passed per request (not stored)
- No persistent storage of sensitive data
- All API calls use HTTPS
- Request validation with Pydantic models

## 🚀 Deployment

### Local Development
```bash
python main.py
```

### Production (Render/Heroku)
```bash
# Procfile
web: python main.py
```

Environment variables:
- `PORT`: Server port (optional, defaults to 8002)

## 📊 Monitoring

- Health check endpoint: `GET /health`
- Structured logging for debugging
- Error handling with detailed messages

## 🤝 Contributing

Spidey is designed to be extensible. You can:

1. Add new tools for different email services
2. Enhance the system prompt for better responses
3. Integrate with additional APIs (CRM, analytics, etc.)
4. Add new email templates and strategies

## 📄 License

This project is part of the ContactRemedy suite.

---

**Spidey is ready to help you automate your email outreach and generate more leads! 🕷️📧**
