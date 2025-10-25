#!/usr/bin/env python3
"""
Test script for the key storage endpoints
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = "http://localhost:8000"  # Adjust if your service runs on a different port
TEST_USER_EMAIL = "test@example.com"
TEST_KEY_TYPE = "api_key"
TEST_KEY_VALUE = "sk-test-1234567890abcdef"

def test_store_key():
    """Test storing an encrypted key"""
    url = f"{BASE_URL}/store-key"
    payload = {
        "user_email": TEST_USER_EMAIL,
        "key_type": TEST_KEY_TYPE,
        "key_value": TEST_KEY_VALUE
    }

    try:
        response = requests.put(url, json=payload)
        print(f"Store Key Response Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Key stored successfully!")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ Failed to store key: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error storing key: {e}")
        return False

def test_check_keys_presence():
    """Test checking all keys presence"""
    url = f"{BASE_URL}/check-keys/{TEST_USER_EMAIL}"

    try:
        response = requests.get(url)
        print(f"\nCheck Keys Presence Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Keys presence check successful!")
            print(f"User: {data['user_email']}")
            print(f"Available Keys: {data['available_keys']}")
            print(f"Current Selected Key: {data['current_selected_key']}")

            if TEST_KEY_TYPE in data['available_keys']:
                print(f"✅ Key '{TEST_KEY_TYPE}' exists!")
                return True
            else:
                print(f"ℹ️  Key '{TEST_KEY_TYPE}' does not exist")
                return False
        else:
            print(f"❌ Failed to check keys presence: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error checking keys presence: {e}")
        return False

def test_check_keys_for_nonexistent_user():
    """Test checking keys for a user that doesn't exist"""
    url = f"{BASE_URL}/check-keys/nonexistent@example.com"

    try:
        response = requests.get(url)
        print(f"\nCheck Keys for Non-existent User Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Non-existent user check successful!")
            print(f"Available Keys: {data['available_keys']}")
            print(f"Current Selected Key: {data['current_selected_key']}")

            if len(data['available_keys']) == 0:
                print("✅ Correctly reports no keys for non-existent user")
            else:
                print("❌ Incorrectly reports keys exist for non-existent user")
        else:
            print(f"❌ Failed to check keys for non-existent user: {response.text}")
    except Exception as e:
        print(f"❌ Error checking keys for non-existent user: {e}")

def test_set_current_key():
    """Test setting current selected key"""
    url = f"{BASE_URL}/set-current-key/{TEST_USER_EMAIL}"
    payload = {
        "current_selected_key": "gemini_api_key"
    }

    try:
        response = requests.put(url, json=payload)
        print(f"\nSet Current Key Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Current key set successfully!")
            print(f"User: {data['user_email']}")
            print(f"Current Selected Key: {data['current_selected_key']}")
            print(f"Message: {data['message']}")
            return True
        else:
            print(f"❌ Failed to set current key: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error setting current key: {e}")
        return False

def test_set_invalid_current_key():
    """Test setting invalid current key (should fail)"""
    url = f"{BASE_URL}/set-current-key/{TEST_USER_EMAIL}"
    payload = {
        "current_selected_key": "invalid_key_type"
    }

    try:
        response = requests.put(url, json=payload)
        print(f"\nSet Invalid Current Key Response Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected invalid key type!")
            print(f"Error: {response.json()['detail']}")
            return True
        else:
            print(f"❌ Should have rejected invalid key type: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing invalid key: {e}")
        return False

def test_health():
    """Test health check endpoint"""
    url = f"{BASE_URL}/health"

    try:
        response = requests.get(url)
        print(f"\nHealth Check Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Service is healthy!")
            return True
        else:
            print(f"❌ Service health check failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error checking health: {e}")
        return False

if __name__ == "__main__":
    print("Testing Key Storage Endpoints")
    print("=" * 40)

    # Check if required environment variables are set
    if not os.getenv('ENCRYPTION_KEY'):
        print("❌ ENCRYPTION_KEY environment variable not set!")
        exit(1)

    if not os.getenv('service_key'):
        print("❌ service_key environment variable not set!")
        exit(1)

    # Test health first
    if not test_health():
        print("❌ Service is not healthy, exiting...")
        exit(1)

    # Test storing a key
    if test_store_key():
        # Test checking presence of stored keys
        test_check_keys_presence()
    else:
        print("❌ Cannot test keys presence check since key storage failed")

    # Test checking keys for non-existent user
    test_check_keys_for_nonexistent_user()

    # Test setting current key
    test_set_current_key()

    # Test setting invalid current key (should fail)
    test_set_invalid_current_key()

    print("\n" + "=" * 40)
    print("Testing completed!")
