class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.overlay = document.getElementById('overlay');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.startButton = document.getElementById('startCamera');
        this.stopButton = document.getElementById('stopCamera');
        this.stream = null;
        this.cameras = [];
        this.detecting = false;
        this.faceApiLoaded = false;
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadCameras();
            this.setupEventListeners();
        } catch (error) {
            console.error('Lỗi khởi tạo camera:', error);
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
            // Load face-api.js
            if (!window.faceapi) {
                await this.loadFaceApiScript('/static/face-api/dist/face-api.js');
            }
            
            if (!window.__faceApiModelsLoaded) {
                const base = '/static/face-api/model';
                try {
                    await faceapi.nets.tinyFaceDetector.loadFromUri(base);
                    window.__faceApiModelsLoaded = true;
                    this.faceApiLoaded = true;
                } catch (e) {
                    console.warn('Không thể tải model face-api:', e);
                    this.showError('Không thể tải model nhận diện khuôn mặt');
                    return;
                }
            }

            let constraints;
            if (selectedIndex === 'default') {
                constraints = { video: true };
            } else {
                constraints = {
                    video: {
                        deviceId: this.cameras[selectedIndex].deviceId ? { exact: this.cameras[selectedIndex].deviceId } : undefined
                    }
                };
            }
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.video.onloadedmetadata = () => {
                this.setupOverlay();
                this.startFaceDetection();
                this.startButton.disabled = true;
                this.stopButton.disabled = false;
                this.cameraSelect.disabled = true;
                
                // Kích hoạt các nút liên quan
                const scanButton = document.getElementById('scanFace');
                if (scanButton) {
                    scanButton.disabled = false;
                }
                
                const autoScanButton = document.getElementById('autoScanToggle');
                if (autoScanButton) {
                    autoScanButton.disabled = false;
                }
                
                // Kích hoạt nút chụp khuôn mặt cho training page
                const captureButton = document.getElementById('captureFace');
                if (captureButton) {
                    captureButton.disabled = false;
                }
                
                // Tự động bật chế độ quét tự động
                if (window.faceRecognitionApp && typeof window.faceRecognitionApp.startAutoScan === 'function') {
                    setTimeout(() => {
                        window.faceRecognitionApp.startAutoScan();
                    }, 500);
                }
            };
            
        } catch (error) {
            console.error('Lỗi khởi động camera:', error);
            let errorMessage = 'Không thể khởi động camera. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Vui lòng cấp quyền truy cập camera.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'Không tìm thấy camera.';
            } else {
                errorMessage += 'Vui lòng kiểm tra quyền truy cập.';
            }
            this.showError(errorMessage);
        }
    }
    
    loadFaceApiScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        });
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
        this.detecting = false;
        
        // Vô hiệu hóa các nút liên quan
        const scanButton = document.getElementById('scanFace');
        if (scanButton) {
            scanButton.disabled = true;
        }
        
        const autoScanButton = document.getElementById('autoScanToggle');
        if (autoScanButton) {
            autoScanButton.disabled = true;
        }
        
        // Vô hiệu hóa nút chụp khuôn mặt cho training page
        const captureButton = document.getElementById('captureFace');
        if (captureButton) {
            captureButton.disabled = true;
        }
        
        // Tắt chế độ tự động quét
        if (window.faceRecognitionApp && typeof window.faceRecognitionApp.stopAutoScan === 'function') {
            window.faceRecognitionApp.stopAutoScan();
        }
    }
    
    captureImage() {
        if (!this.stream) {
            throw new Error('Camera chưa được khởi động');
        }
        
        if (!this.canvas) {
            throw new Error('Canvas không tồn tại');
        }
        
        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        context.drawImage(this.video, 0, 0);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    setupOverlay() {
        const rect = this.video.getBoundingClientRect();
        this.overlay.width = rect.width;
        this.overlay.height = rect.height;
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
        
    }
    
    startFaceDetection() {
        if (!this.faceApiLoaded) {
            console.error('Face-api chưa được load');
            return;
        }
        
        this.detecting = true;
        
        const detectFaces = async () => {
            if (!this.detecting || !this.video || this.video.readyState < 2) {
                requestAnimationFrame(detectFaces);
                return;
            }
            
            try {
                const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.3
                }));
                
                this.drawFaces(detections);
                
                // Gọi hàm scanFace từ main.js nếu có khuôn mặt
                if (detections.length > 0 && window.faceRecognitionApp && typeof window.faceRecognitionApp.scanFace === 'function') {
                    // Chỉ gọi scanFace nếu đang ở chế độ tự động quét
                    if (window.faceRecognitionApp.autoScanEnabled) {
                        window.faceRecognitionApp.scanFace();
                    }
                }
                
            } catch (error) {
                console.warn('Lỗi phát hiện khuôn mặt:', error);
            }
            
            requestAnimationFrame(detectFaces);
        };
        
        detectFaces();
    }
    
    drawFaces(detections) {
        const ctx = this.overlay.getContext('2d');
        if (!ctx) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        
        if (detections.length === 0) return;
        
        // Calculate scale
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        const scaleX = this.overlay.width / videoWidth;
        const scaleY = this.overlay.height / videoHeight;
        
        // Draw face rectangles
        ctx.strokeStyle = '#22c55e';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.lineWidth = 3;
        
        detections.forEach((detection, index) => {
            const box = detection.box;
            const x = box.x * scaleX;
            const y = box.y * scaleY;
            const width = box.width * scaleX;
            const height = box.height * scaleY;
            
            // Draw rectangle
            ctx.strokeRect(x, y, width, height);
            ctx.fillRect(x, y, width, height);
        });
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
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Khởi tạo camera manager khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    window.cameraManager = new CameraManager();
    // Tương thích với training page
    window.cameraTest = window.cameraManager;
});
