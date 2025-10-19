# Google OAuth Storage Service

A FastAPI service for storing Google OAuth credentials in Firestore.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure `access-key.json` is in the same directory as `main.py`

3. The OAuth configuration in `server/routes.ts` is set to always request refresh tokens:
   - `accessType: 'offline'` - Requests offline access
   - `prompt: 'consent'` - Forces consent screen to ensure refresh token

## Running the Service

```bash
python main.py
```

The service will start on `http://localhost:8000`

## API Endpoints

### POST /store-auth
Store Google OAuth credentials for a user.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "oauth_token": "ya29.xxx",
  "refresh_token": "1//xxx"  // Now always provided due to OAuth config
}
```

**Response:**
```json
{
  "message": "OAuth credentials stored successfully",
  "user_email": "user@example.com"
}
```

### GET /get-auth/{user_email}
Retrieve Google OAuth credentials for a user.

**Path Parameter:**
- `user_email`: The email address of the user

**Response:**
```json
{
  "user_email": "user@example.com",
  "oauth": "ya29.xxx",
  "refresh_token": "1//xxx"  // Always provided due to OAuth configuration
}
```

**Error Response (404):**
```json
{
  "detail": "OAuth credentials not found for this user"
}
```

### GET /health
Health check endpoint.

## Firestore Structure

Collection: `google_oauth_credentials`
- Document ID: User email
- Fields:
  - `oauth`: OAuth access token
  - `refresh_token`: Refresh token
