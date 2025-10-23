"""
Firestore key management utilities for fetching encrypted API keys
"""

import os
import logging
import json
import firebase_admin
from firebase_admin import credentials, firestore
from typing import Optional, Dict
from .encryption import decrypt_value

logger = logging.getLogger(__name__)

# Global Firestore client
_db = None


def initialize_firestore():
    """Initialize Firebase Admin SDK and Firestore client"""
    global _db

    if _db is not None:
        return _db

    try:
        # Check if Firebase is already initialized
        firebase_admin.get_app()
        logger.info("Firebase already initialized")
    except ValueError:
        # Initialize Firebase
        service_key_value = os.getenv("service_key")

        if not service_key_value:
            raise ValueError("service_key environment variable not set")

        try:
            # Parse as JSON string (works for both local and production)
            firebase_credentials = json.loads(service_key_value)
            cred = credentials.Certificate(firebase_credentials)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully from JSON string")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in service_key: {str(e)}")
            raise ValueError("service_key must contain valid JSON")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {str(e)}")
            raise

    _db = firestore.client()
    logger.info("Firestore client initialized")
    return _db


def get_firestore_client():
    """Get or initialize Firestore client"""
    global _db
    if _db is None:
        initialize_firestore()
    return _db


def fetch_api_key(user_email: str, key_type: str) -> Optional[str]:
    """
    Fetch and decrypt an API key from Firestore.
    
    Args:
        user_email: User's email (document ID in google_oauth_credentials)
        key_type: Type of key to fetch (e.g., 'gemini_api_key', 'deepseek_v3_key')
        
    Returns:
        Decrypted API key string, or None if not found
        
    Raises:
        ValueError: If decryption fails or key not found
    """
    try:
        db = get_firestore_client()
        
        # Fetch user document
        doc_ref = db.collection('google_oauth_credentials').document(user_email)
        doc = doc_ref.get()
        
        if not doc.exists:
            logger.error(f"User document not found for: {user_email}")
            raise ValueError(f"User {user_email} not found in database")
        
        doc_data = doc.to_dict()
        
        # Check if keys field exists
        if 'keys' not in doc_data:
            logger.error(f"No 'keys' field found for user: {user_email}")
            raise ValueError(f"No API keys configured for user {user_email}")
        
        keys = doc_data['keys']
        
        # Check if specific key type exists
        if key_type not in keys:
            logger.error(f"Key type '{key_type}' not found for user: {user_email}")
            raise ValueError(f"API key type '{key_type}' not configured for user {user_email}")
        
        encrypted_key = keys[key_type]
        
        # Decrypt the key
        decrypted_key = decrypt_value(encrypted_key)
        
        logger.info(f"Successfully fetched and decrypted {key_type} for user: {user_email}")
        return decrypted_key
        
    except ValueError:
        # Re-raise ValueError with original message
        raise
    except Exception as e:
        logger.error(f"Error fetching API key for {user_email}: {str(e)}")
        raise ValueError(f"Failed to fetch API key: {str(e)}")


def list_available_keys(user_email: str) -> Dict[str, bool]:
    """
    List all available API key types for a user.
    
    Args:
        user_email: User's email
        
    Returns:
        Dictionary of key_type -> exists (bool)
    """
    try:
        db = get_firestore_client()
        doc_ref = db.collection('google_oauth_credentials').document(user_email)
        doc = doc_ref.get()
        
        if not doc.exists:
            return {}
        
        doc_data = doc.to_dict()
        keys = doc_data.get('keys', {})
        
        return {key: True for key in keys.keys()}
        
    except Exception as e:
        logger.error(f"Error listing keys for {user_email}: {str(e)}")
        return {}


__all__ = ['initialize_firestore', 'get_firestore_client', 'fetch_api_key', 'list_available_keys']

