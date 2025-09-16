class ManageApp {
    constructor() {
        this.userList = document.getElementById('userList');
        this.search = document.getElementById('searchUser');
        this.rebuildBtn = document.getElementById('rebuildCache');
        this.deleteAllBtn = document.getElementById('deleteAllUsers');
        this.editPanel = document.getElementById('editPanel');
        this.excelFile = document.getElementById('excelFile');
        this.importBtn = document.getElementById('importExcel');
        this.clearBtn = document.getElementById('clearImport');
        this.downloadTemplateBtn = document.getElementById('downloadTemplate');
        this.importStatus = document.getElementById('importStatus');
        this.editingId = null;
        this.selectedPaths = new Set();
        this.bind();
        this.loadUsers();
    }

    bind() {
        this.search.addEventListener('input', () => this.render());
        this.rebuildBtn.addEventListener('click', async () => {
            await fetch('/api/cache/rebuild', { method: 'POST' });
            alert('Đã làm mới cache nhận diện');
        });
        this.deleteAllBtn.addEventListener('click', () => this.deleteAllUsers());
        this.downloadTemplateBtn.addEventListener('click', () => this.downloadTemplate());
        this.importBtn.addEventListener('click', () => this.importExcel());
        this.clearBtn.addEventListener('click', () => this.clearImport());
        document.getElementById('saveProfile').addEventListener('click', () => this.saveProfile());
        document.getElementById('deleteUser').addEventListener('click', () => this.deleteUser());
        // Đã bỏ upload ảnh training ở màn Manage
        document.getElementById('removeSelectedBtn').addEventListener('click', () => this.removeSelected());
        const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
        if (uploadAvatarBtn) uploadAvatarBtn.addEventListener('click', () => this.uploadAvatar());
    }

    async loadUsers() {
        const res = await fetch('/api/users');
        this.all = await res.json();
        this.render();
    }

    render() {
        const kw = (this.search.value || '').toLowerCase();
        const list = (this.all || []).filter(u => {
            const hay = `${u.name||''} ${u.phone||''} ${u.company||''} ${u.seat_number||''}`.toLowerCase();
            return !kw || hay.includes(kw);
        });
        if (!list.length) {
            this.userList.innerHTML = '<p>Không có khách</p>';
            return;
        }
        this.userList.innerHTML = list.map(u => `
            <div class="user-item">
                <div class="user-info">
                    <h4>${u.name || '(Không tên)'} — ${u.phone || ''}</h4>
                    <p>${u.company || ''} ${u.department?('- '+u.department):''} ${u.position?('- '+u.position):''} ${u.seat_number?('- Ghế: '+u.seat_number):''}</p>
                </div>
                <div>
                    <button class="btn btn-primary" data-id="${u.id}">Sửa</button>
                </div>
            </div>
        `).join('');
        this.userList.querySelectorAll('button[data-id]').forEach(btn => {
            btn.addEventListener('click', () => this.openEdit(parseInt(btn.dataset.id)));
        });
    }

    async openEdit(id) {
        const res = await fetch(`/api/users/${id}`);
        const u = await res.json();
        this.editingId = id;
        this.selectedPaths.clear();
        this.editPanel.style.display = 'block';
        document.getElementById('editName').value = u.name || '';
        document.getElementById('editPhone').value = u.phone || '';
        document.getElementById('editGender').value = u.gender || '';
        document.getElementById('editCompany').value = u.company || '';
        document.getElementById('editDepartment').value = u.department || '';
        document.getElementById('editPosition').value = u.position || '';
        document.getElementById('editSeatNumber').value = u.seat_number || '';
        // Render avatar preview
        const avatarEl = document.getElementById('avatarPreview');
        if (avatarEl) {
            const p = u.avatar || '';
            if (p) {
                const src = p.startsWith('data/avatars') ? `/avatar/${p}` : `/${p}`;
                avatarEl.src = src.replace('//','/');
                avatarEl.style.display = 'inline-block';
            } else {
                avatarEl.style.display = 'none';
            }
        }
        this.renderImages(u.images || []);
    }

    renderImages(paths) {
        const grid = document.getElementById('imageGrid');
        grid.innerHTML = '';
        (paths || []).forEach(p => {
            const item = document.createElement('div');
            item.style.cssText = 'position:relative;';
            const img = document.createElement('img');
            // Serve via /media for data/images
            const src = p.startsWith('data/images') ? `/media/${p}` : `/${p}`;
            img.src = src.replace('//','/');
            img.style.cssText = 'width:100px;height:100px;object-fit:cover;border-radius:6px;border:1px solid #ddd;';
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.style.cssText = 'position:absolute;top:6px;left:6px;';
            chk.addEventListener('change', () => {
                if (chk.checked) this.selectedPaths.add(p); else this.selectedPaths.delete(p);
            });
            item.appendChild(img);
            item.appendChild(chk);
            grid.appendChild(item);
        });
    }

    async saveProfile() {
        if (!this.editingId) return;
        
        const name = document.getElementById('editName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const seatNumber = document.getElementById('editSeatNumber').value.trim();
        
        // Validation
        if (!name) {
            alert('Vui lòng nhập tên');
            return;
        }
        if (!phone) {
            alert('Vui lòng nhập số điện thoại');
            return;
        }
        if (!seatNumber) {
            alert('Vui lòng nhập số ghế');
            return;
        }
        
        const payload = {
            name: name,
            phone: phone,
            gender: document.getElementById('editGender').value.trim(),
            company: document.getElementById('editCompany').value.trim(),
            department: document.getElementById('editDepartment').value.trim(),
            position: document.getElementById('editPosition').value.trim(),
            seat_number: seatNumber,
        };
        
        const response = await fetch(`/api/users/${this.editingId}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert('Đã lưu hồ sơ');
            this.loadUsers();
        } else {
            const error = await response.json();
            alert(`Lỗi: ${error.error || 'Không thể lưu hồ sơ'}`);
        }
    }

    // Đã loại bỏ chức năng upload ảnh training ở màn Manage

    async removeSelected() {
        if (!this.editingId || this.selectedPaths.size === 0) return;
        const res = await fetch(`/api/users/${this.editingId}/images`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: Array.from(this.selectedPaths) })
        });
        if (res.ok) {
            alert('Đã xóa ảnh');
            this.openEdit(this.editingId);
        } else {
            alert('Xóa ảnh thất bại');
        }
    }

    async uploadAvatar() {
        if (!this.editingId) return;
        const input = document.getElementById('avatarFile');
        const file = input?.files?.[0];
        if (!file) { alert('Vui lòng chọn ảnh avatar'); return; }
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/users/${this.editingId}/avatar`, { method: 'POST', body: fd });
        if (res.ok) {
            const data = await res.json();
            alert('Đã cập nhật avatar');
            // Refresh preview
            const avatarEl = document.getElementById('avatarPreview');
            if (avatarEl) {
                const p = data.avatar || '';
                const src = p.startsWith('data/avatars') ? `/avatar/${p}` : `/${p}`;
                avatarEl.src = src.replace('//','/');
                avatarEl.style.display = 'inline-block';
            }
        } else {
            alert('Cập nhật avatar thất bại');
        }
    }

    async deleteUser() {
        if (!this.editingId) return;
        if (!confirm('Bạn chắc chắn muốn xóa khách này?')) return;
        const res = await fetch(`/api/users/${this.editingId}`, { method: 'DELETE' });
        if (res.ok) {
            alert('Đã xóa khách');
            this.editPanel.style.display = 'none';
            this.loadUsers();
        } else {
            alert('Xóa khách thất bại');
        }
    }

    async deleteAllUsers() {
        // Xác nhận kép để tránh xóa nhầm
        const confirm1 = confirm('⚠️ CẢNH BÁO: Bạn sắp xóa TOÀN BỘ khách và dữ liệu hình ảnh!\n\nThao tác này KHÔNG THỂ HOÀN TÁC!\n\nBạn có chắc chắn muốn tiếp tục?');
        if (!confirm1) return;
        
        const confirm2 = confirm('⚠️ XÁC NHẬN LẦN CUỐI:\n\nBạn sẽ xóa TẤT CẢ khách và ảnh trong hệ thống!\n\nNhập "XÓA TẤT CẢ" để xác nhận:');
        if (!confirm2) return;
        
        const confirmText = prompt('Để xác nhận, vui lòng nhập "XÓA TẤT CẢ" (chính xác):');
        if (confirmText !== 'XÓA TẤT CẢ') {
            alert('Hủy bỏ thao tác xóa toàn bộ');
            return;
        }
        
        try {
            this.deleteAllBtn.disabled = true;
            this.deleteAllBtn.textContent = 'Đang xóa...';
            
            const res = await fetch('/api/users/delete-all', { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                alert(`✅ Đã xóa thành công ${data.deleted_users} khách và ${data.deleted_images} ảnh!`);
                this.editPanel.style.display = 'none';
                this.loadUsers();
            } else {
                const error = await res.json();
                alert(`❌ Xóa thất bại: ${error.error || 'Lỗi không xác định'}`);
            }
        } catch (error) {
            alert(`❌ Lỗi kết nối: ${error.message}`);
        } finally {
            this.deleteAllBtn.disabled = false;
            this.deleteAllBtn.textContent = 'Xóa toàn bộ khách';
        }
    }

    async downloadTemplate() {
        try {
            this.showStatus('📥 Đang tải template Excel...', 'info');
            
            // Sử dụng fetch để kiểm tra response trước
            const response = await fetch('/api/excel/template');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Lấy blob data
            const blob = await response.blob();
            
            // Tạo URL object
            const url = window.URL.createObjectURL(blob);
            
            // Tạo link download
            const link = document.createElement('a');
            link.href = url;
            link.download = 'template_khach_moi.xlsx';
            link.style.display = 'none';
            
            // Thêm vào DOM, click, rồi xóa
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Cleanup URL object
            window.URL.revokeObjectURL(url);
            
            this.showStatus('✅ Đã tải template Excel thành công!', 'success');
            
        } catch (error) {
            console.error('Download template error:', error);
            this.showStatus(`❌ Lỗi tải template: ${error.message}`, 'error');
        }
    }

    clearImport() {
        this.excelFile.value = '';
        this.showStatus('🗑️ Đã xóa file Excel', 'info');
    }

    showStatus(message, type = 'info') {
        this.importStatus.innerHTML = `<span style="color: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'}">${message}</span>`;
        setTimeout(() => {
            this.importStatus.innerHTML = '';
        }, 5000);
    }

    async importExcel() {
        const file = this.excelFile.files[0];
        if (!file) {
            this.showStatus('❌ Vui lòng chọn file Excel', 'error');
            return;
        }

        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            this.showStatus('❌ Vui lòng chọn file Excel (.xlsx hoặc .xls)', 'error');
            return;
        }

        try {
            this.importBtn.disabled = true;
            this.importBtn.textContent = 'Đang import...';
            this.showStatus('⏳ Đang xử lý file Excel...', 'info');

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/excel/import', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                this.showStatus(`✅ Import thành công! Đã thêm ${result.added} khách, ${result.skipped} khách bị bỏ qua`, 'success');
                this.loadUsers(); // Refresh danh sách
                this.excelFile.value = ''; // Clear file input
            } else {
                this.showStatus(`❌ Import thất bại: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatus(`❌ Lỗi kết nối: ${error.message}`, 'error');
        } finally {
            this.importBtn.disabled = false;
            this.importBtn.textContent = 'Import Excel';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ManageApp());


