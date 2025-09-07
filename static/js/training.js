class TrainingApp {
    constructor() {
        this.userNameInput = document.getElementById('userName');
        this.userPhone = document.getElementById('userPhone');
        this.userGender = document.getElementById('userGender');
        this.userCompany = document.getElementById('userCompany');
        this.userDepartment = document.getElementById('userDepartment');
        this.userPosition = document.getElementById('userPosition');
        this.captureButton = document.getElementById('captureFace');
        this.clearCapturedButton = document.getElementById('clearCaptured');
        this.saveButton = document.getElementById('saveUser');
        this.resultContainer = document.getElementById('trainingResult');
        this.resultContent = document.getElementById('trainingContent');
        
        this.capturedImages = [];
        this.uploadedImages = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.captureButton.addEventListener('click', () => this.captureFace());
        this.saveButton.addEventListener('click', () => this.saveUser());
        this.userNameInput.addEventListener('input', () => this.validateForm());
        const uploadInput = document.getElementById('uploadImages');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleUpload(e));
        }
        if (this.clearCapturedButton) {
            this.clearCapturedButton.addEventListener('click', () => this.clearCaptured());
        }
    }
    
    validateForm() {
        const hasName = this.userNameInput.value.trim() !== '';
        const hasAnyImage = (this.capturedImages && this.capturedImages.length > 0) || (this.uploadedImages && this.uploadedImages.length > 0);
        
        this.saveButton.disabled = !(hasName && hasAnyImage);
    }
    
    captureFace() {
        if (!window.cameraManager || !window.cameraManager.stream) {
            this.showError('Vui lòng bật camera trước khi chụp khuôn mặt');
            return;
        }
        
        try {
            const img = window.cameraManager.captureImage();
            if (this.capturedImages.length >= 5) {
                this.showError('Bạn đã chụp tối đa 5 ảnh');
                return;
            }
            this.capturedImages.push(img);
            this.renderCapturedPreview();
            this.validateForm();
            this.showSuccess('Đã chụp khuôn mặt!');
        } catch (error) {
            console.error('Lỗi chụp khuôn mặt:', error);
            this.showError('Lỗi khi chụp khuôn mặt');
        }
    }
    
    renderCapturedPreview() {
        const old = document.querySelector('.captured-preview');
        if (old) old.remove();
        if (!this.capturedImages || this.capturedImages.length === 0) return;

        const wrap = document.createElement('div');
        wrap.className = 'captured-preview';
        wrap.style.cssText = 'margin: 10px 0; display:flex; gap:8px; flex-wrap:wrap;';

        this.capturedImages.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #27ae60;';
            wrap.appendChild(img);
        });

        this.captureButton.parentNode.appendChild(wrap);
    }
    
    async saveUser() {
        if ((!(this.capturedImages && this.capturedImages.length > 0)) || !this.userNameInput.value.trim()) {
            if (!(this.uploadedImages && this.uploadedImages.length > 0) || !this.userNameInput.value.trim()) {
                this.showError('Vui lòng nhập tên và chụp hoặc upload ít nhất 1 ảnh');
                return;
            }
        }
        
        this.saveButton.disabled = true;
        this.saveButton.textContent = 'Đang lưu...';
        
        try {
            const images = [];
            if (this.capturedImages && this.capturedImages.length > 0) images.push(...this.capturedImages);
            if (this.uploadedImages && this.uploadedImages.length > 0) {
                const remain = 5 - images.length;
                if (remain > 0) images.push(...this.uploadedImages.slice(0, remain));
            }

            const response = await fetch('/api/users/multi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: this.userNameInput.value.trim(),
                    images: images,
                    phone: (this.userPhone?.value || '').trim(),
                    gender: (this.userGender?.value || '').trim(),
                    company: (this.userCompany?.value || '').trim(),
                    department: (this.userDepartment?.value || '').trim(),
                    position: (this.userPosition?.value || '').trim()
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showTrainingResult('Thêm người dùng thành công!', result.message || '');
                this.resetForm();
            } else {
                this.showError(result.error || 'Lỗi khi thêm người dùng');
            }
            
        } catch (error) {
            console.error('Lỗi lưu người dùng:', error);
            this.showError('Lỗi kết nối server');
        } finally {
            this.saveButton.disabled = false;
            this.saveButton.textContent = 'Lưu người dùng';
        }
    }
    
    showTrainingResult(title, message) {
        this.resultContent.innerHTML = `
            <div style="color: #27ae60; font-weight: bold; margin-bottom: 10px;">
                ✅ ${title}
            </div>
            <div style="color: #7f8c8d;">
                ${message}
            </div>
        `;
        
        this.resultContainer.style.display = 'block';
        
        // Ẩn kết quả sau 5 giây
        setTimeout(() => {
            this.resultContainer.style.display = 'none';
        }, 5000);
    }
    
    resetForm() {
        this.userNameInput.value = '';
        this.capturedImages = [];
        this.uploadedImages = [];
        this.validateForm();
        
        const preview = document.querySelector('.captured-preview');
        if (preview) preview.remove();
    }

    clearCaptured() {
        this.capturedImages = [];
        const preview = document.querySelector('.captured-preview');
        if (preview) preview.remove();
        this.validateForm();
    }

    async handleUpload(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;
        const limited = files.slice(0, 5);
        const promises = limited.map(file => this.readFileAsDataUrl(file));
        const results = await Promise.all(promises);
        this.uploadedImages = results.filter(Boolean);
        this.renderUploadPreview();
        this.validateForm();
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    renderUploadPreview() {
        const old = document.querySelector('.upload-preview');
        if (old) old.remove();

        if (!this.uploadedImages || this.uploadedImages.length === 0) return;

        const wrap = document.createElement('div');
        wrap.className = 'upload-preview';
        wrap.style.cssText = 'margin: 10px 0; display:flex; gap:8px; flex-wrap:wrap;';

        this.uploadedImages.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #ddd;';
            wrap.appendChild(img);
        });

        this.saveButton.parentNode.appendChild(wrap);
    }
    
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 300px;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 300px;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Khởi tạo ứng dụng training khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    new TrainingApp();
}); 