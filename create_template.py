#!/usr/bin/env python3
"""
Script tạo template Excel cho import khách
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os

def create_excel_template():
    """Tạo file Excel template cho import khách"""
    
    # Tạo workbook mới
    wb = Workbook()
    ws = wb.active
    ws.title = "Danh sách khách"
    
    # Định nghĩa headers
    headers = [
        "STT",
        "Họ và tên", 
        "Số điện thoại",
        "Giới tính",
        "Công ty",
        "Bộ phận", 
        "Vị trí",
        "Ghi chú"
    ]
    
    # Thêm headers vào dòng 1
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
    
    # Thêm dữ liệu mẫu
    sample_data = [
        [1, "Nguyễn Văn A", "0123456789", "Nam", "Công ty ABC", "IT", "Nhân viên", "Khách VIP"],
        [2, "Trần Thị B", "0987654321", "Nữ", "Công ty XYZ", "HR", "Trưởng phòng", ""],
        [3, "Lê Văn C", "0369258147", "Nam", "Công ty DEF", "Marketing", "Chuyên viên", "Khách mới"]
    ]
    
    for row_idx, row_data in enumerate(sample_data, 2):
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
            if col_idx == 1:  # STT column
                cell.alignment = Alignment(horizontal="center")
    
    # Điều chỉnh độ rộng cột
    column_widths = [8, 25, 15, 12, 20, 15, 15, 20]
    for col, width in enumerate(column_widths, 1):
        ws.column_dimensions[get_column_letter(col)].width = width
    
    # Thêm hướng dẫn ở dòng cuối
    instruction_row = len(sample_data) + 3
    ws.merge_cells(f'A{instruction_row}:H{instruction_row}')
    instruction_cell = ws.cell(row=instruction_row, column=1, value="HƯỚNG DẪN:")
    instruction_cell.font = Font(bold=True, color="FF0000")
    instruction_cell.alignment = Alignment(horizontal="left")
    
    instructions = [
        "1. Điền thông tin khách vào các dòng bên dưới",
        "2. Cột 'Họ và tên' và 'Số điện thoại' là bắt buộc",
        "3. Cột 'Giới tính' nhập: Nam, Nữ, hoặc Khác",
        "4. Các cột khác có thể để trống",
        "5. Lưu file và upload lên hệ thống",
        "6. Ảnh sẽ được cập nhật sau khi import xong"
    ]
    
    for i, instruction in enumerate(instructions, 1):
        ws.cell(row=instruction_row + i, column=1, value=f"{instruction}")
        ws.cell(row=instruction_row + i, column=1).font = Font(size=10, color="000000")
    
    # Tạo thư mục nếu chưa có
    os.makedirs('static/templates', exist_ok=True)
    
    # Lưu file
    template_path = 'static/templates/template_khach_moi.xlsx'
    wb.save(template_path)
    print(f"✅ Đã tạo template Excel: {template_path}")
    
    return template_path

if __name__ == "__main__":
    create_excel_template()
