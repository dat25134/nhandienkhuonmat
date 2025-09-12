# 📊 Hướng dẫn sử dụng chức năng Import Excel

## 🚀 Cách chạy ứng dụng

### Phương pháp 1: Sử dụng script setup (Khuyến nghị)
```bash
# Chạy setup để cài đặt dependencies
./setup.sh

# Chạy ứng dụng
python3 run_app.py
```

### Phương pháp 2: Chạy trực tiếp
```bash
# Cài đặt dependencies
python3 -m pip install --user -r requirements.txt

# Chạy ứng dụng
python3 app.py
```

## 📋 Chức năng Import Excel

### 1. Tải Template Excel
- Truy cập màn hình `/manage`
- Click button **"Tải template Excel"**
- File `template_khach_moi.xlsx` sẽ được tải về

### 2. Điền dữ liệu vào Excel
Mở file Excel và điền thông tin theo cấu trúc:

| Cột | Tên cột | Bắt buộc | Mô tả |
|-----|---------|----------|-------|
| A | STT | ❌ | Số thứ tự |
| B | Họ và tên | ✅ | Tên đầy đủ của khách |
| C | Số điện thoại | ✅ | Số điện thoại (không trùng) |
| D | Giới tính | ❌ | Nam, Nữ, hoặc Khác |
| E | Công ty | ❌ | Tên công ty |
| F | Bộ phận | ❌ | Bộ phận làm việc |
| G | Vị trí | ❌ | Chức vụ |
| H | Ghi chú | ❌ | Ghi chú thêm |

### 3. Import dữ liệu
- Chọn file Excel đã điền
- Click **"Import Excel"**
- Chờ xử lý và xem kết quả

### 4. Cập nhật ảnh
- Click **"Sửa"** bên cạnh khách cần thêm ảnh
- Upload ảnh training (1-5 ảnh)
- Click **"Lưu hồ sơ"**

## ⚠️ Lưu ý quan trọng

### Dữ liệu bắt buộc
- **Họ và tên**: Không được để trống
- **Số điện thoại**: Không được để trống và không được trùng lặp

### Định dạng file
- Chỉ hỗ trợ `.xlsx` và `.xls`
- File phải có header đúng định dạng
- Dữ liệu bắt đầu từ dòng 2

### Xử lý lỗi
- Hệ thống sẽ báo chi tiết các lỗi gặp phải
- Khách bị lỗi sẽ bị bỏ qua, không ảnh hưởng đến khách khác
- Kết quả import sẽ hiển thị số lượng thành công và thất bại

## 🔧 Troubleshooting

### Lỗi "ModuleNotFoundError: No module named 'openpyxl'"
```bash
# Cài đặt openpyxl
python3 -m pip install --user openpyxl

# Hoặc chạy setup script
./setup.sh
```

### Lỗi import app.py
```bash
# Sử dụng script run_app.py
python3 run_app.py

# Hoặc kiểm tra dependencies
python3 check_dependencies.py
```

### Lỗi tạo template Excel
```bash
# Tạo template thủ công
python3 create_template.py
```

## 📊 Kết quả mong đợi

Sau khi import thành công:
- ✅ Hiển thị số lượng khách đã thêm
- ✅ Hiển thị số khách bị bỏ qua (nếu có)
- ✅ Danh sách khách được cập nhật ngay lập tức
- ✅ Có thể chỉnh sửa thông tin từng khách
- ✅ Có thể thêm ảnh training cho từng khách

## 🎯 Lợi ích

- **Tiết kiệm thời gian**: Import hàng loạt thay vì nhập từng người
- **Chuẩn hóa dữ liệu**: Template đảm bảo định dạng đúng
- **Xử lý lỗi thông minh**: Báo cáo chi tiết các vấn đề
- **Linh hoạt**: Có thể bỏ qua các cột không cần thiết
- **An toàn**: Kiểm tra trùng lặp và validation

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy:
1. Chạy `python3 check_dependencies.py` để kiểm tra
2. Chạy `./setup.sh` để cài đặt lại dependencies
3. Sử dụng `python3 run_app.py` thay vì `python3 app.py`
