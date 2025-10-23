"""
Encryption utilities for securely storing and retrieving API keys
"""

import os
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class EncryptionManager:
    """Manages encryption and decryption of sensitive data"""
    
    def __init__(self, encryption_key: str = None):
        """
        Initialize encryption manager with a key.
        
        Args:
            encryption_key: Base64-encoded Fernet key. If None, reads from ENCRYPTION_KEY env var
        """
        key = encryption_key or os.getenv("ENCRYPTION_KEY")
        
        if not key:
            raise ValueError("Encryption key not provided. Set ENCRYPTION_KEY environment variable.")
        
        try:
            self.cipher = Fernet(key.encode() if isinstance(key, str) else key)
            logger.info("Encryption manager initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption manager: {str(e)}")
            raise ValueError(f"Invalid encryption key format: {str(e)}")
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string.
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Encrypted string (base64 encoded)
        """
        if not plaintext:
            return ""
        
        try:
            encrypted = self.cipher.encrypt(plaintext.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            raise
    
    def decrypt(self, encrypted_text: str) -> str:
        """
        Decrypt an encrypted string.
        
        Args:
            encrypted_text: Encrypted string (base64 encoded)
            
        Returns:
            Decrypted plaintext string
        """
        if not encrypted_text:
            return ""
        
        try:
            decrypted = self.cipher.decrypt(encrypted_text.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise ValueError(f"Failed to decrypt: Invalid encryption or corrupted data")


# Global encryption manager instance
_encryption_manager = None


def get_encryption_manager() -> EncryptionManager:
    """Get or create the global encryption manager instance"""
    global _encryption_manager
    if _encryption_manager is None:
        _encryption_manager = EncryptionManager()
    return _encryption_manager


def encrypt_value(plaintext: str) -> str:
    """Convenience function to encrypt a value"""
    manager = get_encryption_manager()
    return manager.encrypt(plaintext)


def decrypt_value(encrypted_text: str) -> str:
    """Convenience function to decrypt a value"""
    manager = get_encryption_manager()
    return manager.decrypt(encrypted_text)


__all__ = ['EncryptionManager', 'get_encryption_manager', 'encrypt_value', 'decrypt_value']

