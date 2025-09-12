#!/usr/bin/env python3
"""
Script chạy app một cách an toàn với error handling
"""
import sys
import os

def main():
    try:
        # Thêm current directory vào Python path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.insert(0, current_dir)
        
        print("Starting app...")
        print(f"Python version: {sys.version}")
        print(f"Working directory: {current_dir}")
        print(f"Python path: {sys.path[:3]}...")  # Chỉ hiển thị 3 phần tử đầu
        
        # Import và chạy app
        from app import app
        print("✅ App imported successfully")
        
        # Chạy app
        print("🚀 Starting Flask server...")
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Trying to install missing dependencies...")
        
        # Thử cài đặt openpyxl nếu thiếu
        if 'openpyxl' in str(e):
            import subprocess
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
                print("✅ openpyxl installed, please try again")
            except subprocess.CalledProcessError:
                print("❌ Failed to install openpyxl")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
