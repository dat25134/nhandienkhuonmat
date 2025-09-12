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
        this.stableCounter = 0;
        this.lastX = null;
        this.cooling = false;
        
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
            // Lazy-load face-api library if not loaded
            if (!window.faceapi) {
                await this.loadFaceApiScript('/static/face-api/dist/face-api.js');
            }
            // Ensure tinyFaceDetector model is loaded
            if (!window.__faceApiModelsLoaded) {
                const base = '/static/face-api/model';
                try {
                    await faceapi.nets.tinyFaceDetector.loadFromUri(base);
                    window.__faceApiModelsLoaded = true;
                } catch (e) {
                    console.warn('Không thể tải model face-api:', e);
                }
            }

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
            // Khi metadata có, resize overlay và bắt đầu realtime detection
            const onReady = () => {
                this.updateOverlaySize();
                this.startRealtimeDetection();
            };
            if (this.video.readyState >= 1) onReady(); else this.video.onloadedmetadata = onReady;
            
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

    loadFaceApiScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.defer = true;
            s.onload = () => resolve();
            s.onerror = reject;
            document.head.appendChild(s);
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

    updateOverlaySize() {
        if (!this.overlay || !this.video) return;
        const rect = this.video.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.overlay.width = Math.max(1, Math.floor(rect.width * dpr));
        this.overlay.height = Math.max(1, Math.floor(rect.height * dpr));
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
        const ctx = this.overlay.getContext('2d');
        if (ctx && dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    async startRealtimeDetection() {
        if (!window.faceapi) return;
        try {
            if (!window.__faceApiModelsLoaded) {
                const base = '/static/face-api/model';
                await faceapi.nets.tinyFaceDetector.loadFromUri(base);
                window.__faceApiModelsLoaded = true;
            }
        } catch (e) {
            console.warn('Không thể tải model face-api:', e);
            return;
        }

        this.detecting = true;
        const loop = async () => {
            if (!this.detecting || !this.video || this.video.readyState < 2) return requestAnimationFrame(loop);
            const ctx = this.overlay ? this.overlay.getContext('2d') : null;
            if (ctx) ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

            // Phát hiện khuôn mặt
            let detections = [];
            try {
                detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }));
            } catch (_) {}

            // Vẽ khung nếu có
            if (ctx && detections && detections.length) {
                const dpr = window.devicePixelRatio || 1;
                const cssW = this.overlay.width / dpr;
                const cssH = this.overlay.height / dpr;
                const vw = this.video.videoWidth || cssW;
                const vh = this.video.videoHeight || cssH;
                const scale = Math.max(cssW / vw, cssH / vh);
                const offsetX = (cssW - vw * scale) / 2;
                const offsetY = (cssH - vh * scale) / 2;
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#22c55e';
                detections.forEach(d => {
                    const r = d.box;
                    const x = (offsetX + r.x * scale) * dpr;
                    const y = (offsetY + r.y * scale) * dpr;
                    const w = (r.width * scale) * dpr;
                    const h = (r.height * scale) * dpr;
                    ctx.strokeRect(x, y, w, h);
                });
            }

            // Ổn định và gọi BE
            if (detections && detections.length) {
                const x = detections[0].box.x | 0;
                const stable = this.lastX === null || Math.abs(x - this.lastX) < 8;
                this.stableCounter = stable ? this.stableCounter + 1 : 0;
                this.lastX = x;
                if (this.stableCounter >= 4 && !this.cooling) {
                    try {
                        if (window.faceRecognitionApp && typeof window.faceRecognitionApp.scanFace === 'function') {
                            window.faceRecognitionApp.scanFace();
                            this.cooling = true;
                            setTimeout(() => { this.cooling = false; }, 1500);
                        }
                    } catch (_) {}
                    this.stableCounter = 0;
                }
            } else {
                this.stableCounter = 0;
                this.lastX = null;
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
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