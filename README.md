# Hệ thống nhận dạng khuôn mặt

Ứng dụng web nhận dạng khuôn mặt sử dụng Flask, OpenCV, và face_recognition với giao diện thân thiện và tính năng Text-to-Speech tiếng Việt.

## Tính năng chính

- ✅ **Nhận dạng khuôn mặt** với độ chính xác cao
- ✅ **Giao diện web** thân thiện với người dùng
- ✅ **Text-to-Speech tiếng Việt** sử dụng gTTS
- ✅ **Quản lý người dùng** với database SQLite
- ✅ **Hỗ trợ HTTPS** cho camera access
- ✅ **Thông báo âm thanh** khi nhận dạng thành công/thất bại

## Yêu cầu hệ thống

- **Python**: 3.11.9
- **Hệ điều hành**: Linux/Windows/macOS
- **Trình duyệt**: Chrome, Firefox, Safari, Edge (phiên bản mới)
- **Camera**: Webcam hoặc camera tích hợp

## Cài đặt

### Bước 1: Clone dự án

```bash
git clone <repository-url>
cd nhan_dang_khuon_mat
```

### Bước 2: Tạo môi trường ảo (khuyến nghị)

```bash
# Tạo môi trường ảo
python -m venv venv

# Kích hoạt môi trường ảo
# Trên Linux/macOS:
source venv/bin/activate
# Trên Windows:
venv\Scripts\activate
```

### Bước 3: Cài đặt dependencies

```bash
# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

**Lưu ý**: Nếu gặp lỗi khi cài đặt `dlib` hoặc `face-recognition`, hãy làm theo hướng dẫn bên dưới.

### Bước 4: Cài đặt dependencies hệ thống (Linux)

```bash
# Cập nhật package list
sudo apt update

# Cài đặt các công cụ build cần thiết
sudo apt install cmake
sudo apt install build-essential
sudo apt install pkg-config

# Cài đặt các thư viện cần thiết cho dlib
sudo apt install libx11-dev
sudo apt install libatlas-base-dev
sudo apt install libgtk-3-dev
sudo apt install libboost-python-dev

# Cài đặt OpenSSL (cho HTTPS)
sudo apt install openssl
```

### Bước 5: Tạo SSL certificate (cho HTTPS)

```bash
# Tạo SSL certificate tự ký
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

Khi được hỏi thông tin, bạn có thể nhấn Enter để sử dụng giá trị mặc định.

## Chạy ứng dụng

### Chạy với HTTP (localhost)

```bash
python app.py
```

Truy cập: `http://localhost:5000`

### Chạy với HTTPS (khuyến nghị cho camera)

```bash
python app.py
```

Truy cập: `https://localhost:5000`

**Lưu ý**: Khi truy cập HTTPS lần đầu, trình duyệt sẽ cảnh báo về certificate tự ký. Nhấp vào "Advanced" → "Proceed to localhost (unsafe)" để tiếp tục.

## Sử dụng ứng dụng

### 1. Trang chủ (`/`)

- **Bật camera**: Chọn camera và nhấn "Bật camera"
- **Quét khuôn mặt**: Nhấn "Quét khuôn mặt" để nhận dạng
- **Xem danh sách người dùng**: Danh sách người dùng đã đăng ký

### 2. Trang Training (`/training`)

- **Thêm người dùng mới**: Chụp ảnh và nhập tên
- **Huấn luyện hệ thống**: Thêm dữ liệu khuôn mặt vào database

### 3. Các tính năng

#### Nhận dạng thành công
- Hiển thị: "✅ Nhận dạng thành công!" + tên người dùng
- Âm thanh: "Chào mừng ông [tên] đã đến với hệ thống của chúng tôi"

#### Không nhận dạng được
- Hiển thị: "❌ Không nhận dạng được khuôn mặt"
- Âm thanh: "Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống"

## Cấu trúc dự án

```
nhan_dang_khuon_mat/
├── app.py                 # File chính Flask application
├── requirements.txt       # Danh sách dependencies
├── README.md             # Hướng dẫn này
├── cert.pem              # SSL certificate (tự tạo)
├── key.pem               # SSL private key (tự tạo)
├── face_recognition.db   # Database SQLite (tự tạo)
├── templates/            # HTML templates
│   ├── index.html       # Trang chủ
│   └── training.html    # Trang training
└── static/              # Static files
    ├── css/             # CSS stylesheets
    └── js/              # JavaScript files
        ├── camera.js    # Xử lý camera
        └── main.js      # Logic chính
```

## API Endpoints

### GET `/`
- **Mô tả**: Trang chủ
- **Response**: HTML page

### GET `/training`
- **Mô tả**: Trang training
- **Response**: HTML page

### GET `/api/users`
- **Mô tả**: Lấy danh sách người dùng
- **Response**: JSON array của users

### POST `/api/users`
- **Mô tả**: Thêm người dùng mới
- **Body**: `{"name": "string", "face_encoding": "base64"}`
- **Response**: JSON với message

### POST `/api/recognize`
- **Mô tả**: Nhận dạng khuôn mặt
- **Body**: `{"face_encoding": "base64"}`
- **Response**: JSON với `{"recognized": boolean, "name": "string", "message": "string"}`

### POST `/api/tts`
- **Mô tả**: Text-to-Speech
- **Body**: `{"text": "string"}`
- **Response**: Audio file (MP3)

## Xử lý lỗi thường gặp

### 1. Lỗi cài đặt dlib/face-recognition

**Lỗi**: `CMake is not installed` hoặc `Building wheel for dlib`

**Giải pháp**:
```bash
# Cài đặt CMake và dependencies
sudo apt update
sudo apt install cmake build-essential pkg-config
sudo apt install libx11-dev libatlas-base-dev libgtk-3-dev libboost-python-dev

# Cài đặt lại
pip install -r requirements.txt
```

### 2. Camera không hoạt động

**Lỗi**: "MediaDevices API không được hỗ trợ"

**Giải pháp**:
- Đảm bảo truy cập qua HTTPS: `https://localhost:5000`
- Cấp quyền camera cho trang web
- Kiểm tra camera có hoạt động không: `ls /dev/video*`

### 3. Lỗi TTS (Text-to-Speech)

**Lỗi**: "getUserMedia is not implemented"

**Giải pháp**:
```bash
# Cài đặt gTTS
pip install gTTS==2.4.0

# Kiểm tra kết nối internet (gTTS cần internet)
```

### 4. Lỗi SSL certificate

**Lỗi**: "This site can't be reached"

**Giải pháp**:
```bash
# Tạo lại SSL certificate
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Chạy lại ứng dụng
python app.py
```

## Tùy chỉnh

### Thay đổi thông báo

Sửa file `app.py`:
```python
# Thông báo khi nhận dạng thành công
'message': f'Chào mừng ông {name} đã đến với hệ thống của chúng tôi'

# Thông báo khi không nhận dạng được
'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
```

### Thay đổi độ chính xác nhận dạng

Sửa file `app.py`:
```python
# Giảm tolerance để tăng độ chính xác (0.4-0.6)
matches = face_recognition.compare_faces([stored_encoding], current_face_encoding, tolerance=0.6)
```

### Thay đổi ngôn ngữ TTS

Sửa file `app.py`:
```python
# Thay đổi ngôn ngữ TTS
tts = gTTS(text=text, lang='vi', slow=False)  # 'vi' cho tiếng Việt
```

## Bảo mật

- **Database**: Sử dụng SQLite với face encoding được mã hóa base64
- **HTTPS**: SSL certificate tự ký cho camera access
- **Validation**: Kiểm tra dữ liệu đầu vào trước khi xử lý
- **Error handling**: Xử lý lỗi an toàn không để lộ thông tin nhạy cảm

## Đóng góp

1. Fork dự án
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## License

Dự án này được phát hành dưới MIT License.

## Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra phần "Xử lý lỗi thường gặp"
2. Xem log trong terminal khi chạy ứng dụng
3. Kiểm tra Console trong Developer Tools của trình duyệt
4. Tạo issue với thông tin chi tiết về lỗi

---

**Lưu ý**: Đây là dự án demo, không nên sử dụng trong môi trường production mà không có các biện pháp bảo mật bổ sung. 