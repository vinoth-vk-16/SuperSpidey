from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests
import google.auth.transport.requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import base64
import os
import json
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load Firebase service account key from environment
service_key_env = os.getenv('service_key')
if not service_key_env:
    raise Exception("service_key environment variable not found. Make sure it's set in the .env file")

firebase_credentials = json.loads(service_key_env)
cred = credentials.Certificate(firebase_credentials)
firebase_admin.initialize_app(cred)

# Initialize Firestore client
db = firestore.client()

# Load Google OAuth configuration from environment
vite_google_cred = os.getenv('VITE_GOOGLE_CRED')
if not vite_google_cred:
    raise Exception("VITE_GOOGLE_CRED environment variable not found. Make sure it's set in the .env file")

google_credentials = json.loads(vite_google_cred)
google_config = google_credentials.get('web', {})

print("Firebase service account loaded successfully")
print("Google OAuth Config loaded:", {
    "clientID": google_config.get('client_id', 'NOT_SET')[:10] + '...',
    "clientSecret": '***' if google_config.get('client_secret') else 'NOT_SET',
    "redirectURI": google_config.get('redirect_uris', ['NOT_SET'])[1] if len(google_config.get('redirect_uris', [])) > 1 else 'NOT_SET'
})

app = FastAPI(title="Email Management Service", version="1.0.0")

class SendEmailRequest(BaseModel):
    user_email: str
    to_email: str
    subject: str
    body: str
    bcc: Optional[List[str]] = None
    cc: Optional[List[str]] = None

class EmailResponse(BaseModel):
    message_id: str
    success: bool

def get_user_credentials(user_email: str):
    """Get user OAuth credentials from the oauth storage service"""
    try:
        response = requests.get(f'http://localhost:8000/get-auth/{user_email}')
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user credentials: {str(e)}")

def store_updated_credentials(user_email: str, access_token: str, refresh_token: Optional[str] = None):
    """Store updated OAuth credentials"""
    try:
        data = {
            "user_email": user_email,
            "oauth_token": access_token
        }
        if refresh_token:
            data["refresh_token"] = refresh_token

        response = requests.post('http://localhost:8000/store-auth', json=data)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Warning: Failed to store updated credentials: {str(e)}")

def refresh_access_token(refresh_token: str):
    """Refresh access token using refresh token"""
    # This would typically use Google's token endpoint
    # For now, we'll let the Google API client handle refresh automatically
    pass

def create_message(sender: str, to: str, subject: str, body: str, cc: Optional[List[str]] = None, bcc: Optional[List[str]] = None):
    """Create a message for an email"""
    # Convert plain text to HTML with proper formatting (same as routes.ts)
    def format_email_body(text: str):
        # Split by double newlines for paragraphs, single newlines for line breaks
        html_body = text.split('\n\n')  # Split paragraphs
        html_body = [
            paragraph.split('\n')  # Split lines within paragraph
            for paragraph in html_body
        ]
        html_body = [
            [line.strip() for line in paragraph if line.strip()]
            for paragraph in html_body
        ]
        html_body = [
            '<br>'.join(paragraph)
            for paragraph in html_body
            if paragraph
        ]
        html_body = [
            f'<p style="margin: 0 0 1em 0; line-height: 1.5;">{paragraph}</p>'
            for paragraph in html_body
        ]

        # Wrap in a styled container
        return f'''
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
            {''.join(html_body)}
          </div>
        '''.strip()

    formatted_body = format_email_body(body)

    # Build email headers
    headers = [
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        f'To: {to}',
        f'From: {sender}',
        f'Subject: {subject}',
        'X-MyApp-ID: ContactSpidey'
    ]

    # Add CC if provided
    if cc:
        headers.append(f'CC: {", ".join(cc)}')

    # Add BCC if provided
    if bcc:
        headers.append(f'BCC: {", ".join(bcc)}')

    # Combine headers and body
    email_content = '\r\n'.join(headers) + '\r\n\r\n' + formatted_body

    # Encode the email
    encoded_email = base64.urlsafe_b64encode(email_content.encode('utf-8')).decode('utf-8')

    return {'raw': encoded_email}

def store_email_in_firestore(user_email: str, message_id: str, email_data: Dict[str, Any]):
    """Store email data in Firestore"""
    try:
        # Create/update user document
        user_ref = db.collection('users').document(user_email)
        user_data = {
            'lastSyncTimestamp': firestore.SERVER_TIMESTAMP
        }

        # Try to get existing user data
        user_doc = user_ref.get()
        if user_doc.exists:
            existing_data = user_doc.to_dict()
            if existing_data.get('displayName'):
                user_data['displayName'] = existing_data['displayName']
            if existing_data.get('photoURL'):
                user_data['photoURL'] = existing_data['photoURL']

        user_ref.set(user_data, merge=True)

        # Store email in subcollection
        email_ref = user_ref.collection('emails').document(message_id)

        # Prepare email data for storage
        firestore_email_data = {
            'messageId': email_data['messageId'],
            'threadId': email_data.get('threadId', ''),
            'from': email_data['from'],
            'to': email_data['to'],
            'subject': email_data['subject'],
            'snippet': email_data.get('snippet', ''),
            'body': email_data['body'],
            'headers': email_data['headers'],
            'labels': email_data.get('labels', ['SENT']),
            'isRead': True,  # Sent emails are read by default
            'isSent': True,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'threadMessagesCount': 1
        }

        # Add optional fields
        if email_data.get('cc'):
            firestore_email_data['cc'] = email_data['cc']
        if email_data.get('bcc'):
            firestore_email_data['bcc'] = email_data['bcc']
        if email_data.get('attachments'):
            firestore_email_data['attachments'] = email_data['attachments']

        email_ref.set(firestore_email_data)

        print(f"Email stored in Firestore: {message_id} for user: {user_email}")
        return True

    except Exception as e:
        print(f"Error storing email in Firestore: {e}")
        return False

@app.post("/send-email")
async def send_email(request: SendEmailRequest):
    """Send an email using the user's stored OAuth credentials"""
    try:
        # Get user credentials
        user_creds = get_user_credentials(request.user_email)

        if not user_creds.get('oauth'):
            raise HTTPException(status_code=404, detail="User credentials not found")

        # Create OAuth2 credentials with proper client configuration
        creds = Credentials(
            token=user_creds['oauth'],
            refresh_token=user_creds.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=google_config.get('client_id'),
            client_secret=google_config.get('client_secret')
        )

        # Refresh token if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(google.auth.transport.requests.Request())
            # Store updated credentials
            store_updated_credentials(
                request.user_email,
                creds.token,
                creds.refresh_token
            )

        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)

        # Create the email message
        message = create_message(
            sender=request.user_email,
            to=request.to_email,
            subject=request.subject,
            body=request.body,
            cc=request.cc,
            bcc=request.bcc
        )

        # Send the email
        try:
            result = service.users().messages().send(
                userId='me',
                body=message
            ).execute()

            print(f'Email sent successfully with ID: {result["id"]}')

            # Verify the message was sent with our custom header
            try:
                sent_message = service.users().messages().get(
                    userId='me',
                    id=result['id'],
                    format='metadata',
                    metadataHeaders=['X-MyApp-ID', 'Subject', 'From', 'To']
                ).execute()

                headers = sent_message.get('payload', {}).get('headers', [])
                print('Sent message headers:', [f"{h['name']}: {h['value']}" for h in headers])

            except HttpError as e:
                print(f'Error verifying sent message headers: {e}')

            # Store email data in Firestore
            email_data = {
                'messageId': result['id'],
                'threadId': result.get('threadId', ''),
                'from': request.user_email,
                'to': [request.to_email],
                'subject': request.subject,
                'body': request.body,
                'snippet': request.body[:100] + ('...' if len(request.body) > 100 else ''),
                'headers': {
                    'X-MyApp-ID': 'ContactSpidey',
                    'Date': datetime.now().isoformat(),
                    'From': request.user_email,
                    'To': request.to_email,
                    'Subject': request.subject
                },
                'labels': ['SENT'],
                'isRead': True,
                'isSent': True,
                'timestamp': datetime.now()
            }

            # Add CC and BCC if provided
            if request.cc:
                email_data['cc'] = request.cc
                email_data['to'].extend(request.cc)
            if request.bcc:
                email_data['bcc'] = request.bcc
                email_data['to'].extend(request.bcc)

            # Store in Firestore
            store_success = store_email_in_firestore(request.user_email, result['id'], email_data)
            if not store_success:
                print(f"Warning: Email sent but failed to store in database: {result['id']}")

            return EmailResponse(message_id=result['id'], success=True)

        except HttpError as e:
            print(f'Error sending email: {e}')
            if e.resp.status == 401:  # Unauthorized - likely token expired
                raise HTTPException(status_code=401, detail="Authentication expired. Please re-authenticate.")
            raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        print(f'Unexpected error: {e}')
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
