#!/usr/bin/env python3
"""
Test suite for Spidey LangGraph Agent
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
SPIDEY_URL = "http://localhost:8004"
TEST_KEY_TYPE = "deepseek_v3_key"  # Change to "gemini_api_key" for Gemini testing

def print_separator(title=""):
    """Print a visual separator"""
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)

def test_health():
    """Test health check endpoint"""
    print_separator("🏥 Testing health check")
    try:
        response = requests.get(f"{SPIDEY_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Server Status: {data.get('status')}")
            print(f"🤖 Agent: {data.get('agent')}")
            print(f"📦 Version: {data.get('version')}")
            print(f"🔧 Framework: {data.get('framework')}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_root():
    """Test root endpoint"""
    print_separator("🏠 Testing root endpoint")
    try:
        response = requests.get(f"{SPIDEY_URL}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Agent: {data.get('agent')}")
            print(f"📝 Description: {data.get('description')}")
            print(f"🚀 Capabilities:")
            for cap in data.get('capabilities', []):
                print(f"   • {cap}")
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_invoke(task, user_email="test@example.com", context=None, previous_convo=None):
    """Test the invoke endpoint with a specific task"""
    print_separator(f"🕷️ Testing: '{task}'")

    # Check if we have the necessary environment variables for the chosen key type
    required_env_vars = ["service_key", "ENCRYPTION_KEY"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]

    if missing_vars:
        print(f"⚠️ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please set service_key and ENCRYPTION_KEY in .env")
        return

    # Check if user has the required key type stored in Firestore
    try:
        from utils.firestore_keys import fetch_api_key
        api_key = fetch_api_key(user_email, TEST_KEY_TYPE)
        if not api_key:
            print(f"⚠️ No {TEST_KEY_TYPE} found for user {user_email} in Firestore")
            print("Please store an API key first using oauth_storage service")
            return
        print(f"✅ Found {TEST_KEY_TYPE} for user {user_email}")
    except Exception as e:
        print(f"⚠️ Error checking API key: {str(e)}")
        print("Please ensure Firebase and encryption are properly configured")
        return

    try:
        payload = {
            "user_email": user_email,
            "key_type": TEST_KEY_TYPE,
            "task": task,
            "context": context,
            "previous_convo": previous_convo
        }
        
        print(f"📧 User: {user_email}")
        if context:
            print(f"📝 Context: {context}")
        
        response = requests.post(
            f"{SPIDEY_URL}/invoke",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data.get('success')}")
            print(f"💬 Message: {data.get('message')}")
            print(f"🎯 Action: {data.get('action_taken')}")
            
            if data.get('drafts_created'):
                print(f"📝 Drafts Created: {data.get('drafts_created')}")
                print(f"🆔 Draft IDs: {data.get('draft_ids')}")
        else:
            print(f"❌ Request failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "🕷️ " * 20)
    print(f"  Spidey LangGraph Agent Test Suite - {TEST_KEY_TYPE.upper()}")
    print("🕷️ " * 20)
    
    # Basic endpoint tests
    test_health()
    test_root()
    
    print_separator("🧪 Testing Spidey Agent Scenarios")
    print(f"Testing agent capabilities with {TEST_KEY_TYPE.upper()} model:")
    print("- Conversational responses")
    print("- Email advice and tips")
    print("- Email draft creation")
    print()

    # Test 1: Simple greeting
    test_invoke(
        task="Hi",
        user_email="test@example.com"
    )
    
    # Test 2: Email advice (should NOT use tool)
    test_invoke(
        task="How do I write better cold outreach emails?",
        user_email="test@example.com"
    )
    
    # Test 3: Draft creation request (should USE tool)
    test_invoke(
        task="Create 2 outreach emails for potential web development clients",
        user_email="test@example.com",
        context="I'm a full-stack developer specializing in React and Node.js"
    )
    
    # Test 4: Job application (should USE tool)
    test_invoke(
        task="Help me create a job application email for a senior developer position at a fintech company",
        user_email="test@example.com",
        context="5 years experience, looking for remote work"
    )
    
    # Test 5: General question (should NOT use tool)
    test_invoke(
        task="What are some good subject lines for follow-up emails?",
        user_email="test@example.com"
    )
    
    print_separator("✅ Test suite completed!")
    print(f"\nNote: Testing with {TEST_KEY_TYPE.upper()}")
    print("For full functionality, ensure:")
    print("1. Spidey server is running on port 8004")
    print("2. service_key and ENCRYPTION_KEY are set in .env")
    print(f"3. Test user has {TEST_KEY_TYPE} stored in Firestore")
    print("4. Email management service is accessible")
    print("\nTo switch testing modes:")
    print('- For Gemini: Change TEST_KEY_TYPE to "gemini_api_key"')
    print('- For DeepSeek: Change TEST_KEY_TYPE to "deepseek_v3_key"')

if __name__ == "__main__":
    main()

