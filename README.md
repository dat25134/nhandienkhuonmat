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

## Triển khai Production với Gunicorn (khuyến nghị)

### Chạy trực tiếp bằng Gunicorn

```bash
# Khởi chạy (điều chỉnh workers theo CPU: ~2-4)
ENV=production OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
gunicorn app:app --bind 127.0.0.1:5000 --workers 3 --threads 2 --timeout 120
```

Ghi chú:
- Ứng dụng có hook `@app.before_first_request` gọi `init_db()`, cache encodings sẽ tự build khi request đầu tiên tới.
- Có nút "Rebuild cache" trong trang chủ để rebuild thủ công khi cần.

### Kết hợp Nginx reverse proxy

- Proxy `location /` tới `http://127.0.0.1:5000`.
- Phục vụ `location /static/` và `location /media/` trực tiếp từ Nginx, bật cache:

```
location /static/ {
    expires 30d;
    add_header Cache-Control "public";
}
location /media/ {
    expires 30d;
    add_header Cache-Control "public";
}
```

### Systemd (tùy chọn)

```
[Service]
Environment="ENV=production" "OMP_NUM_THREADS=1" "OPENBLAS_NUM_THREADS=1"
ExecStart=/path/to/venv/bin/gunicorn app:app --bind 127.0.0.1:5000 --workers 3 --threads 2 --timeout 120
Restart=always
```

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

## Seed dữ liệu mẫu (users/checkins)

Sử dụng seeder chạy bằng pytest để sinh dữ liệu mẫu vào `data/db/users.json` và `data/db/checkins.json`.

### Cài pytest (nếu chưa có)

```bash
pip install pytest
```

### Chạy seed mặc định (20 users, 60 checkins)

```bash
pytest -q tests/test_seed_data.py::test_seed_users_and_checkins
```

### Chạy seed với số lượng mong muốn (ví dụ 700 users, 1500 checkins)

```bash
SEED_USERS_COUNT=700 SEED_CHECKINS_COUNT=1500 pytest -q tests/test_seed_data.py::test_seed_users_and_checkins
```

Ghi chú:
- Mỗi lần chạy sẽ ghi đè `data/db/users.json` và `data/db/checkins.json`.
- Tên người dùng là duy nhất (tổ hợp Họ × Đệm × Tên, không thêm số).
- Số điện thoại tạo theo quy luật để tránh trùng lặp.
- Muốn export XLSX từ API, cài thêm:

```bash
pip install openpyxl
```