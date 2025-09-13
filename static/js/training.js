class TrainingApp {
    constructor() {
        this.userNameInput = document.getElementById('userName');
        this.userPhone = document.getElementById('userPhone');
        this.userGender = document.getElementById('userGender');
        this.userCompany = document.getElementById('userCompany');
        this.userDepartment = document.getElementById('userDepartment');
        this.userPosition = document.getElementById('userPosition');
        this.userSeatNumber = document.getElementById('userSeatNumber');
        this.captureButton = document.getElementById('captureFace');
        this.clearCapturedButton = document.getElementById('clearCaptured');
        this.saveButton = document.getElementById('saveUser');
        this.resultContainer = document.getElementById('trainingResult');
        this.resultContent = document.getElementById('trainingContent');
        
        this.capturedImages = {
            front: null,  // Ảnh chính diện
            left: null,   // Ảnh quay trái
            right: null   // Ảnh quay phải
        };
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
        const hasSeatNumber = this.userSeatNumber.value.trim() !== '';
        const hasAllRequiredImages = this.capturedImages.front && this.capturedImages.left && this.capturedImages.right;
        const hasUploadedImages = this.uploadedImages && this.uploadedImages.length > 0;
        
        this.saveButton.disabled = !(hasName && hasSeatNumber && (hasAllRequiredImages || hasUploadedImages));
        
        // Cập nhật trạng thái các ảnh cần chụp
        this.updateImageStatus();
    }
    
    updateImageStatus() {
        // Tạo hoặc cập nhật UI hiển thị trạng thái 3 ảnh cần chụp
        let statusContainer = document.getElementById('imageStatus');
        if (!statusContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'imageStatus';
            statusContainer.style.cssText = 'margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;';
            this.captureButton.parentNode.insertBefore(statusContainer, this.captureButton);
        }
        
        const statusHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
                <div style="padding: 8px; border-radius: 6px; ${this.capturedImages.front ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">
                    <strong>Chính diện</strong><br>
                    ${this.capturedImages.front ? '✅ Đã chụp' : '❌ Chưa chụp'}
                </div>
                <div style="padding: 8px; border-radius: 6px; ${this.capturedImages.left ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">
                    <strong>Quay trái</strong><br>
                    ${this.capturedImages.left ? '✅ Đã chụp' : '❌ Chưa chụp'}
                </div>
                <div style="padding: 8px; border-radius: 6px; ${this.capturedImages.right ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">
                    <strong>Quay phải</strong><br>
                    ${this.capturedImages.right ? '✅ Đã chụp' : '❌ Chưa chụp'}
                </div>
            </div>
        `;
        
        statusContainer.innerHTML = statusHTML;
    }
    
    captureFace() {
        if (!window.cameraTest || !window.cameraTest.stream) {
            this.showError('Vui lòng bật camera trước khi chụp khuôn mặt');
            return;
        }
        
        try {
            // Lấy góc khuôn mặt hiện tại
            const currentAngle = window.cameraTest.getCurrentFaceAngle();
            
            if (currentAngle === 'unknown') {
                this.showError('Không thể phát hiện góc khuôn mặt. Vui lòng đảm bảo khuôn mặt rõ ràng trong khung hình.');
                return;
            }
            
            // Kiểm tra xem góc này đã được chụp chưa
            if (this.capturedImages[currentAngle]) {
                this.showError(`Ảnh góc ${this.getAngleDisplayName(currentAngle)} đã được chụp rồi!`);
                return;
            }
            
            const img = window.cameraTest.captureImage();
            this.capturedImages[currentAngle] = img;
            
            this.renderCapturedPreview();
            this.validateForm();
            this.showSuccess(`Đã chụp ảnh ${this.getAngleDisplayName(currentAngle)}!`);
            
        } catch (error) {
            console.error('Lỗi chụp khuôn mặt:', error);
            this.showError('Lỗi khi chụp khuôn mặt: ' + error.message);
        }
    }
    
    getAngleDisplayName(angle) {
        const names = {
            'front': 'chính diện',
            'left': 'quay trái',
            'right': 'quay phải'
        };
        return names[angle] || angle;
    }
    
    renderCapturedPreview() {
        const old = document.querySelector('.captured-preview');
        if (old) old.remove();
        
        // Kiểm tra xem có ảnh nào được chụp không
        const hasAnyImage = this.capturedImages.front || this.capturedImages.left || this.capturedImages.right;
        if (!hasAnyImage) return;

        const wrap = document.createElement('div');
        wrap.className = 'captured-preview';
        wrap.style.cssText = 'margin: 10px 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;';

        // Hiển thị 3 ảnh theo góc
        const angles = ['front', 'left', 'right'];
        angles.forEach(angle => {
            const container = document.createElement('div');
            container.style.cssText = 'text-align: center; padding: 8px; border-radius: 8px; background: #f8f9fa;';
            
            const label = document.createElement('div');
            label.textContent = this.getAngleDisplayName(angle);
            label.style.cssText = 'font-weight: bold; margin-bottom: 5px; color: #495057;';
            container.appendChild(label);
            
            if (this.capturedImages[angle]) {
                const img = document.createElement('img');
                img.src = this.capturedImages[angle];
                img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 2px solid #27ae60;';
                container.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.textContent = 'Chưa chụp';
                placeholder.style.cssText = 'width: 80px; height: 80px; background: #e9ecef; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 12px; margin: 0 auto;';
                container.appendChild(placeholder);
            }
            
            wrap.appendChild(container);
        });

        this.captureButton.parentNode.appendChild(wrap);
    }
    
    async saveUser() {
        const hasAllRequiredImages = this.capturedImages.front && this.capturedImages.left && this.capturedImages.right;
        const hasUploadedImages = this.uploadedImages && this.uploadedImages.length > 0;
        
        if (!hasAllRequiredImages && !hasUploadedImages) {
            this.showError('Vui lòng chụp đủ 3 ảnh (chính diện, quay trái, quay phải) hoặc upload ảnh');
            return;
        }
        
        if (!this.userNameInput.value.trim()) {
            this.showError('Vui lòng nhập tên người dùng');
            return;
        }
        
        if (!this.userSeatNumber.value.trim()) {
            this.showError('Vui lòng nhập số ghế');
            return;
        }
        
        this.saveButton.disabled = true;
        this.saveButton.textContent = 'Đang lưu...';
        
        try {
            const images = [];
            
            // Thêm 3 ảnh đã chụp theo góc
            if (hasAllRequiredImages) {
                images.push(this.capturedImages.front);
                images.push(this.capturedImages.left);
                images.push(this.capturedImages.right);
            }
            
            // Thêm ảnh upload nếu có
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
                    position: (this.userPosition?.value || '').trim(),
                    seat_number: (this.userSeatNumber?.value || '').trim()
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
        this.userSeatNumber.value = '';
        this.capturedImages = {
            front: null,
            left: null,
            right: null
        };
        this.uploadedImages = [];
        this.validateForm();
        
        const preview = document.querySelector('.captured-preview');
        if (preview) preview.remove();
    }

    clearCaptured() {
        this.capturedImages = {
            front: null,
            left: null,
            right: null
        };
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