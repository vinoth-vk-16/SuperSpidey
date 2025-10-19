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

- OAuth Storage Service (port 8000) - for retrieving/storing user credentials
- Google Gmail API - for sending emails
- Firestore - for credential and email data storage

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
