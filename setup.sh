#!/bin/bash
# Script setup cho dự án nhận dạng khuôn mặt

echo "=== Setup Dependencies ==="

# Kiểm tra Python version
echo "Checking Python version..."
python3 --version

# Cài đặt dependencies
echo "Installing Python dependencies..."
python3 -m pip install --user -r requirements.txt

# Kiểm tra openpyxl
echo "Checking openpyxl..."
python3 -c "import openpyxl; print('openpyxl version:', openpyxl.__version__)"

# Tạo template Excel
echo "Creating Excel template..."
python3 create_template.py

# Kiểm tra app
echo "Testing app import..."
python3 -c "from app import app; print('✅ App import successful')"

echo "=== Setup Complete ==="
echo "To run the app: python3 run_app.py"
echo "Or: python3 app.py"
