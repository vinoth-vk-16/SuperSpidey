# Google OAuth Storage Service

A FastAPI service for storing Google OAuth credentials in Firestore.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
   - `service_key`: Your Firebase service account JSON string

## Deployment

### Render Deployment

1. **Create a new Web Service** on Render

2. **Connect your repository** and set the following:

   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

3. **Add Environment Variables**:
   - `service_key`: Your Firebase service account JSON string
   - `PORT`: (Render sets this automatically)

### Local Development

```bash
pip install -r requirements.txt
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
