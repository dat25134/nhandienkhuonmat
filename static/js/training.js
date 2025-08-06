class TrainingApp {
    constructor() {
        this.userNameInput = document.getElementById('userName');
        this.captureButton = document.getElementById('captureFace');
        this.saveButton = document.getElementById('saveUser');
        this.resultContainer = document.getElementById('trainingResult');
        this.resultContent = document.getElementById('trainingContent');
        
        this.capturedImage = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.captureButton.addEventListener('click', () => this.captureFace());
        this.saveButton.addEventListener('click', () => this.saveUser());
        this.userNameInput.addEventListener('input', () => this.validateForm());
    }
    
    validateForm() {
        const hasName = this.userNameInput.value.trim() !== '';
        const hasImage = this.capturedImage !== null;
        
        this.saveButton.disabled = !(hasName && hasImage);
    }
    
    captureFace() {
        if (!window.cameraManager || !window.cameraManager.stream) {
            this.showError('Vui lòng bật camera trước khi chụp khuôn mặt');
            return;
        }
        
        try {
            this.capturedImage = window.cameraManager.captureImage();
            
            // Hiển thị ảnh đã chụp
            this.showCapturedImage(this.capturedImage);
            
            this.validateForm();
            
            this.showSuccess('Đã chụp khuôn mặt thành công!');
            
        } catch (error) {
            console.error('Lỗi chụp khuôn mặt:', error);
            this.showError('Lỗi khi chụp khuôn mặt');
        }
    }
    
    showCapturedImage(imageData) {
        // Tạo preview ảnh đã chụp
        const previewDiv = document.createElement('div');
        previewDiv.style.cssText = `
            margin: 20px 0;
            text-align: center;
        `;
        
        const img = document.createElement('img');
        img.src = imageData;
        img.style.cssText = `
            max-width: 200px;
            max-height: 200px;
            border-radius: 10px;
            border: 2px solid #27ae60;
        `;
        
        previewDiv.appendChild(img);
        
        // Xóa preview cũ nếu có
        const oldPreview = document.querySelector('.captured-preview');
        if (oldPreview) {
            oldPreview.remove();
        }
        
        previewDiv.className = 'captured-preview';
        this.captureButton.parentNode.appendChild(previewDiv);
    }
    
    async saveUser() {
        if (!this.capturedImage || !this.userNameInput.value.trim()) {
            this.showError('Vui lòng nhập tên và chụp khuôn mặt');
            return;
        }
        
        this.saveButton.disabled = true;
        this.saveButton.textContent = 'Đang lưu...';
        
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: this.userNameInput.value.trim(),
                    face_encoding: this.capturedImage
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showTrainingResult('Thêm người dùng thành công!', result.message);
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
        this.capturedImage = null;
        this.validateForm();
        
        // Xóa preview ảnh
        const preview = document.querySelector('.captured-preview');
        if (preview) {
            preview.remove();
        }
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