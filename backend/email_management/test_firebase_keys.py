#!/usr/bin/env python3
"""
Test script to verify that email generation endpoints work with Firebase keys
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
EMAIL_MANAGEMENT_URL = "http://localhost:8000"  # Adjust if your service runs on a different port
OAUTH_STORAGE_URL = "http://localhost:8001"  # Adjust if your oauth service runs on a different port

# Test user email
TEST_USER_EMAIL = "test@example.com"
TEST_PROMPT = "Write a professional email to request a meeting with the CEO"

def test_store_key():
    """Store a test API key in Firebase"""
    url = f"{OAUTH_STORAGE_URL}/store-key"
    payload = {
        "user_email": TEST_USER_EMAIL,
        "key_type": "gemini_api_key",
        "key_value": os.getenv("TEST_GEMINI_API_KEY", "test-api-key-12345")
    }

    try:
        response = requests.post(url, json=payload)
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

def test_generate_email():
    """Test generating an email using Firebase keys"""
    url = f"{EMAIL_MANAGEMENT_URL}/generate-email"
    payload = {
        "prompt": TEST_PROMPT,
        "user_email": TEST_USER_EMAIL
    }

    try:
        response = requests.post(url, json=payload)
        print(f"Generate Email Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Email generated successfully!")
            print(f"Subject: {data.get('subject', 'N/A')}")
            print(f"Body Preview: {data.get('body', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ Failed to generate email: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error generating email: {e}")
        return False

def test_improve_email():
    """Test improving an email using Firebase keys"""
    url = f"{EMAIL_MANAGEMENT_URL}/improve-email"
    payload = {
        "text": "hi there i need to meet with u",
        "action": "improve",
        "user_email": TEST_USER_EMAIL
    }

    try:
        response = requests.post(url, json=payload)
        print(f"Improve Email Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Email improved successfully!")
            print(f"Body Preview: {data.get('body', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ Failed to improve email: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error improving email: {e}")
        return False

def test_no_current_key():
    """Test what happens when user has no current selected key"""
    # First, let's try to set a non-existent key to simulate no selection
    url = f"{OAUTH_STORAGE_URL}/set-current-key/{TEST_USER_EMAIL}"
    payload = {
        "current_selected_key": "nonexistent_key"
    }

    try:
        response = requests.put(url, json=payload)
        print(f"No Current Key Test - Response Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected invalid key type!")
            return True
        else:
            print(f"❌ Unexpected response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error in no current key test: {e}")
        return False

if __name__ == "__main__":
    print("Testing Email Generation with Firebase Keys")
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

    print("\n2. Testing email generation...")
    if not test_generate_email():
        print("❌ Email generation failed")
        exit(1)

    print("\n3. Testing email improvement...")
    if not test_improve_email():
        print("❌ Email improvement failed")
        exit(1)

    print("\n4. Testing error handling...")
    test_no_current_key()

    print("\n" + "=" * 50)
    print("✅ All tests completed successfully!")
    print("Email generation endpoints now use Firebase keys instead of frontend-provided keys.")
