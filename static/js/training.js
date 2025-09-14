class TrainingApp {
    constructor() {
        this.userNameInput = document.getElementById('userName');
        this.userPhone = document.getElementById('userPhone');
        this.userGender = document.getElementById('userGender');
        this.userCompany = document.getElementById('userCompany');
        this.userDepartment = document.getElementById('userDepartment');
        this.userPosition = document.getElementById('userPosition');
        this.userSeatNumber = document.getElementById('userSeatNumber');
        // this.captureButton = document.getElementById('captureFace'); // Đã comment button
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
        
        // Auto capture state
        this.autoCaptureEnabled = false;
        this.autoCaptureStarted = false;
        this.currentCaptureStage = 'front'; // front, left, right, done
        this.qualityHoldCount = 0;
        this.faceAngleHoldCount = 0;
        this.baselineQuality = { eyeFrac: 0, faceRatio: 0 };
        this.qualityLocked = false;
        
        // MediaPipe objects
        this.mpFaceMesh = null;
        this.drawingUtils = null;
        this.mesh = null;
        this.camera = null;
        
        // Animation loop management
        this.animationId = null;
        this.isInitialized = false;
        
        // Quality thresholds
        this.PROX_FRONT = 0.24;
        this.FACE_FRONT = 0.18;
        this.PROX_SIDE = 0.18;
        this.FACE_SIDE = 0.14;
        this.QHOLD_FRONT = 6;
        this.QHOLD_SIDE = 4;
        this.FRONT_THR = 0.05;
        this.YAW_THR = 0.12;
        this.HOLD_FR = 6;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // this.captureButton.addEventListener('click', () => this.captureFace()); // Đã comment button
        this.saveButton.addEventListener('click', () => this.saveUser());
        this.userNameInput.addEventListener('input', () => this.validateForm());
        
        // Thêm event listener cho userSeatNumber
        if (this.userSeatNumber) {
            this.userSeatNumber.addEventListener('input', () => this.validateForm());
        }
        
        const uploadInput = document.getElementById('uploadImages');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleUpload(e));
        }
        if (this.clearCapturedButton) {
            this.clearCapturedButton.addEventListener('click', () => this.retakePhotos());
        }
        
        // Auto capture event listeners
        const startCameraButton = document.getElementById('startCamera');
        if (startCameraButton) {
            startCameraButton.addEventListener('click', () => this.startAutoCapture());
        }
        
        const stopCameraButton = document.getElementById('stopCamera');
        if (stopCameraButton) {
            stopCameraButton.addEventListener('click', () => this.stopAutoCapture());
        }
    }
    
    validateForm() {
        const hasName = this.userNameInput.value.trim() !== '';
        const hasSeatNumber = this.userSeatNumber && this.userSeatNumber.value.trim() !== '';
        const hasAllRequiredImages = this.capturedImages.front && this.capturedImages.left && this.capturedImages.right;
        const hasUploadedImages = this.uploadedImages && this.uploadedImages.length > 0;
        const hasAnyCapturedImages = this.capturedImages.front || this.capturedImages.left || this.capturedImages.right;
        
        // Debug log để kiểm tra
        console.log('validateForm debug:', {
            hasName,
            hasSeatNumber,
            hasAllRequiredImages,
            hasUploadedImages,
            capturedImages: this.capturedImages,
            uploadedImages: this.uploadedImages
        });
        
        this.saveButton.disabled = !(hasName && hasSeatNumber && (hasAllRequiredImages || hasUploadedImages));
        
        // Enable/disable button "Chụp lại" dựa trên việc có ảnh đã chụp hay không
        if (this.clearCapturedButton) {
            this.clearCapturedButton.disabled = !hasAnyCapturedImages;
        }
        
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
            // this.captureButton.parentNode.insertBefore(statusContainer, this.captureButton); // Đã comment button
            // Thay thế bằng cách thêm vào training-controls
            const trainingControls = document.querySelector('.training-controls');
            if (trainingControls) {
                trainingControls.insertBefore(statusContainer, trainingControls.firstChild);
            }
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
    
    // captureFace() {
    //     // Đã comment vì không cần thiết nữa - đã có auto capture
    //     if (!window.cameraTest || !window.cameraTest.stream) {
    //         return;
    //     }
    //     
    //     // Nếu đang trong chế độ auto capture, dừng nó trước
    //     if (this.autoCaptureEnabled) {
    //         this.stopAutoCapture();
    //     }
    //     
    //     try {
    //         // Lấy góc khuôn mặt hiện tại
    //         const currentAngle = window.cameraTest.getCurrentFaceAngle();
    //         
    //         if (currentAngle === 'unknown') {
    //             return;
    //         }
    //         
    //         // Kiểm tra xem góc này đã được chụp chưa
    //         if (this.capturedImages[currentAngle]) {
    //             return;
    //         }
    //         
    //         const img = window.cameraTest.captureImagePure();
    //         this.capturedImages[currentAngle] = img;
    //         
    //         this.renderCapturedPreview();
    //         this.validateForm();
    //         // Thông báo đã được gộp vào auto capture UI
    //         
    //     } catch (error) {
    //         console.error('Lỗi chụp khuôn mặt:', error);
    //     }
    // }
    
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

        // this.captureButton.parentNode.appendChild(wrap); // Đã comment button
        // Thay thế bằng cách thêm vào training-controls
        const trainingControls = document.querySelector('.training-controls');
        if (trainingControls) {
            trainingControls.appendChild(wrap);
        }
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
        
        // Reset auto capture state nhưng không tự động chụp lại
        this.resetAutoCapture();
        if (this.autoCaptureEnabled) {
            this.stopAutoCapture();
        }
    }

    retakePhotos() {
        // Dừng auto capture ngay lập tức nếu đang chạy
        if (this.autoCaptureEnabled) {
            this.stopAutoCapture();
        }
        
        // Xóa ảnh đã chụp
        this.capturedImages = {
            front: null,
            left: null,
            right: null
        };
        const preview = document.querySelector('.captured-preview');
        if (preview) preview.remove();
        this.validateForm();
        
        // Reset auto capture state như trong camera-performance.html
        this.resetAutoCapture();
        
        // Reset các biến như trong camera-performance.html
        this.qualityHoldCount = 0;
        this.faceAngleHoldCount = 0;
        this.baselineQuality = { eyeFrac: 0, faceRatio: 0 };
        this.qualityLocked = false;
        this.currentCaptureStage = 'front';
        
        // Reset UI và state
        this.autoCaptureEnabled = false;
        this.autoCaptureStarted = false;
        this.removeAutoCaptureUI();
        
        // Tự động bắt đầu lại auto capture ngay lập tức
        if (window.cameraTest && window.cameraTest.stream) {
            // Bắt đầu lại ngay lập tức, không cần setTimeout
            try {
                // Chỉ cần reset state và bắt đầu lại
                this.autoCaptureEnabled = true;
                this.autoCaptureStarted = true;
                this.currentCaptureStage = 'front';
                this.resetAutoCapture();
                
                // Tạo UI hướng dẫn auto capture
                this.createAutoCaptureUI();
                
            } catch (error) {
                console.error('Lỗi khi bắt đầu auto capture:', error);
            }
        }
    }
    
    clearCaptured() {
        // Giữ lại phương thức này để tương thích với các chức năng khác
        this.capturedImages = {
            front: null,
            left: null,
            right: null
        };
        const preview = document.querySelector('.captured-preview');
        if (preview) preview.remove();
        this.validateForm();
        
        // Reset auto capture state
        this.resetAutoCapture();
        
        // Dừng auto capture nếu đang chạy
        if (this.autoCaptureEnabled) {
            this.stopAutoCapture();
        }
    }
    
    // ========== AUTO CAPTURE METHODS ==========
    
    async startAutoCapture() {
        // Kiểm tra trạng thái hiện tại
        if (this.autoCaptureEnabled) {
            console.log('Training: Auto capture đã đang chạy, bỏ qua...');
            return;
        }
        
        if (!window.cameraTest || !window.cameraTest.stream) {
            console.log('Training: Camera chưa sẵn sàng');
            return;
        }
        
        try {
            await this.loadMediaPipeScripts();
            await this.initMediaPipeFaceDetection();
            
            this.autoCaptureEnabled = true;
            this.autoCaptureStarted = true;
            this.currentCaptureStage = 'front';
            this.resetAutoCapture();
            
            // Tạo UI hướng dẫn auto capture
            this.createAutoCaptureUI();
            
        } catch (error) {
            console.error('Lỗi khởi động auto capture:', error);
        }
    }
    
    stopAutoCapture() {
        console.log('Training: Đang dừng auto capture...');
        
        // Dừng auto capture
        this.autoCaptureEnabled = false;
        this.autoCaptureStarted = false;
        
        // Dừng animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.removeAutoCaptureUI();
        
        // KHÔNG đóng mesh để có thể khởi động lại nhanh chóng
        // FaceMesh instance được giữ lại cho performance
        
        // Xóa overlay
        if (window.cameraTest && window.cameraTest.overlay) {
            const ctx = window.cameraTest.overlay.getContext('2d');
            ctx.clearRect(0, 0, window.cameraTest.overlay.width, window.cameraTest.overlay.height);
        }
        
        console.log('Training: Auto capture đã dừng, FaceMesh vẫn được giữ lại');
    }
    
    // Method để cleanup hoàn toàn FaceMesh (chỉ dùng khi cần thiết)
    async cleanupMediaPipe() {
        console.log('Training: Đang cleanup MediaPipe hoàn toàn...');
        
        // Dừng auto capture trước
        this.autoCaptureEnabled = false;
        this.autoCaptureStarted = false;
        
        // Dừng animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Đóng FaceMesh
        if (this.mesh) {
            try {
                await this.mesh.close();
                this.mesh = null;
                this.isInitialized = false;
                console.log('Training: FaceMesh đã được cleanup hoàn toàn');
            } catch (error) {
                console.warn('Training: Lỗi khi cleanup FaceMesh:', error);
            }
        }
    }
    
    // Method để kiểm tra và reset trạng thái khi cần
    async resetState() {
        console.log('Training: Đang reset trạng thái MediaPipe...');
        
        try {
            // Dừng mọi thứ
            this.autoCaptureEnabled = false;
            this.autoCaptureStarted = false;
            
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            
            // Cleanup hoàn toàn
            await this.cleanupMediaPipe();
            
            // Reset auto capture state
            this.resetAutoCapture();
            
            console.log('Training: Trạng thái đã được reset thành công');
        } catch (error) {
            console.error('Training: Lỗi khi reset trạng thái:', error);
        }
    }
    
    // Method để handle lỗi nghiêm trọng và force cleanup
    async handleCriticalError(error) {
        console.error('Training: Lỗi nghiêm trọng MediaPipe:', error);
        
        try {
            // Force cleanup hoàn toàn
            await this.resetState();
            
            // Hiển thị thông báo cho user
            this.showError('MediaPipe gặp lỗi nghiêm trọng. Đã reset trạng thái. Vui lòng thử lại.');
            
        } catch (cleanupError) {
            console.error('Training: Lỗi khi cleanup sau critical error:', cleanupError);
            this.showError('Lỗi nghiêm trọng. Vui lòng reload trang.');
        }
    }
    
    resetAutoCapture() {
        this.qualityHoldCount = 0;
        this.faceAngleHoldCount = 0;
        this.baselineQuality = { eyeFrac: 0, faceRatio: 0 };
        this.qualityLocked = false;
        this.currentCaptureStage = 'front';
    }
    
    async loadMediaPipeScripts() {
        return new Promise((resolve, reject) => {
            // Kiểm tra xem MediaPipe đã được load chưa
            if (window.mpFaceMesh && window.drawingUtils && window.Camera) {
                this.mpFaceMesh = window.mpFaceMesh || window;
                this.drawingUtils = window.drawingUtils || window;
                resolve();
                return;
            }
            
            // Kiểm tra HTTPS requirement
            if (!window.isSecureContext && location.hostname !== 'localhost') {
                reject(new Error('MediaPipe cần HTTPS hoặc localhost để hoạt động'));
                return;
            }
            
            let loadedCount = 0;
            const totalScripts = 3;
            let hasError = false;
            
            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === totalScripts && !hasError) {
                    this.mpFaceMesh = window.mpFaceMesh || window;
                    this.drawingUtils = window.drawingUtils || window;
                    resolve();
                }
            };
            
            const handleError = (error) => {
                if (!hasError) {
                    hasError = true;
                    reject(new Error(`Lỗi tải MediaPipe: ${error.message}`));
                }
            };
            
            // Load face_mesh.js với timeout
            if (!window.mpFaceMesh) {
                const script1 = document.createElement('script');
                script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
                script1.onload = checkComplete;
                script1.onerror = () => handleError(new Error('Không thể tải face_mesh.js'));
                
                // Timeout sau 10 giây
                const timeout1 = setTimeout(() => {
                    handleError(new Error('Timeout tải face_mesh.js'));
                }, 10000);
                
                script1.onload = () => {
                    clearTimeout(timeout1);
                    checkComplete();
                };
                
                document.head.appendChild(script1);
            } else {
                checkComplete();
            }
            
            // Load camera_utils.js với timeout
            if (!window.Camera) {
                const script2 = document.createElement('script');
                script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
                script2.onload = checkComplete;
                script2.onerror = () => handleError(new Error('Không thể tải camera_utils.js'));
                
                // Timeout sau 10 giây
                const timeout2 = setTimeout(() => {
                    handleError(new Error('Timeout tải camera_utils.js'));
                }, 10000);
                
                script2.onload = () => {
                    clearTimeout(timeout2);
                    checkComplete();
                };
                
                document.head.appendChild(script2);
            } else {
                checkComplete();
            }
            
            // Load drawing_utils.js với timeout
            if (!window.drawingUtils) {
                const script3 = document.createElement('script');
                script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
                script3.onload = checkComplete;
                script3.onerror = () => handleError(new Error('Không thể tải drawing_utils.js'));
                
                // Timeout sau 10 giây
                const timeout3 = setTimeout(() => {
                    handleError(new Error('Timeout tải drawing_utils.js'));
                }, 10000);
                
                script3.onload = () => {
                    clearTimeout(timeout3);
                    checkComplete();
                };
                
                document.head.appendChild(script3);
            } else {
                checkComplete();
            }
        });
    }
    
    createAutoCaptureUI() {
        // Tạo UI status nhỏ gọn
        const existingUI = document.getElementById('autoCaptureUI');
        if (existingUI) existingUI.remove();
        
        const autoCaptureUI = document.createElement('div');
        autoCaptureUI.id = 'autoCaptureUI';
        autoCaptureUI.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 300px;
        `;
        
        autoCaptureUI.innerHTML = `
            <div style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%; animation: pulse 1s infinite;"></div>
            <span id="autoCaptureStatus">Auto chụp: Bước 1/3 - Nhìn trực diện</span>
            <button id="stopAutoCapture" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 12px; cursor: pointer; font-size: 11px; margin-left: 4px;">
                ✕
            </button>
        `;
        
        // Thêm CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(autoCaptureUI);
        
        // Hiển thị hint-content có sẵn trong template
        this.showExistingHintContent();
        
        // Event listener cho nút dừng
        document.getElementById('stopAutoCapture').addEventListener('click', () => {
            this.stopAutoCapture();
        });
    }
    
    showExistingHintContent() {
        // Hiển thị hint-content có sẵn trong template
        const hintEl = document.getElementById('autoCaptureHint');
        if (hintEl) {
            hintEl.style.display = 'block';
        }
    }
    
    removeAutoCaptureUI() {
        const autoCaptureUI = document.getElementById('autoCaptureUI');
        if (autoCaptureUI) autoCaptureUI.remove();
        
        // Ẩn hint-content có sẵn khi dừng auto capture
        const hintEl = document.getElementById('autoCaptureHint');
        if (hintEl) {
            hintEl.style.display = 'none';
        }
    }
    
    updateAutoCaptureUI(stage, message) {
        const statusEl = document.getElementById('autoCaptureStatus');
        const hintEl = document.getElementById('autoCaptureHint');
        const hintTextEl = document.querySelector('.hint-text');
        
        if (statusEl) {
            // Đếm số ảnh đã chụp
            const capturedCount = Object.values(this.capturedImages).filter(img => img !== null).length;
            
            // Cập nhật text status với thông tin chi tiết
            const stageMap = { 
                front: `Bước 1/3 - Nhìn trực diện (${capturedCount}/3 ảnh)`, 
                right: `Bước 2/3 - Quay phải (${capturedCount}/3 ảnh)`, 
                left: `Bước 3/3 - Quay trái (${capturedCount}/3 ảnh)`,
                done: `Hoàn thành! Đã chụp ${capturedCount}/3 ảnh`
            };
            const stageText = stageMap[stage] || stage;
            statusEl.textContent = `Auto chụp: ${stageText}`;
        }
        
        // Cập nhật hint text dựa trên stage
        if (hintEl && hintTextEl) {
            const hintMap = {
                front: 'Nhìn TRỰC DIỆN & lại gần đến khi viền xanh → hệ thống tự chụp',
                right: 'QUAY PHẢI & lại gần đến khi viền xanh → hệ thống tự chụp',
                left: 'QUAY TRÁI & lại gần đến khi viền xanh → hệ thống tự chụp',
                done: 'Hoàn thành! Kiểm tra preview rồi nhấn Lưu người dùng'
            };
            const hintText = hintMap[stage] || hintMap.front;
            hintTextEl.textContent = hintText;
            
            // Hiển thị hint khi auto capture đang chạy
            if (stage !== 'done') {
                hintEl.style.display = 'block';
            } else {
                hintEl.style.display = 'none';
            }
        } else if (!hintEl) {
            // Nếu hint chưa tồn tại, hiển thị hint có sẵn
            this.showExistingHintContent();
        }
    }
    
    // Method để cập nhật hint-content với thông báo khoảng cách
    updateDistanceHint(needsToComeCloser) {
        const hintEl = document.getElementById('autoCaptureHint');
        const hintTextEl = document.querySelector('.hint-text');
        
        if (hintEl && hintTextEl) {
            if (needsToComeCloser) {
                // Hiển thị 'Lại gần' khi khung màu cam
                hintTextEl.textContent = 'Lại gần đến khi viền xanh';
                hintTextEl.style.color = '#f59e0b'; // Màu cam
                hintTextEl.style.fontWeight = 'bold';
            } else {
                // Hiển thị hint bình thường khi khung màu xanh
                const hintMap = {
                    front: 'Nhìn TRỰC DIỆN & lại gần đến khi viền xanh → hệ thống tự chụp',
                    right: 'QUAY PHẢI & lại gần đến khi viền xanh → hệ thống tự chụp',
                    left: 'QUAY TRÁI & lại gần đến khi viền xanh → hệ thống tự chụp',
                    done: 'Hoàn thành! Kiểm tra preview rồi nhấn Lưu người dùng'
                };
                const hintText = hintMap[this.currentCaptureStage] || hintMap.front;
                hintTextEl.textContent = hintText;
                hintTextEl.style.color = ''; // Reset màu
                hintTextEl.style.fontWeight = ''; // Reset font weight
            }
        }
    }
    
    // ========== MEDIAPIPE FACE DETECTION ==========
    
    async initMediaPipeFaceDetection() {
        try {
            // Chỉ khởi tạo FaceMesh nếu chưa có
            if (!this.mesh) {
                console.log('Training: Khởi tạo FaceMesh lần đầu...');
                
                // Khởi tạo FaceMesh với locateFile đúng cách
                this.mesh = new this.mpFaceMesh.FaceMesh({
                    locateFile: (file) => {
                        const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/';
                        return `${baseUrl}${file}`;
                    }
                });
                
                this.mesh.setOptions({ 
                    maxNumFaces: 1, 
                    refineLandmarks: true, 
                    minDetectionConfidence: 0.6, 
                    minTrackingConfidence: 0.6 
                });
                
                this.mesh.onResults((results) => this.onFaceDetectionResults(results));
                this.isInitialized = true;
                console.log('Training: FaceMesh đã được khởi tạo thành công');
            } else {
                console.log('Training: FaceMesh đã tồn tại, sử dụng lại...');
            }
            
            // Bắt đầu detection loop
            this.startFaceDetectionLoop();
            
        } catch (error) {
            console.error('Lỗi khởi tạo MediaPipe FaceMesh:', error);
            throw error;
        }
    }
    
    startFaceDetectionLoop() {
        // Dừng animation loop cũ nếu có
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        const detectFaces = async () => {
            // Kiểm tra điều kiện dừng
            if (!this.autoCaptureEnabled || !this.mesh || !window.cameraTest || !window.cameraTest.video) {
                this.animationId = requestAnimationFrame(detectFaces);
                return;
            }
            
            try {
                const video = window.cameraTest.video;
                if (video.readyState >= 2) {
                    await this.mesh.send({ image: video });
                }
            } catch (error) {
                console.warn('Lỗi phát hiện khuôn mặt:', error);
                
                // Kiểm tra lỗi nghiêm trọng
                if (error.message && (
                    error.message.includes('abort') || 
                    error.message.includes('Module.arguments') ||
                    error.message.includes('RuntimeError')
                )) {
                    console.error('Training: MediaPipe bị lỗi nghiêm trọng, xử lý cleanup...');
                    this.handleCriticalError(error);
                    return;
                }
            }
            
            this.animationId = requestAnimationFrame(detectFaces);
        };
        
        detectFaces();
    }
    
    
    onFaceDetectionResults(results) {
        if (!this.autoCaptureEnabled) return;
        
        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks[0];
        if (!landmarks) {
            this.qualityHoldCount = 0;
            this.faceAngleHoldCount = 0;
            return;
        }
        
        // Vẽ overlay trên video
        this.drawFaceOverlay(results);
        
        // Tính toán chất lượng và góc khuôn mặt
        const faceBox = this.getFullFaceBox(landmarks, results.image.width, results.image.height);
        const faceRatio = (faceBox.w * faceBox.h) / (results.image.width * results.image.height);
        const eyeFrac = Math.abs(landmarks[263].x - landmarks[33].x);
        const yaw = this.simpleYaw(landmarks);
        
        // Kiểm tra chất lượng và góc khuôn mặt
        this.checkQualityAndCapture(faceBox, faceRatio, eyeFrac, yaw);
    }
    
    drawFaceOverlay(results) {
        const video = window.cameraTest.video;
        const overlay = window.cameraTest.overlay;
        const ctx = overlay.getContext('2d');
        
        // Đồng bộ kích thước overlay
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
        }
        
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.drawImage(results.image, 0, 0, overlay.width, overlay.height);
        
        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks[0];
        if (landmarks) {
            // Vẽ oval khuôn mặt theo cách của camera-performance.html
            this.drawingUtils.drawConnectors(ctx, landmarks, this.mpFaceMesh.FACEMESH_FACE_OVAL, { 
                lineWidth: 1.0
            });
            
            // Vẽ khung khuôn mặt
            const faceBox = this.getFullFaceBox(landmarks, overlay.width, overlay.height);
            const isGoodQuality = this.qualityHoldCount >= this.getQualityThreshold();
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = isGoodQuality ? 'rgba(34,197,94,0.95)' : 'rgba(245,158,11,0.95)';
            ctx.strokeRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
            
            // Cập nhật hint-content để hiển thị "Lại gần" khi khung màu cam
            this.updateDistanceHint(!isGoodQuality);
        }
    }
    
    getFullFaceBox(landmarks, W, H) {
        const li = i => landmarks[i] || null;
        const topP = li(10), botP = li(152), leftP = li(234), rightP = li(454);
        
        let minX = Math.min(leftP?.x ?? 1, ...landmarks.map(p => p.x));
        let maxX = Math.max(rightP?.x ?? 0, ...landmarks.map(p => p.x));
        let minY = Math.min(topP?.y ?? 1, ...landmarks.map(p => p.y));
        let maxY = Math.max(botP?.y ?? 0, ...landmarks.map(p => p.y));

        let x = minX * W, y = minY * H, w = (maxX - minX) * W, h = (maxY - minY) * H;

        // Biên: ngang ~28%, trên ~30%, dưới ~42%
        const mx = w * 0.28, myTop = h * 0.30, myBot = h * 0.42;

        x = Math.max(0, x - mx);
        y = Math.max(0, y - myTop);
        w = Math.min(W - x, w + 2 * mx);
        h = Math.min(H - y, h + myTop + myBot);

        if (x + w > W) w = W - x;
        if (y + h > H) h = H - y;

        return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    }
    
    simpleYaw(landmarks) {
        const L = landmarks[33], R = landmarks[263], N = landmarks[1];
        const midX = (L.x + R.x) / 2, eyeDist = Math.max(0.0001, Math.abs(R.x - L.x));
        return (N.x - midX) / eyeDist; // âm: trái | dương: phải
    }
    
    checkQualityAndCapture(faceBox, faceRatio, eyeFrac, yaw) {
        const stage = this.currentCaptureStage;
        if (stage === 'done') return;
        
        // Tính toán ngưỡng chất lượng
        let proxThr = (stage === 'front') ? this.PROX_FRONT : this.PROX_SIDE;
        let faceThr = (stage === 'front') ? this.FACE_FRONT : this.FACE_SIDE;
        
        if (this.qualityLocked && stage !== 'front') {
            proxThr = Math.min(proxThr, this.baselineQuality.eyeFrac * 0.70);
            faceThr = Math.min(faceThr, this.baselineQuality.faceRatio * 0.75);
        }
        
        const need = (stage === 'front') ? this.QHOLD_FRONT : this.QHOLD_SIDE;
        const qNow = (eyeFrac >= proxThr) && (faceRatio >= faceThr);
        this.qualityHoldCount = qNow ? (this.qualityHoldCount + 1) : 0;
        
        if (this.qualityHoldCount >= need) {
            // Kiểm tra góc khuôn mặt
            let angleValid = false;
            let angleMessage = '';
            
            if (stage === 'front') {
                angleValid = Math.abs(yaw) <= this.FRONT_THR;
                angleMessage = 'giữ TRỰC DIỆN';
            } else if (stage === 'right') {
                angleValid = yaw <= -this.YAW_THR;
                angleMessage = 'QUAY PHẢI';
            } else if (stage === 'left') {
                angleValid = yaw >= this.YAW_THR;
                angleMessage = 'QUAY TRÁI';
            }
            
            if (angleValid) {
                this.faceAngleHoldCount++;
                if (this.faceAngleHoldCount >= this.HOLD_FR) {
                    this.captureCurrentStage(faceBox, eyeFrac, faceRatio);
                    this.faceAngleHoldCount = 0;
                }
            } else {
                this.faceAngleHoldCount = 0;
            }
            
            // Không cần cập nhật UI ở đây vì đã có status cố định
        } else {
            this.faceAngleHoldCount = 0;
            // Không cần cập nhật UI ở đây vì đã có status cố định
        }
    }
    
    getQualityThreshold() {
        const stage = this.currentCaptureStage;
        return (stage === 'front') ? this.QHOLD_FRONT : this.QHOLD_SIDE;
    }
    
    captureCurrentStage(faceBox, eyeFrac, faceRatio) {
        try {
            const img = window.cameraTest.captureImagePure();
            const stage = this.currentCaptureStage;
            
            this.capturedImages[stage] = img;
            
            // Cập nhật baseline quality cho front
            if (stage === 'front' && !this.qualityLocked) {
                this.qualityLocked = true;
                this.baselineQuality = { eyeFrac, faceRatio };
            }
            
            // Chuyển sang bước tiếp theo
            this.moveToNextStage();
            
            this.renderCapturedPreview();
            this.validateForm();
            
            // Cập nhật UI với thông tin mới
            this.updateAutoCaptureUI(this.currentCaptureStage, '');
            
        } catch (error) {
            console.error('Lỗi chụp ảnh:', error);
        }
    }
    
    moveToNextStage() {
        if (this.currentCaptureStage === 'front') {
            this.currentCaptureStage = 'right';
            this.updateAutoCaptureUI('right', '');
        } else if (this.currentCaptureStage === 'right') {
            this.currentCaptureStage = 'left';
            this.updateAutoCaptureUI('left', '');
        } else if (this.currentCaptureStage === 'left') {
            this.currentCaptureStage = 'done';
            this.updateAutoCaptureUI('done', '');
            
            // Dừng auto capture ngay lập tức
            this.stopAutoCapture();
        }
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
    const trainingApp = new TrainingApp();
    window.trainingApp = trainingApp; // Cho phép camera_new.js truy cập
    
    // Tự động bắt đầu auto capture khi camera được bật
    const originalStartCamera = window.cameraManager?.startCamera;
    if (originalStartCamera) {
        window.cameraManager.startCamera = async function(...args) {
            const result = await originalStartCamera.apply(this, args);
            
            // Đợi một chút để camera ổn định
            setTimeout(() => {
                if (trainingApp && !trainingApp.autoCaptureStarted) {
                    trainingApp.startAutoCapture();
                }
            }, 1000);
            
            return result;
        };
    }
}); 