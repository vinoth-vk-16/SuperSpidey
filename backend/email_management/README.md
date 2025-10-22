# Email Management Service

A FastAPI service for sending emails using stored OAuth credentials from Firestore.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure `access-key.json` is in the same directory as `main.py`

3. Ensure the OAuth storage service is running on port 8000

## Running the Service

### Local Development
```bash
python main.py
```
The service will start on `http://localhost:8001`

### Production
The service is deployed on Render at: `https://superspidey-email-management.onrender.com`

**API Base URL:** `https://superspidey-email-management.onrender.com`

## API Endpoints

### POST /send-email
Send an email using the user's stored OAuth credentials.

**Request Body:**
```json
{
  "user_email": "sender@example.com",
  "to_email": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email body content",
  "tracker_id": "unique-tracker-12345",  // Required - stored for frontend email tracking
  "cc": ["cc@example.com"],               // Optional
  "bcc": ["bcc@example.com"]              // Optional
}
```

**Response:**
```json
{
  "message_id": "1234567890abcdef",
  "success": true
}
```

**Error Responses:**
- `401`: Authentication expired - user needs to re-authenticate
- `404`: User credentials not found in Firestore
- `500`: Failed to send email or other server errors

### POST /send-reply-email
Send a reply email in an existing thread using the user's stored OAuth credentials.

**Request Body:**
```json
{
  "user_email": "sender@example.com",
  "thread_id": "thread1234567890",      // Required - thread to reply to
  "to_email": "recipient@example.com",
  "subject": "Re: Original Subject",
  "body": "Reply content here...",
  "tracker_id": "unique-tracker-12345"  // Required - stored for frontend email tracking
}
```

**Response:**
```json
{
  "message_id": "1234567890abcdef",
  "success": true
}
```

**Thread Support:**
This endpoint sends emails as replies in existing Gmail threads. The email will appear in the same conversation and maintain proper threading in Gmail.

**Error Responses:**
- `400`: Missing required fields (thread_id, etc.)
- `401`: Authentication expired - user needs to re-authenticate
- `404`: User credentials or thread not found
- `500`: Failed to send reply email

### POST /create-draft
Create a single email draft and store it in Firestore.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "to_email": "recipient@example.com",    // Optional
  "subject": "Draft Email Subject",       // Optional
  "body": "Draft email content..."        // Optional
}
```

**Note:** All fields except `user_email` are optional for single draft creation.

**Response:**
```json
{
  "draft_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_email": "user@example.com",
  "success": true,
  "message": "Draft created successfully"
}
```

**Storage:** `users/{user_email}/drafts/{draft_id}/content/data`

**Error Responses:**
- `500`: Failed to create draft

### POST /create-multi-draft
Create multiple email drafts at once and store them in Firestore.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "drafts": [
    {
      "user_email": "user@example.com",
      "to_email": "recipient1@example.com",  // Required
      "subject": "First Draft",             // Required
      "body": "First draft content..."      // Required
    },
    {
      "user_email": "user@example.com",
      "to_email": "recipient2@example.com",  // Required
      "subject": "Second Draft",             // Required
      "body": "Second draft content..."      // Required
    }
  ]
}
```

**Note:** All fields in each draft item are required for multi-draft creation.

**Response:**
```json
{
  "user_email": "user@example.com",
  "drafts_created": 2,
  "draft_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ],
  "success": true,
  "message": "Successfully created 2 draft(s)"
}
```

**Storage:** Each draft stored as `users/{user_email}/drafts/{draft_id}/content/data`

**Error Responses:**
- `500`: Failed to create drafts

### POST /fetch-drafts
Fetch paginated email drafts for a user from Firestore (30 drafts per page).

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "page": 1
}
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "drafts": [
    {
      "draft_id": "550e8400-e29b-41d4-a716-446655440000",
      "to_email": "recipient@example.com",
      "subject": "Draft Subject",
      "body": "Draft content...",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total_count": 1,
  "page": 1,
  "has_more": false
}
```

**Parameters:**
- `user_email`: User's email address (required)
- `page`: Page number starting from 1 (optional, defaults to 1)

**Pagination:**
- Returns 30 drafts per page
- `has_more`: Boolean indicating if there are more pages available
- `total_count`: Total number of drafts for the user

**Response Fields:**
- `draft_id`: Unique identifier for the draft
- `to_email`, `subject`, `body`: Draft content (may be null for partial drafts)
- `created_at`, `updated_at`: Timestamps (ISO format)

**Error Responses:**
- `400`: Invalid page number (must be 1 or greater)
- `500`: Failed to fetch drafts

### POST /fetch-emails
Fetch paginated email threads for a user from Firestore, automatically refreshing from Gmail first to ensure latest data.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "page": 1
}
```

**Response:**
```json
{
  "threads": [
    {
      "threadId": "thread123",
      "subject": "Email Subject",
      "from": "sender@example.com",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "messageCount": 3,
      "isRead": false,
      "messages": [
        {
          "messageId": "msg456",
          "threadId": "thread123",
          "from": "sender@example.com",
          "to": ["recipient@example.com"],
          "subject": "Email Subject",
          "snippet": "Short preview of email...",
          "body": "Full email content...",
          "timestamp": "2024-01-01T12:00:00.000Z",
          "isRead": false,
          "isSent": false,
          "view_status": false  // Optional - only present for emails sent via the app
        }
      ]
    }
  ],
  "total_count": 45,
  "page": 1,
  "has_more": true
}
```

**Features:**
- Groups emails by thread (conversation)
- Returns 30 threads per page
- Sorted by latest message timestamp (most recent first)
- Pagination support (page 1, 2, 3, etc.)
- Thread-level read status (true if all messages in thread are read)
- Simplified email structure for frontend display
- **Auto-refresh**: Automatically syncs with Gmail before fetching to ensure latest emails
- **View Status Tracking**: Optional `view_status` field for emails sent via the app (indicates if opened)

### POST /refresh-emails
Refresh emails for a user from Gmail API after the lastSyncTimestamp, filtering by custom header.

**Request Body:**
```json
{
  "user_email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "message": "Successfully synced 5 emails from Gmail",
  "emails_synced": 5,
  "last_sync_timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Response (No User):**
```json
{
  "message": "no emails present",
  "emails_synced": 0,
  "last_sync_timestamp": ""
}
```

**Features:**
- Fetches ALL emails from Gmail API after `lastSyncTimestamp`
- Maps email thread IDs with existing threads in database
- Syncs emails that belong to existing conversations (captures replies)
- Also establishes new threads from app-sent emails (with custom header)
- Filters out emails already stored in database
- If no user entry exists, returns "no emails present"
- Only updates `lastSyncTimestamp` when emails are actually synced
- Handles token refresh automatically
- Returns existing timestamp if no new emails found

### POST /gmail-webhook
Handle Gmail Pub/Sub notifications for real-time email synchronization.

**Request Body:**
```json
{
  "message": {
    "attributes": {},
    "data": "eyJlbWFpbEFkZHJlc3MiOiJ1c2VyQGV4YW1wbGUuY29tIiwiaGlzdG9yeUlkIjoiMTIzNDU2Nzg5MCJ9",
    "messageId": "1234567890123456",
    "message_id": "1234567890123456",
    "publishTime": "2025-10-19T11:00:00Z"
  },
  "subscription": "projects/your-project/subscriptions/your-subscription"
}
```

**Response:**
```json
{
  "status": "processed",
  "user_email": "user@example.com",
  "history_id": "1234567890",
  "emails_synced": 2
}
```

**Features:**
- Decodes base64-encoded notification data
- Uses Gmail History API to fetch new messages
- Only syncs emails that belong to existing conversation threads
- Filters out duplicate messages
- Updates `lastSyncTimestamp` when emails are synced
- Handles token refresh automatically

### POST /start-watch
Start Gmail watch for a user to enable real-time email notifications.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "access_token": "ya29.a0ARrdaM....",
  "topic_name": "projects/contact-remedy/topics/gmail-notifications"
}
```

**Note:** `topic_name` is optional and defaults to `projects/contact-remedy/topics/gmail-notifications`

**Response (Success):**
```json
{
  "message": "Watch started successfully",
  "data": {
    "history_id": "123456789",
    "expiry": 1734803940,
    "enabled": true,
    "topic_name": "projects/contact-remedy/topics/gmail-notifications"
  }
}
```

**Response (Already Active):**
```json
{
  "message": "Watch already active",
  "data": {
    "history_id": "123456789",
    "expiry": 1734803940,
    "enabled": true
  }
}
```

**Features:**
- Checks if user already has an active watch before starting new one
- Calls Gmail Watch API to subscribe to INBOX notifications
- Stores watch state in database (gmail-watch.enabled, expiry, history_id)
- Returns existing watch info if already active

### POST /generate-email
Generate email draft using Gemini AI. Supports optional user context and previous conversation context for more personalized and relevant emails.

**Request Body:**
```json
{
  "prompt": "Write a professional email to request a meeting with the CEO",
  "api_key": "your-gemini-api-key",
  "context": "I am a software developer at TechCorp, specializing in AI applications",  // Optional: User context for personalization
  "previous_email_context": "Previous email thread content here..."  // Optional: Previous emails in the thread for better context
}
```

**Response:**
```json
{
  "subject": "Request for Meeting with CEO",
  "body": "Dear [CEO Name],\n\nI hope this email finds you well..."
}
```

**Features:**
- Generates complete professional emails with subject and body
- Uses Gemini AI for intelligent content generation
- Handles various email types and scenarios

### POST /improve-email
Improve or modify email content using Gemini AI with different actions. Returns clean, properly formatted email content without explanations or multiple options. Supports optional user context and previous conversation context for more personalized improvements.

**Request Body:**
```json
{
  "text": "Your email content here...",
  "action": "improve",  // Options: write, shorten, simplify, improve, lengthen, fix-grammar, rewrite, custom
  "api_key": "your-gemini-api-key",
  "custom_prompt": "optional custom prompt for 'custom' action",
  "context": "I am a software developer at TechCorp, specializing in AI applications",  // Optional: User context for personalization
  "previous_email_context": "Previous email thread content here..."  // Optional: Previous emails in the thread for better context
}
```

**Response:**
```json
{
  "subject": "",
  "body": "Improved email content..."
}
```

**Available Actions:**
- `write`: Generate a new email from scratch
- `shorten`: Make email more concise
- `simplify`: Simplify language and structure
- `improve`: Enhance writing style and professionalism
- `lengthen`: Add more detail and context
- `fix-grammar`: Correct spelling and grammar
- `rewrite`: Rewrite in conversational tone
- `custom`: Use custom prompt

### POST /save-user-info
Save user information including name, personal details, and writing style preferences.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "user_info": "Software developer at TechCorp, specializes in AI applications",
  "style": "professional, concise, technical"
}
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "user_info": "Software developer at TechCorp, specializes in AI applications",
  "style": "professional, concise, technical",
  "message": "User information saved successfully"
}
```

**Notes:**
- Stores data in Firestore `users` collection under the email document ID
- Merges with existing data (preserves `gmail-watch`, `lastSyncTimestamp`, etc.)
- All fields are required for initial save

### POST /update-user-info
Update user information selectively. Only provided fields will be updated.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "user_name": "Jane Doe",  // Optional - only update if provided
  "style": "casual, friendly"  // Optional - only update if provided
}
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "user_name": "Jane Doe",
  "user_info": "Software developer at TechCorp, specializes in AI applications",
  "style": "casual, friendly",
  "message": "User information updated successfully"
}
```

**Notes:**
- All fields are optional - only send what you want to update
- At least one field must be provided
- Returns the complete updated user information

### GET /fetch-user-info/{user_email}
Fetch user information including name, personal details, and writing style preferences.

**URL Parameters:**
- `user_email`: The email address of the user to fetch information for

**Response:**
```json
{
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "user_info": "Software developer at TechCorp, specializes in AI applications",
  "style": "professional, concise, technical",
  "found": true,
  "message": "User information retrieved successfully"
}
```

**Notes:**
- Returns empty strings for all fields if user information is not found
- `found` field indicates whether user data exists
- Useful for retrieving user preferences for AI email generation

### POST /mark-email-read
Mark a specific email as read by updating the isRead status from false to true.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "message_id": "18c1b4f2e3d4a5b6"
}
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "message_id": "18c1b4f2e3d4a5b6",
  "success": true,
  "message": "Email marked as read successfully"
}
```

**Notes:**
- Updates the `isRead` field in the user's email document
- Returns 404 if the email doesn't exist
- Useful for marking emails as read in the UI

### GET /track-email-view/{tracker_id}
Track email opens/views by updating view_status using the unique tracker ID. Returns a 1x1 transparent tracking pixel.

**URL Parameters:**
- `tracker_id`: The unique tracker ID sent from frontend during email sending

**Query Parameters:**
- `user_email`: The sender's email address (required for efficient querying)

**Example:**
```
GET /track-email-view/unique-tracker-12345?user_email=sender@example.com
```

**Response:**
Returns a 1x1 transparent PNG pixel image.

**Behavior:**
- Updates `view_status` from `false` to `true` for the email with matching tracker_id
- Logs tracking data including IP, user-agent, and timestamp
- Stores tracking history in `view_tracking` array
- Queries the specific user's email collection for efficient lookup
- Always returns pixel image regardless of success/failure

**Note:** Tracking pixels are embedded in sent emails for open tracking. The endpoint prevents false positives by only updating view_status when accessed from legitimate email clients.

**Tracking Data Stored:**
```json
{
  "view_status": true,
  "view_tracking": [
    {
      "ip": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2025-01-01T12:00:00",
      "viewed_at": "Firestore timestamp"
    }
  ]
}
```

## Features

- **Token Management**: Automatically refreshes expired access tokens using refresh tokens
- **Credential Updates**: Stores updated tokens back to Firestore after refresh
- **Email Formatting**: Converts plain text to HTML with proper formatting
- **Custom Headers**: Adds `X-MyApp-ID: ContactSpidey` header to track sent emails
- **Email Parsing**: Properly decodes HTML entities, cleans email addresses (removes `<>` brackets), and removes reply formatting from received emails
- **CC/BCC Support**: Optional carbon copy and blind carbon copy recipients
- **Database Storage**: Automatically stores sent emails in Firestore with full metadata

## Firestore Data Structure

When emails are sent, they are automatically stored in Firestore with the following structure:

```
Collection: users
  Document ID: <user_email>
    Fields:
      - displayName: string
      - photoURL: string
      - lastSyncTimestamp: timestamp

    Subcollection: emails
      Document ID: <email_message_id>
        Fields:
          - messageId: string
          - threadId: string
          - from: string
          - to: [string]
          - cc: [string] (optional)
          - bcc: [string] (optional)
          - subject: string
          - snippet: string
          - body: string
          - headers: map
          - labels: [string]
          - isRead: boolean
          - isSent: boolean
          - timestamp: timestamp
          - threadMessagesCount: number
```

## Dependencies

- Google Gmail API - for sending emails
- Firestore - for credential and email data storage (direct access)

## Email Format

Emails are formatted as HTML with:
- Professional styling
- Proper paragraph breaks
- Line breaks within paragraphs
- Custom header for tracking

## Security

- Uses OAuth2 credentials stored securely in Firestore
- Automatic token refresh when expired
- Validates user authentication before sending emails
