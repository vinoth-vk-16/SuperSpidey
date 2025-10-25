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
        
        # Check if specific key field exists (using dotted notation)
        key_field = f'keys.{key_type}'
        if key_field not in doc_data:
            logger.error(f"Key field '{key_field}' not found for user: {user_email}")
            raise ValueError(f"API key type '{key_type}' not configured for user {user_email}")

        encrypted_key = doc_data[key_field]
        
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

        # Look for keys with dotted notation (keys.gemini_api_key, keys.deepseek_v3_key, etc.)
        available_keys = {}
        for field_name, field_value in doc_data.items():
            if field_name.startswith('keys.'):
                # Extract key_type from 'keys.key_type'
                key_type = field_name[5:]  # Remove 'keys.' prefix
                available_keys[key_type] = True

        return available_keys

    except Exception as e:
        logger.error(f"Error listing keys for {user_email}: {str(e)}")
        return {}


def get_user_selected_key(user_email: str) -> str:
    """
    Get the currently selected API key type for a user.

    Args:
        user_email: User's email

    Returns:
        Selected key type (e.g., 'gemini_api_key', 'deepseek_v3_key')

    Raises:
        ValueError: If user not found or no key selected
    """
    try:
        db = get_firestore_client()

        # Get user document
        doc_ref = db.collection('google_oauth_credentials').document(user_email)
        doc = doc_ref.get()

        if not doc.exists:
            logger.error(f"User document not found for: {user_email}")
            raise ValueError(f"User {user_email} not found in database")

        doc_data = doc.to_dict()

        # Check if current_selected_key exists
        selected_key = doc_data.get('current_selected_key')
        if not selected_key:
            logger.error(f"No current selected key for user: {user_email}")
            raise ValueError(f"No API key selected for user {user_email}. Please select an API key first.")

        # Validate it's one of the allowed key types
        allowed_keys = ["gemini_api_key", "deepseek_v3_key"]
        if selected_key not in allowed_keys:
            logger.error(f"Invalid selected key type '{selected_key}' for user: {user_email}")
            raise ValueError(f"Invalid selected key type '{selected_key}' for user {user_email}")

        logger.info(f"Retrieved selected key '{selected_key}' for user: {user_email}")
        return selected_key

    except ValueError:
        # Re-raise ValueError with original message
        raise
    except Exception as e:
        logger.error(f"Error getting selected key for {user_email}: {str(e)}")
        raise ValueError(f"Failed to get selected key: {str(e)}")


def get_user_api_key(user_email: str) -> str:
    """
    Get the API key for a user based on their currently selected key.

    Args:
        user_email: User's email address

    Returns:
        Decrypted API key string

    Raises:
        ValueError: If no current key is selected or key not found
    """
    try:
        # Get the selected key type first
        selected_key_type = get_user_selected_key(user_email)

        # Then fetch the actual API key
        api_key = fetch_api_key(user_email, selected_key_type)

        logger.info(f"Successfully retrieved selected API key for user: {user_email}")
        return api_key

    except ValueError:
        # Re-raise ValueError with original message
        raise
    except Exception as e:
        logger.error(f"Error getting API key for {user_email}: {str(e)}")
        raise ValueError(f"Failed to get API key: {str(e)}")


__all__ = ['initialize_firestore', 'get_firestore_client', 'fetch_api_key', 'list_available_keys', 'get_user_selected_key', 'get_user_api_key']

