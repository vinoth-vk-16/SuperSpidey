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

```bash
python main.py
```

The service will start on `http://localhost:8001`

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
  "cc": ["cc@example.com"],     // Optional
  "bcc": ["bcc@example.com"]    // Optional
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

### POST /fetch-emails
Fetch paginated emails for a user from Firestore (not from Gmail).

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
  "emails": [
    {
      "messageId": "1234567890abcdef",
      "threadId": "thread123",
      "from_": "sender@example.com",
      "to": ["recipient@example.com"],
      "subject": "Email Subject",
      "snippet": "Short preview of email...",
      "body": "Full email content...",
      "headers": {
        "X-MyApp-ID": "ContactSpidey",
        "Date": "2024-01-01T12:00:00.000Z",
        "From": "sender@example.com",
        "To": "recipient@example.com",
        "Subject": "Email Subject"
      },
      "labels": ["SENT"],
      "isRead": true,
      "isSent": true,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "threadMessagesCount": 1,
      "cc": ["cc@example.com"],
      "bcc": ["bcc@example.com"]
    }
  ],
  "total_count": 150,
  "page": 1,
  "has_more": true
}
```

**Features:**
- Returns 30 emails per page
- Sorted by timestamp (most recent first)
- Pagination support (page 1, 2, 3, etc.)
- Includes CC/BCC fields when available

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

## Features

- **Token Management**: Automatically refreshes expired access tokens using refresh tokens
- **Credential Updates**: Stores updated tokens back to Firestore after refresh
- **Email Formatting**: Converts plain text to HTML with proper formatting
- **Custom Headers**: Adds `X-MyApp-ID: ContactSpidey` header to track sent emails
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
