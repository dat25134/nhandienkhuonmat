#!/usr/bin/env python3
"""
Test script để kiểm tra các tối ưu hóa lazy loading cache
"""
import sys
import time
import requests
import json

def test_api_performance():
    base_url = "http://localhost:5000"
    
    print("=== Testing Lazy Loading Cache Optimizations ===\n")
    
    # Test 1: Delete user (should be fast)
    print("1. Testing DELETE /api/users/51...")
    start = time.time()
    try:
        response = requests.delete(f"{base_url}/api/users/51", timeout=10)
        end = time.time()
        print(f"   Status: {response.status_code}, Time: {end-start:.2f}s")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        elif response.status_code == 404:
            print("   User 51 not found, trying user 50...")
            start = time.time()
            response = requests.delete(f"{base_url}/api/users/50", timeout=10)
            end = time.time()
            print(f"   Status: {response.status_code}, Time: {end-start:.2f}s")
            if response.status_code == 200:
                print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 2: Delete images (should be fast)
    print("\n2. Testing DELETE /api/users/1/images...")
    start = time.time()
    try:
        response = requests.delete(f"{base_url}/api/users/1/images", 
                                 json={'paths': ['test_path.jpg']}, 
                                 timeout=10)
        end = time.time()
        print(f"   Status: {response.status_code}, Time: {end-start:.2f}s")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 3: Cache rebuild (first time - should be slow)
    print("\n3. Testing POST /api/cache/rebuild (first time)...")
    start = time.time()
    try:
        response = requests.post(f"{base_url}/api/cache/rebuild", timeout=30)
        end = time.time()
        print(f"   Status: {response.status_code}, Time: {end-start:.2f}s")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 4: Cache rebuild (second time - should be fast)
    print("\n4. Testing POST /api/cache/rebuild (second time)...")
    start = time.time()
    try:
        response = requests.post(f"{base_url}/api/cache/rebuild", timeout=10)
        end = time.time()
        print(f"   Status: {response.status_code}, Time: {end-start:.2f}s")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n=== Test completed ===")

if __name__ == "__main__":
    test_api_performance()
