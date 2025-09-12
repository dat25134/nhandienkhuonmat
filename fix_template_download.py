#!/usr/bin/env python3
"""
Script tự động khắc phục lỗi download template
"""
import os
import sys
import subprocess
import requests
import time

def check_server():
    """Kiểm tra server có chạy không"""
    try:
        response = requests.get("http://localhost:5000", timeout=5)
        return response.status_code == 200
    except:
        return False

def start_server():
    """Khởi động server"""
    print("🚀 Starting server...")
    try:
        # Chạy server trong background
        process = subprocess.Popen([sys.executable, "run_app.py"], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        time.sleep(3)  # Chờ server khởi động
        return process
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        return None

def check_template_file():
    """Kiểm tra file template"""
    template_path = "static/templates/template_khach_moi.xlsx"
    
    if not os.path.exists(template_path):
        print("📝 Creating template file...")
        try:
            from create_template import create_excel_template
            create_excel_template()
            print("✅ Template file created")
            return True
        except Exception as e:
            print(f"❌ Failed to create template: {e}")
            return False
    else:
        print("✅ Template file exists")
        return True

def test_download():
    """Test download template"""
    try:
        response = requests.get("http://localhost:5000/api/excel/template", timeout=10)
        if response.status_code == 200:
            print("✅ Template download API working")
            return True
        else:
            print(f"❌ API error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Download test failed: {e}")
        return False

def main():
    print("🔧 Fixing Template Download Issues...\n")
    
    # Bước 1: Kiểm tra file template
    if not check_template_file():
        print("❌ Cannot create template file")
        return
    
    # Bước 2: Kiểm tra server
    if not check_server():
        print("🔄 Server not running, starting...")
        process = start_server()
        if not process:
            print("❌ Cannot start server")
            return
        
        # Chờ server khởi động
        for i in range(10):
            if check_server():
                print("✅ Server started successfully")
                break
            time.sleep(1)
        else:
            print("❌ Server failed to start")
            return
    else:
        print("✅ Server is running")
        process = None
    
    # Bước 3: Test download
    if test_download():
        print("\n🎉 Template download is working!")
        print("📋 You can now:")
        print("   1. Go to http://localhost:5000/manage")
        print("   2. Click 'Tải template Excel' or 'Tải trực tiếp'")
        print("   3. Or visit http://localhost:5000/api/excel/template directly")
    else:
        print("\n❌ Template download still not working")
        print("📋 Try these solutions:")
        print("   1. Check server logs for errors")
        print("   2. Try direct link: http://localhost:5000/api/excel/template")
        print("   3. Check browser console for JavaScript errors")
        print("   4. Try different browser")
    
    # Cleanup
    if process:
        print("\n🔄 Server is running in background")
        print("   Press Ctrl+C to stop server")
        try:
            process.wait()
        except KeyboardInterrupt:
            process.terminate()
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    main()
