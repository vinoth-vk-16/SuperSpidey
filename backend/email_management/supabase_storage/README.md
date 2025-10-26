# Supabase Storage Module

This module handles resume storage and management using Supabase Storage.

## Features

- **Upload Resume**: Upload PDF resumes to Supabase storage with unique identifiers
- **Delete Resume**: Remove resumes from Supabase storage
- **Generate Signed URLs**: Create temporary download links for resumes

## Configuration

Add the following environment variables to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
```

## Storage Structure

Resumes are stored in the `Resume` bucket with the following structure:

```
Resume/
  └── user@example.com/
      └── uuid.pdf
```

## Firebase Integration

The resume path is stored in Firebase Firestore under the user's document:

```json
{
  "user_email": "users/{user_email}",
  "Resume": "Resume/user@example.com/uuid.pdf",
  "user_name": "...",
  "user_info": "...",
  "style": "..."
}
```

## API Endpoints

### 1. Store Resume

**POST** `/store-resume`

Upload a resume PDF and store its path in Firebase.

**Form Data:**
- `user_email` (string): User's email address
- `file` (file): PDF file to upload

**Response:**
```json
{
  "user_email": "user@example.com",
  "message": "Resume stored successfully",
  "success": true
}
```

**Example (cURL):**
```bash
curl -X POST "http://localhost:8001/store-resume" \
  -F "user_email=user@example.com" \
  -F "file=@/path/to/resume.pdf"
```

---

### 2. Delete Resume

**DELETE** `/delete-resume`

Delete a resume from both Supabase storage and Firebase.

**Request Body:**
```json
{
  "user_email": "user@example.com"
}
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "message": "Resume deleted successfully",
  "success": true
}
```

**Example (cURL):**
```bash
curl -X DELETE "http://localhost:8001/delete-resume" \
  -H "Content-Type: application/json" \
  -d '{"user_email": "user@example.com"}'
```

---

### 3. Get Resume URL

**GET** `/get-resume-url/{user_email}`

Get a signed download URL for a user's resume (valid for 1 hour).

**Response:**
```json
{
  "user_email": "user@example.com",
  "signed_url": "https://your-project.supabase.co/storage/v1/object/sign/Resume/...",
  "expires_in": 3600,
  "message": "Resume URL generated successfully"
}
```

**Example (cURL):**
```bash
curl "http://localhost:8001/get-resume-url/user@example.com"
```

## File Validation

- **Allowed Format**: PDF only
- **Max File Size**: 10MB
- **Storage**: Private bucket (requires signed URLs for access)

## Error Handling

- **400**: Invalid file format or file too large
- **404**: User not found or no resume exists
- **500**: Server error (Supabase or Firebase failure)

## Transaction Safety

The module implements rollback logic:
- If Firebase update fails after Supabase upload, the uploaded file is automatically deleted
- If Supabase deletion fails, Firebase is still updated to maintain consistency

## Dependencies

```txt
supabase>=2.0.0
fastapi
python-dotenv
firebase-admin
```

Install with:
```bash
pip install supabase
```

