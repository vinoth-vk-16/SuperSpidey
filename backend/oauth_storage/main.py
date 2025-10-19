from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from typing import Optional
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

app = FastAPI(title="Google OAuth Storage Service", version="1.0.0")

class OAuthCredentials(BaseModel):
    user_email: str
    oauth_token: str
    refresh_token: Optional[str] = None

class OAuthCredentialsResponse(BaseModel):
    user_email: str
    oauth: str
    refresh_token: Optional[str] = None

@app.post("/store-auth")
async def store_oauth_credentials(credentials: OAuthCredentials):
    """
    Store Google OAuth credentials for a user in Firestore
    """
    try:
        # Reference to the document with user email as ID
        doc_ref = db.collection('google_oauth_credentials').document(credentials.user_email)

        # Data to store
        oauth_data = {
            'oauth': credentials.oauth_token,
        }

        # Only include refresh_token if it exists
        if credentials.refresh_token:
            oauth_data['refresh_token'] = credentials.refresh_token

        # Set the document
        doc_ref.set(oauth_data)

        return {
            "message": "OAuth credentials stored successfully",
            "user_email": credentials.user_email
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store credentials: {str(e)}")

@app.get("/get-auth/{user_email}")
async def get_oauth_credentials(user_email: str):
    """
    Retrieve Google OAuth credentials for a user from Firestore
    """
    try:
        # Reference to the document with user email as ID
        doc_ref = db.collection('google_oauth_credentials').document(user_email)

        # Get the document
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="OAuth credentials not found for this user")

        data = doc.to_dict()

        return OAuthCredentialsResponse(
            user_email=user_email,
            oauth=data.get('oauth', ''),
            refresh_token=data.get('refresh_token')
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve credentials: {str(e)}")

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
