#!/usr/bin/env python3
"""
Script kiểm tra và sửa lỗi dependencies
"""
import sys
import subprocess
import os

def check_python_version():
    """Kiểm tra phiên bản Python"""
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"Python path: {sys.path}")
    print()

def check_openpyxl():
    """Kiểm tra openpyxl"""
    try:
        import openpyxl
        print(f"✅ openpyxl version: {openpyxl.__version__}")
        print(f"✅ openpyxl location: {openpyxl.__file__}")
        return True
    except ImportError as e:
        print(f"❌ openpyxl import failed: {e}")
        return False

def install_openpyxl():
    """Cài đặt openpyxl"""
    print("Installing openpyxl...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
        print("✅ openpyxl installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install openpyxl: {e}")
        return False

def test_excel_creation():
    """Test tạo file Excel"""
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws['A1'] = 'Test'
        wb.save('test_excel.xlsx')
        print("✅ Excel creation test successful")
        os.remove('test_excel.xlsx')
        return True
    except Exception as e:
        print(f"❌ Excel creation test failed: {e}")
        return False

def test_app_import():
    """Test import app.py"""
    try:
        sys.path.append('.')
        from app import app
        print("✅ App import successful")
        return True
    except Exception as e:
        print(f"❌ App import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=== Dependency Check ===\n")
    
    check_python_version()
    
    # Check openpyxl
    if not check_openpyxl():
        print("Attempting to install openpyxl...")
        if install_openpyxl():
            check_openpyxl()
        else:
            print("❌ Cannot install openpyxl")
            return
    
    # Test Excel creation
    if not test_excel_creation():
        print("❌ Excel creation failed")
        return
    
    # Test app import
    if not test_app_import():
        print("❌ App import failed")
        return
    
    print("\n✅ All checks passed! Dependencies are working correctly.")

if __name__ == "__main__":
    main()
