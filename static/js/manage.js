class ManageApp {
    constructor() {
        this.userList = document.getElementById('userList');
        this.search = document.getElementById('searchUser');
        this.rebuildBtn = document.getElementById('rebuildCache');
        this.editPanel = document.getElementById('editPanel');
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
        document.getElementById('saveProfile').addEventListener('click', () => this.saveProfile());
        document.getElementById('deleteUser').addEventListener('click', () => this.deleteUser());
        document.getElementById('uploadImagesBtn').addEventListener('click', () => this.uploadImages());
        document.getElementById('removeSelectedBtn').addEventListener('click', () => this.removeSelected());
    }

    async loadUsers() {
        const res = await fetch('/api/users');
        this.all = await res.json();
        this.render();
    }

    render() {
        const kw = (this.search.value || '').toLowerCase();
        const list = (this.all || []).filter(u => {
            const hay = `${u.name||''} ${u.phone||''} ${u.company||''}`.toLowerCase();
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
                    <p>${u.company || ''} ${u.department?('- '+u.department):''} ${u.position?('- '+u.position):''}</p>
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
        const payload = {
            phone: document.getElementById('editPhone').value.trim(),
            gender: document.getElementById('editGender').value.trim(),
            company: document.getElementById('editCompany').value.trim(),
            department: document.getElementById('editDepartment').value.trim(),
            position: document.getElementById('editPosition').value.trim(),
        };
        await fetch(`/api/users/${this.editingId}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert('Đã lưu hồ sơ');
        this.loadUsers();
    }

    async uploadImages() {
        if (!this.editingId) return;
        const input = document.getElementById('addImages');
        const files = Array.from(input.files || []);
        if (files.length === 0) return;
        const fd = new FormData();
        files.slice(0, 5).forEach(f => fd.append('files', f));
        const res = await fetch(`/api/users/${this.editingId}/images`, { method: 'POST', body: fd });
        if (res.ok) {
            alert('Đã thêm ảnh');
            this.openEdit(this.editingId);
        } else {
            alert('Thêm ảnh thất bại');
        }
    }

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
}

document.addEventListener('DOMContentLoaded', () => new ManageApp());


