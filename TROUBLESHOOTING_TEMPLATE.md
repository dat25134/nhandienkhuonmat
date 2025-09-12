# 🔧 Troubleshooting: Lỗi không thể tải template Excel

## 🚨 Vấn đề thường gặp

### 1. Lỗi "Không thể tải template"
**Nguyên nhân có thể:**
- Server chưa chạy
- JavaScript bị lỗi
- Browser không hỗ trợ download
- Lỗi CORS hoặc network

## 🛠️ Cách khắc phục

### Bước 1: Kiểm tra server
```bash
# Chạy server
python3 run_app.py

# Hoặc
python3 app.py
```

**Kiểm tra server đang chạy:**
- Truy cập: http://localhost:5000
- Phải thấy trang chính của ứng dụng

### Bước 2: Kiểm tra API endpoint
```bash
# Test API trực tiếp
curl -I http://localhost:5000/api/excel/template

# Hoặc dùng Python
python3 -c "
import requests
response = requests.get('http://localhost:5000/api/excel/template')
print(f'Status: {response.status_code}')
print(f'Headers: {dict(response.headers)}')
"
```

**Kết quả mong đợi:**
- Status: 200
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Content-Disposition: attachment; filename=template_khach_moi.xlsx

### Bước 3: Kiểm tra file template
```bash
# Kiểm tra file tồn tại
ls -la static/templates/template_khach_moi.xlsx

# Tạo lại template nếu cần
python3 create_template.py
```

### Bước 4: Test download trong browser

#### Phương pháp 1: Direct Link
1. Truy cập: http://localhost:5000/api/excel/template
2. File Excel sẽ được tải về tự động

#### Phương pháp 2: Test Page
1. Truy cập: http://localhost:5000/test-template
2. Click các button test để kiểm tra

#### Phương pháp 3: Manage Page
1. Truy cập: http://localhost:5000/manage
2. Click "Tải template Excel" hoặc "Tải trực tiếp"

### Bước 5: Kiểm tra JavaScript Console

1. Mở Developer Tools (F12)
2. Vào tab Console
3. Click "Tải template Excel"
4. Xem có lỗi JavaScript không

**Lỗi thường gặp:**
- `TypeError: Failed to fetch` - Server không chạy
- `CORS error` - Vấn đề CORS
- `Network error` - Lỗi mạng

## 🔍 Debug chi tiết

### 1. Kiểm tra dependencies
```bash
python3 check_dependencies.py
```

### 2. Test template creation
```bash
python3 create_template.py
```

### 3. Test download script
```bash
python3 test_template_download.py
```

### 4. Kiểm tra logs
```bash
# Chạy server với debug
python3 run_app.py

# Xem logs trong terminal
```

## 🚀 Giải pháp thay thế

### Nếu JavaScript không hoạt động:
1. Sử dụng button "Tải trực tiếp" (direct link)
2. Truy cập trực tiếp: http://localhost:5000/api/excel/template

### Nếu server không chạy:
1. Cài đặt dependencies: `./setup.sh`
2. Chạy server: `python3 run_app.py`

### Nếu file template bị lỗi:
1. Xóa file cũ: `rm static/templates/template_khach_moi.xlsx`
2. Tạo lại: `python3 create_template.py`

## 📋 Checklist khắc phục

- [ ] Server đang chạy (http://localhost:5000)
- [ ] API endpoint hoạt động (/api/excel/template)
- [ ] File template tồn tại (static/templates/)
- [ ] JavaScript không có lỗi (F12 Console)
- [ ] Browser hỗ trợ download
- [ ] Không có lỗi CORS
- [ ] Network connection ổn định

## 🆘 Nếu vẫn không được

### Tạo template thủ công:
```bash
# Tạo template mới
python3 create_template.py

# Copy file template
cp static/templates/template_khach_moi.xlsx ~/Downloads/
```

### Sử dụng curl để download:
```bash
curl -o template_khach_moi.xlsx http://localhost:5000/api/excel/template
```

### Kiểm tra quyền file:
```bash
chmod 644 static/templates/template_khach_moi.xlsx
```

## 📞 Hỗ trợ

Nếu vẫn gặp vấn đề, hãy:
1. Chạy `python3 check_dependencies.py`
2. Chạy `python3 test_template_download.py`
3. Kiểm tra logs server
4. Thử các phương pháp thay thế ở trên
