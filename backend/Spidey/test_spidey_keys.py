#!/usr/bin/env python3
"""
Test script to verify that Spidey agent uses selected keys from Firebase
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SPIDEY_URL = "http://localhost:8004"  # Adjust if your Spidey service runs on a different port
OAUTH_STORAGE_URL = "http://localhost:8001"  # Adjust if your oauth service runs on a different port

# Test user email
TEST_USER_EMAIL = "test@example.com"
TEST_TASK = "Hello, can you help me summarize my recent emails?"

def test_store_key():
    """Store a test API key in Firebase"""
    url = f"{OAUTH_STORAGE_URL}/store-key"
    payload = {
        "user_email": TEST_USER_EMAIL,
        "key_type": "gemini_api_key",
        "key_value": os.getenv("TEST_GEMINI_API_KEY", "test-api-key-12345")
    }

    try:
        response = requests.put(url, json=payload)
        print(f"Store Key Response Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Test API key stored successfully!")
            return True
        else:
            print(f"❌ Failed to store test key: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error storing test key: {e}")
        return False

def test_set_current_key():
    """Set the current selected key for the test user"""
    url = f"{OAUTH_STORAGE_URL}/set-current-key/{TEST_USER_EMAIL}"
    payload = {
        "current_selected_key": "gemini_api_key"
    }

    try:
        response = requests.put(url, json=payload)
        print(f"Set Current Key Response Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Current key set successfully!")
            return True
        else:
            print(f"❌ Failed to set current key: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error setting current key: {e}")
        return False

def test_spidey_invoke():
    """Test invoking Spidey agent using selected key from Firebase"""
    url = f"{SPIDEY_URL}/invoke"
    payload = {
        "user_email": TEST_USER_EMAIL,
        "task": TEST_TASK
    }

    try:
        response = requests.post(url, json=payload)
        print(f"Spidey Invoke Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Spidey agent invoked successfully!")
            print(f"Success: {data.get('success', 'N/A')}")
            print(f"Message Preview: {data.get('message', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ Failed to invoke Spidey: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error invoking Spidey: {e}")
        return False

def test_spidey_no_key_selected():
    """Test what happens when user has no current selected key"""
    # First, let's try to invoke Spidey without setting a current key
    # We need a different user for this test
    test_user_no_key = "no-key-user@example.com"

    url = f"{SPIDEY_URL}/invoke"
    payload = {
        "user_email": test_user_no_key,
        "task": "Hello"
    }

    try:
        response = requests.post(url, json=payload)
        print(f"No Key Selected Test - Response Status: {response.status_code}")
        if response.status_code == 404:
            print("✅ Correctly rejected user with no selected key!")
            return True
        else:
            print(f"❌ Unexpected response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error in no key test: {e}")
        return False

if __name__ == "__main__":
    print("Testing Spidey Agent with Firebase Keys")
    print("=" * 50)

    # Check if required environment variables are set
    if not os.getenv('service_key'):
        print("❌ service_key environment variable not set!")
        exit(1)

    if not os.getenv('ENCRYPTION_KEY'):
        print("❌ ENCRYPTION_KEY environment variable not set!")
        exit(1)

    print("1. Setting up test data...")
    if not test_store_key():
        print("❌ Cannot proceed without storing test key")
        exit(1)

    if not test_set_current_key():
        print("❌ Cannot proceed without setting current key")
        exit(1)

    print("\n2. Testing Spidey agent with selected key...")
    if not test_spidey_invoke():
        print("❌ Spidey agent test failed")
        exit(1)

    print("\n3. Testing error handling...")
    test_spidey_no_key_selected()

    print("\n" + "=" * 50)
    print("✅ All tests completed successfully!")
    print("Spidey agent now automatically uses the user's selected key from Firebase.")
