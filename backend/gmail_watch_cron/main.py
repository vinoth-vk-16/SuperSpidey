from fastapi import FastAPI, HTTPException
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import time
import json
import os
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Load environment variables
load_dotenv()

# Load Google OAuth configuration from environment
vite_google_cred = os.getenv('VITE_GOOGLE_CRED')
if not vite_google_cred:
    raise Exception("VITE_GOOGLE_CRED environment variable not found. Make sure it's set in the .env file")

google_credentials = json.loads(vite_google_cred)
google_config = google_credentials.get('web', {})

print("Google OAuth Config loaded:", {
    "clientID": google_config.get('client_id', 'NOT_SET')[:10] + '...',
    "clientSecret": '***' if google_config.get('client_secret') else 'NOT_SET'
})

# Initialize Firebase Admin SDK
service_key_env = os.getenv('service_key')
if not service_key_env:
    raise Exception("service_key environment variable not found. Make sure it's set in the .env file")

firebase_credentials = json.loads(service_key_env)
cred = credentials.Certificate(firebase_credentials)
import firebase_admin
firebase_admin.initialize_app(cred)

# Initialize Firestore client
db = firestore.client()

app = FastAPI(title="Gmail Watch Cron Job", version="1.0.0")

def renew_gmail_watch(user_email: str):
    """Renew Gmail watch for a user directly without HTTP calls"""
    try:
        # Get user's current OAuth credentials directly from Firestore
        doc_ref = db.collection('google_oauth_credentials').document(user_email)
        doc = doc_ref.get()

        if not doc.exists:
            print(f"No OAuth credentials found for {user_email}")
            return False

        data = doc.to_dict()
        user_creds = {
            'oauth': data.get('oauth', ''),
            'refresh_token': data.get('refresh_token')
        }

        if not user_creds.get('oauth'):
            print(f"No OAuth token found for {user_email}")
            return False

        # Get user document to check current watch state
        user_ref = db.collection('users').document(user_email)
        user_doc = user_ref.get()

        if not user_doc.exists:
            print(f"User document not found for {user_email}")
            return False

        user_data = user_doc.to_dict()

        # Check if user already has an active watch
        now = int(time.time())
        existing_watch = user_data.get('gmail-watch')
        if existing_watch and existing_watch.get('enabled') and existing_watch.get('expiry', 0) > now:
            print(f"Watch already active for {user_email}")
            return True

        # Build Gmail API client with provided access token
        creds = Credentials(token=user_creds['oauth'])
        gmail = build('gmail', 'v1', credentials=creds)

        # Call Gmail watch API
        watch_body = {
            "labelIds": ["INBOX"],
            "topicName": "projects/contact-remedy/topics/gmail-notifications"
        }

        try:
            response = gmail.users().watch(userId='me', body=watch_body).execute()

            # Extract response data
            history_id = response.get("historyId")
            expiry_ms = response.get("expiration", 0)

            # Convert to int if it's a string, then divide by 1000
            if isinstance(expiry_ms, str):
                expiry_ms = int(expiry_ms)
            expiry_seconds = expiry_ms // 1000 if expiry_ms else 0  # Convert ms to seconds

            # Store watch state in database
            watch_data = {
                "enabled": True,
                "history_id": history_id,
                "expiry": expiry_seconds,
                "topic_name": "projects/contact-remedy/topics/gmail-notifications",
                "started_at": firestore.SERVER_TIMESTAMP
            }

            user_ref.update({
                "gmail-watch": watch_data
            })

            print(f"Successfully renewed Gmail watch for {user_email} with historyId {history_id}")
            return True

        except Exception as e:
            print(f"Error starting Gmail watch for {user_email}: {e}")
            return False

    except Exception as e:
        print(f"Error renewing Gmail watch for {user_email}: {e}")
        return False

@app.post("/renew-expired-watches")
async def renew_expired_watches():
    """Check all users and renew Gmail watches that expire within 1 day"""
    try:
        print("Starting Gmail watch renewal check...")

        # Get current timestamp
        now = int(time.time())
        one_day_from_now = now + (24 * 60 * 60)  # 1 day in seconds

        # Query all users
        users_ref = db.collection('users')
        users = users_ref.stream()

        renewed_count = 0
        checked_count = 0

        for user_doc in users:
            checked_count += 1
            user_email = user_doc.id
            user_data = user_doc.to_dict()

            # Check if user has Gmail watch enabled
            gmail_watch = user_data.get('gmail-watch')
            if not gmail_watch or not gmail_watch.get('enabled'):
                continue

            expiry = gmail_watch.get('expiry', 0)

            # Check if expiry is within 1 day
            if expiry > 0 and expiry <= one_day_from_now:
                print(f"Watch expiring soon for {user_email} (expiry: {expiry}, now: {now})")

                # Renew the watch
                if renew_gmail_watch(user_email):
                    renewed_count += 1
                    print(f"Successfully renewed watch for {user_email}")
                else:
                    print(f"Failed to renew watch for {user_email}")
            else:
                print(f"Watch still valid for {user_email} (expiry: {expiry})")

        result = {
            "message": f"Checked {checked_count} users, renewed {renewed_count} watches",
            "checked_users": checked_count,
            "renewed_watches": renewed_count,
            "timestamp": datetime.now().isoformat()
        }

        print(f"Cron job completed: {result}")
        return result

    except Exception as e:
        error_msg = f"Cron job failed: {str(e)}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "gmail-watch-cron"}

@app.get("/")
async def root():
    """Root endpoint with cron job info"""
    return {
        "service": "Gmail Watch Cron Job",
        "description": "Automatically renews Gmail watches that expire within 1 day",
        "endpoints": {
            "POST /renew-expired-watches": "Manually trigger watch renewal check",
            "GET /health": "Health check"
        },
        "schedule": "Should be run daily at 12:00 AM"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
