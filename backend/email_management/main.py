from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
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
import time
from dotenv import load_dotenv
import google.generativeai as genai
import html
from email.utils import parseaddr

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

def clean_email_address(email_str):
    """Clean email address by removing angle brackets and extra formatting"""
    if not email_str:
        return email_str

    # Parse the email address to extract just the email part
    parsed_name, parsed_email = parseaddr(email_str)

    # If we got a clean email, return it
    if parsed_email and '@' in parsed_email:
        return parsed_email

    # Otherwise, try to extract from angle brackets
    angle_bracket_match = re.search(r'<([^>]+)>', email_str)
    if angle_bracket_match:
        return angle_bracket_match.group(1).strip()

    # If no angle brackets, return as-is but cleaned
    return email_str.strip()

def clean_email_body(body_text):
    """Clean email body by decoding HTML entities and removing reply formatting"""
    if not body_text:
        return body_text

    # Decode HTML entities
    cleaned = html.unescape(body_text)

    # Remove common email reply patterns
    # Remove "On [date] [person] wrote:" patterns
    cleaned = re.sub(r'On\s+[^>]*wrote:\s*', '', cleaned, flags=re.IGNORECASE | re.MULTILINE)

    # Remove angle bracket email formatting in reply lines
    cleaned = re.sub(r'<([^>]+@[^>]+)>', r'\1', cleaned)

    # Clean up multiple spaces and normalize line breaks
    cleaned = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned)  # Multiple blank lines to double
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)  # Multiple spaces to single

    return cleaned.strip()

print("Firebase service account loaded successfully")
print("Google OAuth Config loaded:", {
    "clientID": google_config.get('client_id', 'NOT_SET')[:10] + '...',
    "clientSecret": '***' if google_config.get('client_secret') else 'NOT_SET',
    "redirectURI": google_config.get('redirect_uris', ['NOT_SET'])[1] if len(google_config.get('redirect_uris', [])) > 1 else 'NOT_SET'
})

def clean_response_text(text: str) -> str:
    """Clean raw response text and remove subject lines"""
    cleaned = text.strip()

    # Remove any subject lines that might be present
    cleaned = re.sub(r'^Subject:\s*.*\n?', '', cleaned, flags=re.MULTILINE | re.IGNORECASE)
    cleaned = re.sub(r'^Re:\s*.*\n?', '', cleaned, flags=re.MULTILINE | re.IGNORECASE)
    cleaned = re.sub(r'^Fw:\s*.*\n?', '', cleaned, flags=re.MULTILINE | re.IGNORECASE)

    # Remove any remaining leading/trailing whitespace
    return cleaned.strip()

async def generate_email_draft(prompt: str, api_key: str, context: Optional[str] = None, previous_email_context: Optional[str] = None) -> Dict[str, str]:
    """Generate email draft using Gemini AI"""
    try:
        if not api_key or api_key.strip() == '':
            raise HTTPException(status_code=400, detail="API key is required")

        genai.configure(api_key=api_key)
        
        # Try multiple models with fallback (newest to oldest)
        model_names = [
            'gemini-2.0-flash-exp',  # Latest experimental model
            'gemini-exp-1206',        # December 2024 experimental
            'gemini-1.5-pro',         # Stable Pro model
            'gemini-pro'              # Fallback to older stable model
        ]
        
        model = None
        last_error = None
        
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                print(f"✅ Using Gemini model: {model_name}")
                break
            except Exception as e:
                last_error = e
                print(f"⚠️ Model {model_name} not available: {str(e)}")
                continue
        
        if model is None:
            raise HTTPException(
                status_code=503, 
                detail=f"No Gemini models available. Last error: {str(last_error)}"
            )

        system_prompt = """Consider your job is to generate complete professional emails based on query. Make sure the email is concise and to the point. If you need to mention names anywhere, just fill them as {user name}, {receiver name}, {company name}. Important: never respond with any follow-up or random content, and make sure if there isn't a meaningful query then response must be "give a proper query"."""

        # Add user context if provided
        if context:
            system_prompt += f"\n\nUSER CONTEXT: {context}"

        # Add previous email context if provided
        if previous_email_context:
            system_prompt += f"\n\nPREVIOUS CONVERSATION CONTEXT: {previous_email_context}\n\nUse this conversation history to generate a more relevant and contextual email response."

        system_prompt += """

CRITICAL: Respond with a JSON object containing both subject and body fields. Structure your response EXACTLY like this:
{
  "subject": "Brief descriptive subject line",
  "body": "Complete email body starting with greeting and ending with proper signature"
}

The body should be a complete email with proper closing like "Thanks" or "Best regards" followed by {user name} at the end. The email should be professional and appropriate for business communication with complete structure including greeting, body, and proper closing with signature. NEVER include subject lines or headers in the body field."""

        result = model.generate_content(f"{system_prompt}\n\nUser query: {prompt}")
        response = result.text

        # Clean up response text - remove code fences and extra whitespace
        cleaned_text = response.strip()

        # Remove markdown code fences if present
        if cleaned_text.startswith('```json'):
            cleaned_text = cleaned_text.replace('```json\n', '').replace('\n```', '')
        elif cleaned_text.startswith('```'):
            cleaned_text = cleaned_text.replace('```\n', '').replace('\n```', '')

        # Try to extract JSON object if wrapped in other text
        json_match = re.search(r'\{[\s\S]*\}', cleaned_text)
        if json_match:
            cleaned_text = json_match.group(0)

        try:
            parsed_response = json.loads(cleaned_text)

            if parsed_response.get('body') and parsed_response.get('subject'):
                return {
                    'subject': parsed_response['subject'],
                    'body': parsed_response['body']
                }
            elif parsed_response.get('body'):
                return {
                    'subject': '',
                    'body': parsed_response['body']
                }
            else:
                # Fallback if no body field
                return {
                    'subject': '',
                    'body': clean_response_text(response)
                }
        except json.JSONDecodeError:
            # Fallback to raw response if JSON parsing fails
            return {
                'subject': '',
                'body': clean_response_text(response)
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate email draft: {str(e)}")

async def improve_email(text: str, action: str, api_key: str, custom_prompt: Optional[str] = None, context: Optional[str] = None, previous_email_context: Optional[str] = None) -> str:
    """Improve email using Gemini AI"""
    try:
        if not api_key or api_key.strip() == '':
            raise HTTPException(status_code=400, detail="API key is required")

        genai.configure(api_key=api_key)
        
        # Try multiple models with fallback (newest to oldest)
        model_names = [
            'gemini-2.0-flash-exp',  # Latest experimental model
            'gemini-exp-1206',        # December 2024 experimental
            'gemini-1.5-pro',         # Stable Pro model
            'gemini-pro'              # Fallback to older stable model
        ]
        
        model = None
        last_error = None
        
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                print(f"✅ Using Gemini model: {model_name}")
                break
            except Exception as e:
                last_error = e
                print(f"⚠️ Model {model_name} not available: {str(e)}")
                continue
        
        if model is None:
            raise HTTPException(
                status_code=503, 
                detail=f"No Gemini models available. Last error: {str(last_error)}"
            )

        # If custom prompt is provided, use it directly but add output format instructions
        if custom_prompt and action == "custom":
            action_prompt = f"""{custom_prompt}

CRITICAL: Respond ONLY with the email content. Do not include any explanations, options, or additional text. Just return the email."""
        else:
            # Use predefined prompts with structured output format
            action_prompts = {
                "improve": """Improve the writing style, clarity, and professionalism of this email while maintaining its meaning. Keep it concise and to the point.

CRITICAL: Respond ONLY with the improved email content. Do not include any explanations, options, or additional text. Just return the cleaned, improved email.""",
                "shorten": """Make this email more concise while preserving all important information.

CRITICAL: Respond ONLY with the shortened email content. Do not include any explanations, options, or additional text. Just return the concise email.""",
                "lengthen": """Expand this email with more detail and context while maintaining professionalism.

CRITICAL: Respond ONLY with the expanded email content. Do not include any explanations, options, or additional text. Just return the detailed email.""",
                "fix-grammar": """Fix any spelling, grammar, and punctuation errors in this email.

CRITICAL: Respond ONLY with the corrected email content. Do not include any explanations, options, or additional text. Just return the corrected email.""",
                "simplify": """Simplify the language and structure of this email to make it easier to understand.

CRITICAL: Respond ONLY with the simplified email content. Do not include any explanations, options, or additional text. Just return the simplified email.""",
                "rewrite": """Rewrite this email in a more natural, conversational tone while keeping it professional.

CRITICAL: Respond ONLY with the rewritten email content. Do not include any explanations, options, or additional text. Just return the rewritten email.""",
                "write": """Write a complete professional email based on this prompt.

CRITICAL: Respond ONLY with the email content. Do not include any explanations, options, or additional text. Just return the email."""
            }
            action_prompt = action_prompts.get(action, """Improve this email.

CRITICAL: Respond ONLY with the improved email content. Do not include any explanations, options, or additional text. Just return the cleaned email.""")

        # Build the final prompt with context
        final_prompt = action_prompt

        # Add user context if provided
        if context:
            final_prompt += f"\n\nUSER CONTEXT: {context}"

        # Add previous email context if provided
        if previous_email_context:
            final_prompt += f"\n\nPREVIOUS CONVERSATION CONTEXT: {previous_email_context}\n\nUse this conversation history to improve the email with better context and relevance."

        final_prompt += f"\n\n{text}"

        result = model.generate_content(final_prompt)
        response = result.text

        return response or "Failed to improve email"

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to improve email: {str(e)}")

app = FastAPI(title="Email Management Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow specific origins and localhost
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class SendEmailRequest(BaseModel):
    user_email: str
    to_email: str
    subject: str
    body: str
    tracker_id: str  # Unique tracker ID from frontend for email tracking
    bcc: Optional[List[str]] = None
    cc: Optional[List[str]] = None
    thread_id: Optional[str] = None  # For replying to existing threads

class FetchEmailsRequest(BaseModel):
    user_email: str
    page: int = 1  # Page number starting from 1

class RefreshEmailsRequest(BaseModel):
    user_email: str

class EmailResponse(BaseModel):
    message_id: str
    success: bool

class SimplifiedEmail(BaseModel):
    messageId: str
    threadId: str
    from_: str  # 'from' is a reserved keyword in Python
    to: List[str]
    subject: str
    snippet: str
    body: str  # Full email body
    timestamp: str  # ISO format string
    isRead: bool
    isSent: bool
    view_status: Optional[bool] = None  # Whether the email has been viewed/opened (only for app-sent emails)

class ThreadGroup(BaseModel):
    threadId: str
    subject: str
    from_: str
    timestamp: str  # Latest message timestamp
    messageCount: int
    isRead: bool  # True if all messages in thread are read
    messages: List[SimplifiedEmail]

class FetchEmailsResponse(BaseModel):
    threads: List[ThreadGroup]
    total_count: int
    page: int
    has_more: bool

class RefreshEmailsResponse(BaseModel):
    message: str
    emails_synced: int
    last_sync_timestamp: str

class GmailWebhookRequest(BaseModel):
    message: Dict[str, Any]
    subscription: str

class GenerateEmailRequest(BaseModel):
    prompt: str
    api_key: str
    context: Optional[str] = None  # Context about the user to personalize the email
    previous_email_context: Optional[str] = None  # Previous emails in the thread for better context

class GenerateEmailResponse(BaseModel):
    subject: str
    body: str

class ImproveEmailRequest(BaseModel):
    text: str
    action: str  # write, shorten, simplify, improve, lengthen, fix-grammar, rewrite, custom
    api_key: str
    custom_prompt: Optional[str] = None
    context: Optional[str] = None  # Context about the user to personalize the email
    previous_email_context: Optional[str] = None  # Previous emails in the thread for better context

class ImproveEmailResponse(BaseModel):
    subject: str
    body: str

class SaveUserInfoRequest(BaseModel):
    user_email: str
    user_name: str
    user_info: str
    style: str

class UpdateUserInfoRequest(BaseModel):
    user_email: str
    user_name: Optional[str] = None
    user_info: Optional[str] = None
    style: Optional[str] = None

class UserInfoResponse(BaseModel):
    user_email: str
    user_name: str
    user_info: str
    style: str
    message: str

class MarkEmailReadRequest(BaseModel):
    user_email: str
    message_id: str

class MarkEmailReadResponse(BaseModel):
    user_email: str
    message_id: str
    success: bool
    message: str

class FetchUserInfoResponse(BaseModel):
    user_email: str
    user_name: str
    user_info: str
    style: str
    found: bool
    message: str

class StartWatchRequest(BaseModel):
    user_email: str
    access_token: str
    topic_name: str = "projects/contact-remedy/topics/gmail-notifications"

def get_user_credentials(user_email: str):
    """Get user OAuth credentials directly from Firestore google_oauth_credentials collection"""
    try:
        # Reference to the document with user email as ID in google_oauth_credentials collection
        doc_ref = db.collection('google_oauth_credentials').document(user_email)

        # Get the document
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="OAuth credentials not found for this user")

        data = doc.to_dict()

        return {
            'oauth': data.get('oauth', ''),
            'refresh_token': data.get('refresh_token')
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user credentials: {str(e)}")

def store_updated_credentials(user_email: str, access_token: str, refresh_token: Optional[str] = None):
    """Store updated OAuth credentials directly in Firestore"""
    try:
        # Reference to the document with user email as ID
        doc_ref = db.collection('google_oauth_credentials').document(user_email)

        # Data to store
        oauth_data = {
            'oauth': access_token,
        }

        # Only include refresh_token if it exists
        if refresh_token:
            oauth_data['refresh_token'] = refresh_token

        # Set the document
        doc_ref.set(oauth_data)

        print(f"Updated OAuth credentials for user: {user_email}")
        return {"message": "OAuth credentials updated successfully", "user_email": user_email}
    except Exception as e:
        print(f"Warning: Failed to store updated credentials: {str(e)}")

def refresh_access_token(refresh_token: str):
    """Refresh access token using refresh token"""
    # This would typically use Google's token endpoint
    # For now, we'll let the Google API client handle refresh automatically
    pass

def create_message(sender: str, to: str, subject: str, body: str, cc: Optional[List[str]] = None, bcc: Optional[List[str]] = None, thread_id: Optional[str] = None):
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
            'trackerId': email_data.get('trackerId', ''),  # Store the unique tracker ID
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

        # Add view_status if present (for app-sent emails)
        if 'view_status' in email_data:
            firestore_email_data['view_status'] = email_data['view_status']

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

def fetch_user_emails(user_email: str, page: int = 1, per_page: int = 30):
    """Fetch paginated emails grouped by thread for a user from Firestore"""
    try:
        # Reference to user's emails subcollection
        emails_ref = db.collection('users').document(user_email).collection('emails')

        # Get all emails first (since Firestore doesn't have efficient offset)
        query = emails_ref.order_by('timestamp', direction=firestore.Query.DESCENDING)
        all_emails = []
        for doc in query.stream():
            email_data = doc.to_dict()
            all_emails.append(email_data)

        # Group emails by thread
        thread_groups = {}
        for email_data in all_emails:
            thread_id = email_data.get('threadId', email_data.get('messageId', ''))
            if thread_id not in thread_groups:
                thread_groups[thread_id] = []

            # Create simplified email object
            simplified_email = {
                'messageId': email_data.get('messageId', ''),
                'threadId': thread_id,
                'from_': email_data.get('from', ''),
                'to': email_data.get('to', []),
                'subject': email_data.get('subject', ''),
                'snippet': email_data.get('snippet', ''),
                'body': email_data.get('body', ''),  # Include full email body
                'timestamp': email_data.get('timestamp', datetime.now()).isoformat() if hasattr(email_data.get('timestamp'), 'isoformat') else str(email_data.get('timestamp', '')),
                'isRead': email_data.get('isRead', False),
                'isSent': email_data.get('isSent', False)
            }

            # Only include view_status if it exists (only for emails sent via the app)
            if 'view_status' in email_data:
                simplified_email['view_status'] = email_data['view_status']
            thread_groups[thread_id].append(simplified_email)

        # Convert thread groups to ThreadGroup objects
        threads = []
        for thread_id, messages in thread_groups.items():
            if not messages:
                continue

            # Sort messages by timestamp (newest first)
            messages.sort(key=lambda x: x['timestamp'], reverse=True)

            # Thread info from the latest message
            latest_message = messages[0]
            all_read = all(msg['isRead'] for msg in messages)

            thread_group = ThreadGroup(
                threadId=thread_id,
                subject=latest_message['subject'],
                from_=latest_message['from_'],
                timestamp=latest_message['timestamp'],
                messageCount=len(messages),
                isRead=all_read,
                messages=[SimplifiedEmail(**msg) for msg in messages]
            )
            threads.append(thread_group)

        # Sort threads by latest message timestamp (newest first)
        threads.sort(key=lambda x: x.timestamp, reverse=True)

        # Apply pagination at thread level
        total_threads = len(threads)
        offset = (page - 1) * per_page
        limit = per_page
        paginated_threads = threads[offset:offset + limit]

        # Check if there are more pages
        has_more = offset + limit < total_threads

        return FetchEmailsResponse(
            threads=paginated_threads,
            total_count=total_threads,
            page=page,
            has_more=has_more
        )

    except Exception as e:
        print(f"Error fetching emails for user {user_email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")

def refresh_user_emails_from_gmail(user_email: str):
    """Refresh emails for a user from Gmail API after lastSyncTimestamp"""
    try:
        # Check if user exists in Firestore
        user_ref = db.collection('users').document(user_email)
        user_doc = user_ref.get()

        if not user_doc.exists:
            return RefreshEmailsResponse(
                message="no emails present",
                emails_synced=0,
                last_sync_timestamp=""
            )

        user_data = user_doc.to_dict()
        last_sync_timestamp = user_data.get('lastSyncTimestamp')

        if not last_sync_timestamp:
            # If no lastSyncTimestamp, use a default (e.g., 30 days ago)
            from datetime import datetime, timedelta
            last_sync_timestamp = datetime.now() - timedelta(days=30)

        # Get user credentials
        user_creds = get_user_credentials(user_email)

        if not user_creds.get('oauth'):
            raise HTTPException(status_code=404, detail="User credentials not found")

        # Create OAuth2 credentials
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
                user_email,
                creds.token,
                creds.refresh_token
            )

        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)

        # Convert timestamp to Gmail query format (Unix timestamp)
        if hasattr(last_sync_timestamp, 'timestamp'):
            # Firestore timestamp - convert to Unix timestamp
            query_timestamp = int(last_sync_timestamp.timestamp())
        else:
            # datetime object - convert to Unix timestamp
            query_timestamp = int(last_sync_timestamp.timestamp())

        # Get all existing thread IDs from Firestore for comparison
        existing_thread_ids = set()
        emails_ref = user_ref.collection('emails')

        for doc in emails_ref.stream():
            email_data = doc.to_dict()
            thread_id = email_data.get('threadId')
            if thread_id:
                existing_thread_ids.add(thread_id)

        print(f"Found {len(existing_thread_ids)} existing thread IDs in database")

        # Step 1: Fetch ALL emails after lastSyncTimestamp (no filtering yet)
        query = f'after:{query_timestamp}'
        print(f"Step 1: Fetching ALL emails after timestamp with query: {query}")

        all_messages = []
        page_token = None

        while True:
            results = service.users().messages().list(
                userId='me',
                q=query,
                pageToken=page_token,
                maxResults=100
            ).execute()

            all_messages.extend(results.get('messages', []))
            page_token = results.get('nextPageToken')

            if not page_token:
                break

        print(f"Step 1: Found {len(all_messages)} total messages after timestamp")

        # Step 2: Filter out messages we already have in the database
        existing_message_ids = set()
        for doc in emails_ref.stream():
            existing_message_ids.add(doc.id)

        messages_not_in_db = [msg for msg in all_messages if msg['id'] not in existing_message_ids]
        print(f"Step 2: After filtering existing messages: {len(messages_not_in_db)} messages not in database")

        # Step 3: Map thread IDs and filter emails that belong to existing conversations
        # Gmail API messages.list() already includes threadId, no extra API calls needed!
        new_messages = []

        for message in messages_not_in_db:
            message_thread_id = message.get('threadId')

            # Check if this email's thread matches any existing thread in our database
            if message_thread_id and message_thread_id in existing_thread_ids:
                new_messages.append(message)
                print(f"Found matching thread: {message['id']} in thread {message_thread_id}")

        # If no existing threads, we need to check for app-sent emails to establish new threads
        if not existing_thread_ids and len(messages_not_in_db) > 0:
            print("No existing threads found, checking for app-sent emails to establish new threads")

            # Check first few messages for custom header to establish threads
            for message in messages_not_in_db[:10]:  # Check first 10 messages
                try:
                    msg_detail = service.users().messages().get(
                        userId='me',
                        id=message['id'],
                        format='full'
                    ).execute()

                    # Check if this message has our custom header
                    payload = msg_detail.get('payload', {})
                    headers = payload.get('headers', [])
                    has_custom_header = any(
                        h.get('name') == 'X-MyApp-ID' and h.get('value') == 'ContactSpidey'
                        for h in headers
                    )

                    if has_custom_header:
                        new_messages.append(message)
                        print(f"Found app-sent email to establish new thread: {message['id']}")

                except Exception as e:
                    print(f"Error checking custom header for {message['id']}: {e}")
                    continue

        print(f"Step 3: Final filtered messages to sync: {len(new_messages)}")

        # Process and store emails
        emails_synced = 0

        for message in new_messages:
            try:
                # Get full message details
                msg_detail = service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='full'
                ).execute()

                # Parse email data
                payload = msg_detail.get('payload', {})
                headers = payload.get('headers', [])

                # Extract header values
                subject = ''
                from_addr = ''
                to_addr = []
                cc_addr = []
                bcc_addr = []
                date = ''

                for header in headers:
                    name = header.get('name', '').lower()
                    value = header.get('value', '')

                    if name == 'subject':
                        subject = value
                    elif name == 'from':
                        from_addr = clean_email_address(value)
                    elif name == 'to':
                        to_addr = [clean_email_address(email.strip()) for email in value.split(',') if email.strip()]
                    elif name == 'cc':
                        cc_addr = [clean_email_address(email.strip()) for email in value.split(',') if email.strip()]
                    elif name == 'bcc':
                        bcc_addr = [clean_email_address(email.strip()) for email in value.split(',') if email.strip()]
                    elif name == 'date':
                        date = value

                # Get email body
                body = ''
                if payload.get('body', {}).get('data'):
                    body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
                elif payload.get('parts'):
                    for part in payload['parts']:
                        if part.get('mimeType') == 'text/plain' and part.get('body', {}).get('data'):
                            body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                            break
                        elif part.get('mimeType') == 'text/html' and part.get('body', {}).get('data'):
                            body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                            break

                # Clean the email body
                body = clean_email_body(body)

                # Create email data for Firestore
                email_data = {
                    'messageId': message['id'],
                    'threadId': msg_detail.get('threadId', ''),
                    'from': from_addr,
                    'to': to_addr,
                    'subject': subject,
                    'body': body,
                    'snippet': clean_email_body(msg_detail.get('snippet', '')),
                    'headers': {
                        'X-MyApp-ID': 'ContactSpidey',
                        'Date': date,
                        'From': from_addr,
                        'To': ', '.join(to_addr),
                        'Subject': subject
                    } if not cc_addr and not bcc_addr else {
                        'X-MyApp-ID': 'ContactSpidey',
                        'Date': date,
                        'From': from_addr,
                        'To': ', '.join(to_addr),
                        'Subject': subject,
                        'CC': ', '.join(cc_addr) if cc_addr else None,
                        'BCC': ', '.join(bcc_addr) if bcc_addr else None
                    },
                    'labels': msg_detail.get('labelIds', []),
                    'isRead': 'UNREAD' not in msg_detail.get('labelIds', []),
                    'isSent': 'SENT' in msg_detail.get('labelIds', []),
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'threadMessagesCount': 1
                }

                # Add CC and BCC if present
                if cc_addr:
                    email_data['cc'] = cc_addr
                    email_data['headers']['CC'] = ', '.join(cc_addr)
                if bcc_addr:
                    email_data['bcc'] = bcc_addr
                    email_data['headers']['BCC'] = ', '.join(bcc_addr)

                # Store email in Firestore
                email_ref = user_ref.collection('emails').document(message['id'])
                email_ref.set(email_data)

                emails_synced += 1

            except Exception as e:
                print(f"Error processing message {message['id']}: {e}")
                continue

        # Only update lastSyncTimestamp if emails were actually synced
        updated_timestamp = ""
        if emails_synced > 0:
            # Update lastSyncTimestamp only if emails were synced
            user_ref.update({
                'lastSyncTimestamp': firestore.SERVER_TIMESTAMP
            })

            # Get the updated timestamp for response
            updated_user_doc = user_ref.get()
            if updated_user_doc.exists:
                updated_data = updated_user_doc.to_dict()
                if updated_data.get('lastSyncTimestamp'):
                    timestamp_obj = updated_data['lastSyncTimestamp']
                    if hasattr(timestamp_obj, 'isoformat'):
                        updated_timestamp = timestamp_obj.isoformat()
                    else:
                        updated_timestamp = str(timestamp_obj)
        else:
            # No emails synced, keep the existing timestamp for response
            updated_timestamp = last_sync_timestamp.isoformat() if hasattr(last_sync_timestamp, 'isoformat') else str(last_sync_timestamp)

        return RefreshEmailsResponse(
            message=f"Successfully synced {emails_synced} emails from Gmail",
            emails_synced=emails_synced,
            last_sync_timestamp=updated_timestamp
        )

    except Exception as e:
        print(f"Error refreshing emails for user {user_email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh emails: {str(e)}")

def process_gmail_webhook_notification(user_email: str, history_id: str):
    """Process Gmail webhook notification and sync relevant emails"""
    try:
        # Get user credentials
        user_creds = get_user_credentials(user_email)

        if not user_creds.get('oauth'):
            print(f"No credentials found for user {user_email}")
            return 0

        # Create OAuth2 credentials
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
            store_updated_credentials(user_email, creds.token, creds.refresh_token)

        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)

        # Get existing thread IDs and message IDs from database
        existing_thread_ids = set()
        existing_message_ids = set()
        user_ref = db.collection('users').document(user_email)
        emails_ref = user_ref.collection('emails')

        for doc in emails_ref.stream():
            email_data = doc.to_dict()
            existing_message_ids.add(doc.id)
            if email_data.get('threadId'):
                existing_thread_ids.add(email_data['threadId'])

        print(f"User {user_email} has {len(existing_thread_ids)} threads and {len(existing_message_ids)} messages in DB")

        # Use Gmail history API to get changes since the historyId
        history_response = service.users().history().list(
            userId='me',
            startHistoryId=history_id,
            historyTypes=['messageAdded']
        ).execute()

        new_emails_count = 0
        history_items = history_response.get('history', [])

        for history_item in history_items:
            messages_added = history_item.get('messagesAdded', [])

            for message_added in messages_added:
                message = message_added.get('message', {})
                message_id = message.get('id')
                thread_id = message.get('threadId')

                # Check if message already exists
                if message_id in existing_message_ids:
                    print(f"Message {message_id} already exists, skipping")
                    continue

                # Check if thread exists in our database
                if thread_id and thread_id in existing_thread_ids:
                    print(f"Processing new message {message_id} in existing thread {thread_id}")

                    # Fetch full message details
                    try:
                        msg_detail = service.users().messages().get(
                            userId='me',
                            id=message_id,
                            format='full'
                        ).execute()

                        # Parse email data (same logic as refresh function)
                        payload = msg_detail.get('payload', {})
                        headers = payload.get('headers', [])

                        subject = ''
                        from_addr = ''
                        to_addr = []
                        cc_addr = []
                        bcc_addr = []
                        date = ''

                        for header in headers:
                            name = header.get('name', '').lower()
                            value = header.get('value', '')

                            if name == 'subject':
                                subject = value
                            elif name == 'from':
                                from_addr = value
                            elif name == 'to':
                                to_addr = [email.strip() for email in value.split(',')]
                            elif name == 'cc':
                                cc_addr = [email.strip() for email in value.split(',')]
                            elif name == 'bcc':
                                bcc_addr = [email.strip() for email in value.split(',')]
                            elif name == 'date':
                                date = value

                        # Get email body
                        body = ''
                        if payload.get('body', {}).get('data'):
                            body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
                        elif payload.get('parts'):
                            for part in payload['parts']:
                                if part.get('mimeType') == 'text/plain' and part.get('body', {}).get('data'):
                                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                                    break
                                elif part.get('mimeType') == 'text/html' and part.get('body', {}).get('data'):
                                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                                    break

                        # Create email data for Firestore
                        email_data = {
                            'messageId': message_id,
                            'threadId': thread_id,
                            'from': from_addr,
                            'to': to_addr,
                            'subject': subject,
                            'body': body,
                            'snippet': msg_detail.get('snippet', ''),
                            'headers': {
                                'Date': date,
                                'From': from_addr,
                                'To': ', '.join(to_addr),
                                'Subject': subject
                            },
                            'labels': msg_detail.get('labelIds', []),
                            'isRead': 'UNREAD' not in msg_detail.get('labelIds', []),
                            'isSent': 'SENT' in msg_detail.get('labelIds', []),
                            'timestamp': firestore.SERVER_TIMESTAMP,
                            'threadMessagesCount': 1
                        }

                        # Add CC and BCC if present
                        if cc_addr:
                            email_data['cc'] = cc_addr
                            email_data['headers']['CC'] = ', '.join(cc_addr)
                        if bcc_addr:
                            email_data['bcc'] = bcc_addr
                            email_data['headers']['BCC'] = ', '.join(bcc_addr)

                        # Store email in Firestore
                        email_ref = emails_ref.document(message_id)
                        email_ref.set(email_data)

                        new_emails_count += 1
                        print(f"Stored new email {message_id} for user {user_email}")

                    except Exception as e:
                        print(f"Error processing message {message_id}: {e}")
                        continue
                else:
                    print(f"Message {message_id} thread {thread_id} not in existing threads, skipping")

        # Update lastSyncTimestamp since we processed new emails
        if new_emails_count > 0:
            user_ref.update({
                'lastSyncTimestamp': firestore.SERVER_TIMESTAMP
            })
            print(f"Updated lastSyncTimestamp for user {user_email}")

        return new_emails_count

    except Exception as e:
        print(f"Error processing Gmail webhook for user {user_email}: {e}")
        return 0

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
            bcc=request.bcc,
            thread_id=request.thread_id
        )

        # Send the email
        try:
            # Prepare send request body
            send_request = {
                'userId': 'me',
                'body': message
            }

            # Add threadId if this is a reply
            if request.thread_id:
                send_request['body']['threadId'] = request.thread_id
                print(f'Sending reply to thread: {request.thread_id}')

            result = service.users().messages().send(**send_request).execute()

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
                'threadId': result.get('threadId', request.thread_id or ''),
                'trackerId': request.tracker_id,  # Store the unique tracker ID from frontend
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
                'view_status': False,
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

@app.post("/fetch-emails")
async def fetch_emails(request: FetchEmailsRequest):
    """Fetch paginated emails for a user from Firestore, automatically refreshing from Gmail first"""
    try:
        # Validate page number
        if request.page < 1:
            raise HTTPException(status_code=400, detail="Page number must be 1 or greater")

        # Always refresh emails from Gmail first to ensure latest data
        try:
            print(f"🔄 Auto-refreshing emails for user: {request.user_email}")
            refresh_result = refresh_user_emails_from_gmail(request.user_email)
            print(f"✅ Auto-refresh completed: {refresh_result.message}")
        except Exception as refresh_error:
            print(f"⚠️ Auto-refresh failed for {request.user_email}: {str(refresh_error)}")
            # Continue with fetching cached emails even if refresh fails

        # Fetch emails from Firestore (now with latest data if refresh succeeded)
        result = fetch_user_emails(request.user_email, request.page, 30)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in fetch-emails: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/refresh-emails")
async def refresh_emails(request: RefreshEmailsRequest):
    """Refresh emails for a user from Gmail API after lastSyncTimestamp"""
    try:
        # Refresh emails from Gmail
        result = refresh_user_emails_from_gmail(request.user_email)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in refresh-emails: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/gmail-webhook")
async def gmail_webhook(request: GmailWebhookRequest):
    """Handle Gmail Pub/Sub notifications for real-time email sync"""
    try:
        # Extract the base64 encoded data
        message_data = request.message
        encoded_data = message_data.get('data', '')

        if not encoded_data:
            print("No data field in webhook message")
            return {"status": "no_data"}

        # Decode the base64 data
        try:
            decoded_bytes = base64.b64decode(encoded_data)
            decoded_json = decoded_bytes.decode('utf-8')
            notification_data = json.loads(decoded_json)
        except Exception as e:
            print(f"Error decoding webhook data: {e}")
            return {"status": "decode_error", "error": str(e)}

        # Extract emailAddress and historyId
        user_email = notification_data.get('emailAddress')
        history_id = notification_data.get('historyId')

        if not user_email or not history_id:
            print(f"Missing emailAddress or historyId in notification: {notification_data}")
            return {"status": "missing_fields"}

        print(f"Received Gmail webhook for user {user_email} with historyId {history_id}")

        # Process the notification and sync relevant emails
        emails_synced = process_gmail_webhook_notification(user_email, history_id)

        print(f"Webhook processed: {emails_synced} emails synced for user {user_email}")

        return {
            "status": "processed",
            "user_email": user_email,
            "history_id": history_id,
            "emails_synced": emails_synced
        }

    except Exception as e:
        print(f"Error processing Gmail webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@app.post("/generate-email")
async def generate_email(request: GenerateEmailRequest):
    """Generate email draft using Gemini AI"""
    try:
        result = await generate_email_draft(
            request.prompt,
            request.api_key,
            request.context,
            request.previous_email_context
        )
        return GenerateEmailResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/improve-email")
async def improve_email_endpoint(request: ImproveEmailRequest):
    """Improve email using Gemini AI with different actions"""
    try:
        improved_text = await improve_email(
            request.text,
            request.action,
            request.api_key,
            request.custom_prompt,
            request.context,
            request.previous_email_context
        )
        return ImproveEmailResponse(subject="", body=improved_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/save-user-info")
async def save_user_info(request: SaveUserInfoRequest):
    """Save user information in Firestore"""
    try:
        user_email = request.user_email

        # Reference to the user document
        user_ref = db.collection('users').document(user_email)

        # Prepare user info data
        user_info_data = {
            'user_name': request.user_name,
            'user_info': request.user_info,
            'style': request.style
        }

        # Update the document with user info (merge=True to preserve other fields like gmail-watch, lastSyncTimestamp)
        user_ref.set(user_info_data, merge=True)

        return UserInfoResponse(
            user_email=user_email,
            user_name=request.user_name,
            user_info=request.user_info,
            style=request.style,
            message="User information saved successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save user info: {str(e)}")

@app.post("/update-user-info")
async def update_user_info(request: UpdateUserInfoRequest):
    """Update user information in Firestore (only provided fields are updated)"""
    try:
        user_email = request.user_email

        # Reference to the user document
        user_ref = db.collection('users').document(user_email)

        # Prepare update data (only include fields that are provided)
        update_data = {}
        if request.user_name is not None:
            update_data['user_name'] = request.user_name
        if request.user_info is not None:
            update_data['user_info'] = request.user_info
        if request.style is not None:
            update_data['style'] = request.style

        if not update_data:
            raise HTTPException(status_code=400, detail="At least one field must be provided for update")

        # Update only the provided fields
        user_ref.update(update_data)

        # Get the updated document to return current values
        updated_doc = user_ref.get()
        if not updated_doc.exists:
            raise HTTPException(status_code=404, detail="User document not found")

        updated_data = updated_doc.to_dict()

        return UserInfoResponse(
            user_email=user_email,
            user_name=updated_data.get('user_name', ''),
            user_info=updated_data.get('user_info', ''),
            style=updated_data.get('style', ''),
            message="User information updated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user info: {str(e)}")

@app.get("/fetch-user-info/{user_email}")
async def fetch_user_info(user_email: str):
    """Fetch user information from Firestore"""
    try:
        # Reference to the user document
        user_ref = db.collection('users').document(user_email)

        # Get the user document
        user_doc = user_ref.get()

        if not user_doc.exists:
            return FetchUserInfoResponse(
                user_email=user_email,
                user_name="",
                user_info="",
                style="",
                found=False,
                message="User information not found"
            )

        user_data = user_doc.to_dict()

        return FetchUserInfoResponse(
            user_email=user_email,
            user_name=user_data.get('user_name', ''),
            user_info=user_data.get('user_info', ''),
            style=user_data.get('style', ''),
            found=True,
            message="User information retrieved successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user info: {str(e)}")

@app.get("/track-email-view/{tracker_id}")
async def track_email_view(tracker_id: str, user_email: str, request: Request):
    """Track email view by logging view data and updating email status"""
    try:
        # Get tracking data
        ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Log tracking data to a separate collection (like the reference implementation)
        tracking_doc = {
            'tracker_id': tracker_id,
            'user_email': user_email,
            'ip': ip,
            'user_agent': user_agent,
            'timestamp': datetime.utcnow(),
            'viewed_at': firestore.SERVER_TIMESTAMP
        }

        # Insert tracking data
        tracking_ref = db.collection('email_tracking').document()
        tracking_ref.set(tracking_doc)
        print(f"✅ Logged tracking data for tracker {tracker_id}, user {user_email}")

        # Now try to find and update the email
        try:
            emails_ref = db.collection('users').document(user_email).collection('emails')
            query = emails_ref.where('trackerId', '==', tracker_id).limit(1)
            matching_emails = query.stream()

            for email_doc in matching_emails:
                email_ref = emails_ref.document(email_doc.id)
                email_ref.update({
                    'view_status': True,
                    'last_viewed': firestore.SERVER_TIMESTAMP,
                    'view_count': firestore.Increment(1)
                })
                print(f"✅ Updated email view_status for tracker {tracker_id}")
                break
            else:
                print(f"⚠️ Email not found for tracker {tracker_id}, but tracking logged")
        except Exception as email_update_error:
            print(f"⚠️ Could not update email status: {str(email_update_error)}, but tracking logged")

        # Return a 1x1 transparent pixel
        pixel_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
        from fastapi.responses import Response
        return Response(content=pixel_data, media_type="image/png")

    except Exception as e:
        print(f"❌ Error in tracking: {str(e)}")
        # Always return pixel to not break email tracking
        pixel_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
        from fastapi.responses import Response
        return Response(content=pixel_data, media_type="image/png")

@app.post("/mark-email-read")
async def mark_email_read(request: MarkEmailReadRequest):
    """Mark an email as read by updating isRead status from false to true"""
    try:
        user_email = request.user_email
        message_id = request.message_id

        # Reference to the specific email document
        email_ref = db.collection('users').document(user_email).collection('emails').document(message_id)

        # Check if the email exists
        email_doc = email_ref.get()
        if not email_doc.exists:
            raise HTTPException(status_code=404, detail="Email not found")

        # Update the isRead status to true
        email_ref.update({
            'isRead': True
        })

        return MarkEmailReadResponse(
            user_email=user_email,
            message_id=message_id,
            success=True,
            message="Email marked as read successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark email as read: {str(e)}")

@app.post("/start-watch")
async def start_gmail_watch(request: StartWatchRequest):
    """Start Gmail watch for a user to receive real-time notifications"""
    try:
        user_email = request.user_email
        access_token = request.access_token
        topic_name = request.topic_name

        # Check if user exists in database
        user_ref = db.collection('users').document(user_email)
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found in database")

        user_data = user_doc.to_dict()

        # Check if user already has an active watch that expires more than 24 hours from now
        now = int(time.time())
        one_day_from_now = now + (24 * 60 * 60)  # 24 hours from now
        existing_watch = user_data.get('gmail-watch')

        if existing_watch and existing_watch.get('enabled') and existing_watch.get('expiry', 0) > one_day_from_now:
            hours_left = (existing_watch.get('expiry', 0) - now) / 3600
            print(f"Watch already active for {user_email} (expires in {hours_left:.1f} hours)")
            return {
                "message": "Watch already active",
                "data": {
                    "history_id": existing_watch.get("history_id"),
                    "expiry": existing_watch.get("expiry"),
                    "enabled": True
                }
            }

        # Build Gmail API client with provided access token
        creds = Credentials(token=access_token)
        gmail = build('gmail', 'v1', credentials=creds)

        # Call Gmail watch API
        watch_body = {
            "labelIds": ["INBOX"],
            "topicName": topic_name
        }

        try:
            response = gmail.users().watch(userId='me', body=watch_body).execute()

            # Extract response data
            history_id = response.get("historyId")

            # Always set expiry to 6 days from now (safe buffer before Gmail's 7-day limit)
            expiry_seconds = int(time.time()) + (6 * 24 * 60 * 60)  # 6 days in seconds

            print(f"Setting expiry to 6 days from now: {expiry_seconds}")

            # Store watch state in database
            watch_data = {
                "enabled": True,
                "history_id": history_id,
                "expiry": expiry_seconds,
                "topic_name": topic_name,
                "started_at": firestore.SERVER_TIMESTAMP
            }

            user_ref.update({
                "gmail-watch": watch_data
            })

            print(f"Started Gmail watch for user {user_email} with historyId {history_id}")

            return {
                "message": "Watch started successfully",
                "data": {
                    "history_id": history_id,
                    "expiry": expiry_seconds,
                    "enabled": True,
                    "topic_name": topic_name
                }
            }

        except Exception as e:
            print(f"Error starting Gmail watch for {user_email}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start Gmail watch: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in start-watch: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
