# Google OAuth Storage Service

A FastAPI service for storing Google OAuth credentials and encrypted keys in Firestore.

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

### PUT /store-key
Store or update an encrypted key for a user. Useful for updating expired keys.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "key_type": "api_key",
  "key_value": "your-secret-key-here"
}
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "key_type": "api_key",
  "message": "Key stored successfully"
}
```

### GET /check-keys/{user_email}
Get all available keys for a user.

**Path Parameters:**
- `user_email`: The email address of the user

**Response when keys exist:**
```json
{
  "user_email": "user@example.com",
  "available_keys": ["gemini_api_key", "another_key_type"],
  "current_selected_key": "gemini_api_key"
}
```

**Response when no keys exist:**
```json
{
  "user_email": "user@example.com",
  "available_keys": [],
  "current_selected_key": null
}
```

### PUT /set-current-key/{user_email}
Set the current selected key for a user.

**Path Parameters:**
- `user_email`: The email address of the user

**Request Body:**
```json
{
  "current_selected_key": "gemini_api_key"
}
```

**Allowed Key Types:**
- `gemini_api_key`
- `deepseek_v3_key`

**Response:**
```json
{
  "user_email": "user@example.com",
  "current_selected_key": "gemini_api_key",
  "message": "Current selected key updated successfully"
}
```

**Error Response (400):**
```json
{
  "detail": "Invalid key type. Must be one of: gemini_api_key, deepseek_v3_key"
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
  - `keys`: Object containing encrypted keys
    - `key_type_1`: Encrypted key value
    - `key_type_2`: Encrypted key value
    - ...
  - `current_selected_key`: Currently selected key type (e.g., "gemini_api_key" or "deepseek_v3_key")

## Environment Variables

The service requires the following environment variables:

- `service_key`: Firebase service account key as JSON string
- `ENCRYPTION_KEY`: Base64-encoded Fernet key for encrypting/decrypting keys

To generate an ENCRYPTION_KEY:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
