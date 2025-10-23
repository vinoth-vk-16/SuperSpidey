"""
Utils module for Spidey Email Assistant
"""

from .helpers import validate_email, format_email_response
from .encryption import EncryptionManager, get_encryption_manager, encrypt_value, decrypt_value
from .firestore_keys import initialize_firestore, get_firestore_client, fetch_api_key, list_available_keys

__all__ = [
    'validate_email', 
    'format_email_response',
    'EncryptionManager',
    'get_encryption_manager',
    'encrypt_value',
    'decrypt_value',
    'initialize_firestore',
    'get_firestore_client',
    'fetch_api_key',
    'list_available_keys'
]

