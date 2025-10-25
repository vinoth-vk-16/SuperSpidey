from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from typing import Optional
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import base64

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

# Load encryption key from environment
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    raise Exception("ENCRYPTION_KEY environment variable not found. Make sure it's set in the .env file")

# Create Fernet cipher instance
cipher = Fernet(ENCRYPTION_KEY.encode())

def encrypt_key(key: str) -> str:
    """Encrypt a key using Fernet encryption"""
    return cipher.encrypt(key.encode()).decode()

def decrypt_key(encrypted_key: str) -> str:
    """Decrypt a key using Fernet encryption"""
    return cipher.decrypt(encrypted_key.encode()).decode()

app = FastAPI(title="Google OAuth Storage Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class OAuthCredentials(BaseModel):
    user_email: str
    oauth_token: str
    refresh_token: Optional[str] = None

class OAuthCredentialsResponse(BaseModel):
    user_email: str
    oauth: str
    refresh_token: Optional[str] = None

class KeyStorageRequest(BaseModel):
    user_email: str
    key_type: str
    key_value: str

class KeyStorageResponse(BaseModel):
    user_email: str
    key_type: str
    message: str

class KeysPresenceResponse(BaseModel):
    user_email: str
    available_keys: list[str]
    current_selected_key: Optional[str] = None

class CurrentKeyRequest(BaseModel):
    current_selected_key: str

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

@app.put("/store-key")
async def store_encrypted_key(request: KeyStorageRequest):
    """
    Store an encrypted key for a user in Firestore under the keys object
    """
    try:
        # Reference to the document with user email as ID
        doc_ref = db.collection('google_oauth_credentials').document(request.user_email)

        # Encrypt the key
        encrypted_key = encrypt_key(request.key_value)

        # Set the document with the encrypted key in the keys object
        # This will create the keys object if it doesn't exist, or update it if it does
        doc_ref.set({
            f'keys.{request.key_type}': encrypted_key
        }, merge=True)

        return KeyStorageResponse(
            user_email=request.user_email,
            key_type=request.key_type,
            message="Key stored successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store key: {str(e)}")

@app.get("/check-keys/{user_email}")
async def check_keys_presence(user_email: str):
    """
    Get all available keys for a user in Firestore
    """
    try:
        # Reference to the document with user email as ID
        doc_ref = db.collection('google_oauth_credentials').document(user_email)

        # Get the document
        doc = doc_ref.get()

        if not doc.exists:
            return KeysPresenceResponse(
                user_email=user_email,
                available_keys=[]
            )

        data = doc.to_dict()

        # Check if keys object exists
        if 'keys' not in data:
            return KeysPresenceResponse(
                user_email=user_email,
                available_keys=[]
            )

        # Get all available key types
        available_keys = list(data['keys'].keys())

        # Get current selected key if it exists
        current_selected_key = data.get('current_selected_key')

        return KeysPresenceResponse(
            user_email=user_email,
            available_keys=available_keys,
            current_selected_key=current_selected_key
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check keys presence: {str(e)}")

@app.put("/set-current-key/{user_email}")
async def set_current_selected_key(user_email: str, request: CurrentKeyRequest):
    """
    Set the current selected key for a user in Firestore
    """
    try:
        # Validate that the selected key is one of the allowed types
        allowed_keys = ["gemini_api_key", "deepseek_v3_key"]
        if request.current_selected_key not in allowed_keys:
            raise HTTPException(status_code=400, detail=f"Invalid key type. Must be one of: {', '.join(allowed_keys)}")

        # Reference to the document with user email as ID
        doc_ref = db.collection('google_oauth_credentials').document(user_email)

        # Set the current selected key
        doc_ref.set({
            'current_selected_key': request.current_selected_key
        }, merge=True)

        return {
            "user_email": user_email,
            "current_selected_key": request.current_selected_key,
            "message": "Current selected key updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set current selected key: {str(e)}")

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
