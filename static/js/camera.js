class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.startButton = document.getElementById('startCamera');
        this.stopButton = document.getElementById('stopCamera');
        this.stream = null;
        this.cameras = [];
        
        this.init();
    }
    
    async init() {
        try {
            // Đợi một chút để đảm bảo DOM đã sẵn sàng
            await new Promise(resolve => setTimeout(resolve, 100));
            
            await this.loadCameras();
            this.setupEventListeners();
        } catch (error) {
            console.error('Lỗi khởi tạo camera:', error);
            this.showError('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
        }
    }
    
    async loadCameras() {
        try {
            // Kiểm tra xem mediaDevices có tồn tại không
            if (!navigator.mediaDevices) {
                // Thử fallback cho các trình duyệt cũ
                if (navigator.getUserMedia) {
                    navigator.mediaDevices = {
                        getUserMedia: function(constraints) {
                            return new Promise((resolve, reject) => {
                                navigator.getUserMedia(constraints, resolve, reject);
                            });
                        },
                        enumerateDevices: function() {
                            return Promise.resolve([]);
                        }
                    };
                } else {
                    throw new Error('MediaDevices API không được hỗ trợ trong trình duyệt này');
                }
            }
            
            // Thêm option mặc định trước
            this.cameraSelect.innerHTML = '<option value="">Chọn camera...</option>';
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = 'Camera mặc định';
            this.cameraSelect.appendChild(defaultOption);
            
            try {
                // Yêu cầu quyền camera trước khi enumerate devices
                await navigator.mediaDevices.getUserMedia({ video: true });
                
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.cameras = devices.filter(device => device.kind === 'videoinput');
                
                // Xóa option mặc định và thêm lại các camera
                this.cameraSelect.innerHTML = '<option value="">Chọn camera...</option>';
                
                if (this.cameras.length > 0) {
                    this.cameras.forEach((camera, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = camera.label || `Camera ${index + 1}`;
                        this.cameraSelect.appendChild(option);
                    });
                } else {
                    // Nếu không có camera nào, thêm option mặc định
                    const option = document.createElement('option');
                    option.value = 'default';
                    option.textContent = 'Camera mặc định';
                    this.cameraSelect.appendChild(option);
                }
                
            } catch (permissionError) {
                console.log('Không có quyền camera, sử dụng camera mặc định');
                // Giữ lại option mặc định đã thêm ở trên
            }
            
        } catch (error) {
            console.error('Lỗi tải danh sách camera:', error);
            this.showError('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
            
            // Thêm option mặc định nếu có lỗi
            this.cameraSelect.innerHTML = '<option value="">Chọn camera...</option>';
            const option = document.createElement('option');
            option.value = 'default';
            option.textContent = 'Camera mặc định';
            this.cameraSelect.appendChild(option);
        }
    }
    
    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.startCamera());
        this.stopButton.addEventListener('click', () => this.stopCamera());
        this.cameraSelect.addEventListener('change', () => {
            if (this.stream) {
                this.stopCamera();
            }
        });
    }
    
    async startCamera() {
        const selectedIndex = this.cameraSelect.value;
        if (!selectedIndex) {
            this.showError('Vui lòng chọn camera trước.');
            return;
        }
        
        try {
            let constraints;
            
            if (selectedIndex === 'default') {
                // Sử dụng camera mặc định
                constraints = { video: true };
            } else {
                // Sử dụng camera cụ thể
                constraints = {
                    video: {
                        deviceId: this.cameras[selectedIndex].deviceId ? { exact: this.cameras[selectedIndex].deviceId } : undefined
                    }
                };
            }
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.cameraSelect.disabled = true;
            
            // Kích hoạt nút quét khuôn mặt nếu có
            const scanButton = document.getElementById('scanFace');
            if (scanButton) {
                scanButton.disabled = false;
            }
            
            // Kích hoạt nút chụp khuôn mặt nếu có
            const captureButton = document.getElementById('captureFace');
            if (captureButton) {
                captureButton.disabled = false;
            }
            
            // Kích hoạt nút tự động quét nếu có
            const autoScanButton = document.getElementById('autoScanToggle');
            if (autoScanButton) {
                autoScanButton.disabled = false;
            }
            
            // Tự động bật chế độ quét tự động khi camera được bật
            if (window.faceRecognitionApp && typeof window.faceRecognitionApp.startAutoScan === 'function') {
                // Chờ một chút để đảm bảo UI đã được cập nhật
                setTimeout(() => {
                    window.faceRecognitionApp.startAutoScan();
                }, 500);
            }
            
        } catch (error) {
            console.error('Lỗi khởi động camera:', error);
            
            let errorMessage = 'Không thể khởi động camera. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Vui lòng cấp quyền truy cập camera.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'Không tìm thấy camera.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'Trình duyệt không hỗ trợ camera.';
            } else {
                errorMessage += 'Vui lòng kiểm tra quyền truy cập.';
            }
            
            this.showError(errorMessage);
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video.srcObject = null;
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.cameraSelect.disabled = false;
        
        // Vô hiệu hóa các nút liên quan
        const scanButton = document.getElementById('scanFace');
        if (scanButton) {
            scanButton.disabled = true;
        }
        
        const captureButton = document.getElementById('captureFace');
        if (captureButton) {
            captureButton.disabled = true;
        }
        
        const autoScanButton = document.getElementById('autoScanToggle');
        if (autoScanButton) {
            autoScanButton.disabled = true;
        }
        
        // Tắt chế độ tự động quét khi camera bị tắt
        if (window.faceRecognitionApp && typeof window.faceRecognitionApp.stopAutoScan === 'function') {
            window.faceRecognitionApp.stopAutoScan();
        }
    }
    
    captureImage() {
        if (!this.stream) {
            throw new Error('Camera chưa được khởi động');
        }
        
        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        context.drawImage(this.video, 0, 0);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }
    
    showError(message) {
        // Tạo thông báo lỗi
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

// Khởi tạo camera manager khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    window.cameraManager = new CameraManager();
}); 