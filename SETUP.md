# Hướng dẫn Setup Nhanh

## Setup trong 5 phút

### 1. Cài đặt dependencies hệ thống (Linux)

```bash
# Cập nhật và cài đặt dependencies
sudo apt update
sudo apt install cmake build-essential pkg-config
sudo apt install libx11-dev libatlas-base-dev libgtk-3-dev libboost-python-dev
sudo apt install openssl
```

### 2. Tạo môi trường ảo và cài đặt Python packages

```bash
# Tạo môi trường ảo
python -m venv venv

# Kích hoạt môi trường ảo
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### 3. Tạo SSL certificate

```bash
# Tạo SSL certificate (nhấn Enter cho tất cả câu hỏi)
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

### 4. Chạy ứng dụng

```bash
# Chạy ứng dụng
python app.py
```

### 5. Truy cập ứng dụng

Mở trình duyệt và truy cập:
```
https://localhost:5000
```

**Lưu ý**: Nhấp "Advanced" → "Proceed to localhost (unsafe)" khi có cảnh báo SSL.

## Test nhanh

1. **Bật camera**: Chọn camera → "Bật camera"
2. **Thêm người dùng**: Vào trang Training → Chụp ảnh → Nhập tên → "Thêm người dùng"
3. **Test nhận dạng**: Quay lại trang chủ → "Quét khuôn mặt"

## Troubleshooting nhanh

### Lỗi cài đặt dlib
```bash
# Cài đặt lại với fallback
pip install dlib --no-cache-dir
```

### Camera không hoạt động
- Đảm bảo truy cập qua HTTPS
- Cấp quyền camera cho trang web
- Kiểm tra: `ls /dev/video*`

### Âm thanh không phát
```bash
# Cài đặt gTTS
pip install gTTS==2.4.0
```

## Cấu trúc file quan trọng

```
├── app.py              # Ứng dụng chính
├── requirements.txt    # Dependencies
├── cert.pem           # SSL certificate
├── key.pem            # SSL private key
├── templates/         # HTML templates
└── static/js/        # JavaScript files
```

## API Test

Test API bằng curl:

```bash
# Lấy danh sách users
curl http://localhost:5000/api/users

# Test TTS
curl -X POST http://localhost:5000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Xin chào"}'
``` 