class MediaPipeCameraManager {
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
        this.currentFaceAngle = 'unknown';
        
        // MediaPipe objects
        this.mesh = null;
        this.camera = null;
        this.mpFaceMesh = null;
        this.drawingUtils = null;
        
        // Face detection state
        this.stableCounter = 0;
        this.lastX = null;
        this.cooling = false;
        
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
    
    async loadMediaPipeScripts() {
        return new Promise((resolve, reject) => {
            // Kiểm tra xem MediaPipe đã được load chưa
            if (window.mpFaceMesh && window.drawingUtils && window.Camera) {
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
    
    
    async startCamera() {
        const selectedIndex = this.cameraSelect.value;
        if (!selectedIndex) {
            this.showError('Vui lòng chọn camera trước.');
            return;
        }
        
        try {
            // Load MediaPipe scripts
            await this.loadMediaPipeScripts();
            this.mpFaceMesh = window.mpFaceMesh || window;
            this.drawingUtils = window.drawingUtils || window;
            console.log('MediaPipe loaded successfully');
            
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
                this.initMediaPipe();
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
            
            if (error.message && error.message.includes('MediaPipe')) {
                errorMessage += 'MediaPipe không thể tải. Vui lòng kiểm tra kết nối internet và thử lại.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage += 'Vui lòng cấp quyền truy cập camera.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'Không tìm thấy camera.';
            } else if (error.message && error.message.includes('HTTPS')) {
                errorMessage += 'MediaPipe cần HTTPS hoặc localhost để hoạt động.';
            } else {
                errorMessage += 'Vui lòng kiểm tra quyền truy cập và kết nối internet.';
            }
            
            this.showError(errorMessage);
        }
    }
    
    async initMediaPipe() {
        try {
            // Khởi tạo FaceMesh
            this.mesh = new this.mpFaceMesh.FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            
            this.mesh.setOptions({ 
                maxNumFaces: 1, 
                refineLandmarks: true, 
                minDetectionConfidence: 0.6, 
                minTrackingConfidence: 0.6 
            });
            
            this.mesh.onResults((results) => this.onResults(results));
            
            // Sử dụng requestAnimationFrame thay vì MediaPipe Camera
            // để tránh việc MediaPipe xử lý ảnh
            this.startFaceDetectionLoop();
            this.detecting = true;
            
        } catch (error) {
            console.error('Lỗi khởi tạo MediaPipe:', error);
            this.showError('Không thể khởi động MediaPipe');
        }
    }
    
    startFaceDetectionLoop() {
        const detectFaces = async () => {
            if (!this.detecting || !this.video || this.video.readyState < 2) {
                requestAnimationFrame(detectFaces);
                return;
            }
            
            try {
                // Gửi ảnh trực tiếp từ video element (không qua MediaPipe Camera)
                await this.mesh.send({ image: this.video });
            } catch (error) {
                console.warn('Lỗi phát hiện khuôn mặt:', error);
            }
            
            requestAnimationFrame(detectFaces);
        };
        
        detectFaces();
    }
    
    onResults(results) {
        // Đồng bộ overlay
        if (this.overlay.width === 0 || this.overlay.height === 0) {
            this.setupOverlay();
        }
        
        const ctx = this.overlay.getContext('2d');
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        ctx.drawImage(results.image, 0, 0, this.overlay.width, this.overlay.height);
        
        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks[0];
        if (!landmarks) {
            this.stableCounter = 0;
            this.lastX = null;
            return;
        }
        
        // Vẽ oval nhẹ
        this.drawingUtils.drawConnectors(ctx, landmarks, this.mpFaceMesh.FACEMESH_FACE_OVAL, { 
            lineWidth: 1.0,
            color: 'rgba(255, 255, 255, 0.6)'
        });
        
        // Phát hiện góc khuôn mặt
        this.currentFaceAngle = this.detectFaceAngle(landmarks);
        
        // Tính toán vị trí khuôn mặt để ổn định
        const faceBox = this.getFaceBox(landmarks);
        if (faceBox) {
            const x = faceBox.x;
            const stable = this.lastX === null || Math.abs(x - this.lastX) < 8;
            this.stableCounter = stable ? this.stableCounter + 1 : 0;
            this.lastX = x;
            
            // Vẽ khung khuôn mặt
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 3;
            ctx.strokeRect(faceBox.x, faceBox.y, faceBox.width, faceBox.height);
            
            // Gọi scanFace nếu ổn định và đang ở chế độ tự động quét
            if (this.stableCounter >= 4 && !this.cooling && 
                window.faceRecognitionApp && 
                window.faceRecognitionApp.autoScanEnabled &&
                typeof window.faceRecognitionApp.scanFace === 'function') {
                
                try {
                    window.faceRecognitionApp.scanFace();
                    this.cooling = true;
                    setTimeout(() => { this.cooling = false; }, 1500);
                } catch (error) {
                    console.error('Lỗi gọi scanFace:', error);
                }
                this.stableCounter = 0;
            }
        } else {
            this.stableCounter = 0;
            this.lastX = null;
        }
    }
    
    // Phát hiện góc khuôn mặt sử dụng MediaPipe landmarks
    detectFaceAngle(landmarks) {
        if (!landmarks || landmarks.length < 468) return 'unknown';
        
        try {
            // Sử dụng các điểm mắt và mũi từ MediaPipe
            const leftEye = landmarks[33];   // Mắt trái
            const rightEye = landmarks[263]; // Mắt phải
            const nose = landmarks[1];      // Đầu mũi
            
            if (!leftEye || !rightEye || !nose) return 'unknown';
            
            const midX = (leftEye.x + rightEye.x) / 2;
            const eyeDist = Math.max(0.0001, Math.abs(rightEye.x - leftEye.x));
            const angleRatio = (nose.x - midX) / eyeDist;
            
            // Phân loại góc dựa trên tỷ lệ
            if (angleRatio < -0.3) {
                return 'left'; // Quay trái
            } else if (angleRatio > 0.3) {
                return 'right'; // Quay phải
            } else {
                return 'front'; // Chính diện
            }
        } catch (error) {
            console.warn('Lỗi phát hiện góc khuôn mặt:', error);
            return 'unknown';
        }
    }
    
    // Lấy bounding box của khuôn mặt
    getFaceBox(landmarks) {
        if (!landmarks || landmarks.length < 468) return null;
        
        try {
            let minX = 1, maxX = 0, minY = 1, maxY = 0;
            
            // Sử dụng các điểm quan trọng của khuôn mặt
            const importantPoints = [
                10, 152, 234, 454, // Các điểm góc
                33, 263, // Mắt
                1, 2, 3, 4, 5, // Mũi
                61, 84, 17, 18, 19, 20, 21, // Miệng
                172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323 // Jawline
            ];
            
            importantPoints.forEach(index => {
                if (landmarks[index]) {
                    minX = Math.min(minX, landmarks[index].x);
                    maxX = Math.max(maxX, landmarks[index].x);
                    minY = Math.min(minY, landmarks[index].y);
                    maxY = Math.max(maxY, landmarks[index].y);
                }
            });
            
            const width = (maxX - minX) * this.overlay.width;
            const height = (maxY - minY) * this.overlay.height;
            const x = minX * this.overlay.width;
            const y = minY * this.overlay.height;
            
            return { x, y, width, height };
        } catch (error) {
            console.warn('Lỗi tính toán face box:', error);
            return null;
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Không cần stop MediaPipe Camera vì không sử dụng nó nữa
        // if (this.camera) {
        //     this.camera.stop();
        //     this.camera = null;
        // }
        
        if (this.mesh) {
            this.mesh.close();
            this.mesh = null;
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
        
        // Đảm bảo canvas có kích thước chính xác với video gốc
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Vẽ trực tiếp từ video element gốc (không qua MediaPipe, không qua overlay)
        // Đảm bảo ảnh hoàn toàn nguyên gốc
        context.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
        
        // Trả về ảnh gốc với chất lượng cao nhất
        return this.canvas.toDataURL('image/jpeg', 0.95);
    }
    
    // Method để capture ảnh trực tiếp từ video stream (không qua canvas)
    captureImageDirect() {
        if (!this.stream) {
            throw new Error('Camera chưa được khởi động');
        }
        
        // Tạo canvas tạm thời để capture
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set kích thước canvas tạm thời theo video gốc
        tempCanvas.width = this.video.videoWidth;
        tempCanvas.height = this.video.videoHeight;
        
        // Vẽ trực tiếp từ video element gốc (không qua MediaPipe)
        tempCtx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
        
        // Trả về ảnh gốc với chất lượng cao nhất
        return tempCanvas.toDataURL('image/jpeg', 0.95);
    }
    
    // Method capture ảnh hoàn toàn nguyên gốc (không qua bất kỳ xử lý nào)
    captureImagePure() {
        if (!this.stream) {
            throw new Error('Camera chưa được khởi động');
        }
        
        // Tạo canvas tạm thời với kích thước chính xác
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Lấy kích thước thực tế của video
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        
        // Set kích thước canvas chính xác
        tempCanvas.width = videoWidth;
        tempCanvas.height = videoHeight;
        
        // Vẽ trực tiếp từ video element (không resize, không crop)
        tempCtx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
        
        // Trả về ảnh hoàn toàn nguyên gốc
        return tempCanvas.toDataURL('image/jpeg', 1.0); // Chất lượng tối đa
    }
    
    // Lấy góc khuôn mặt hiện tại
    getCurrentFaceAngle() {
        return this.currentFaceAngle;
    }

    setupOverlay() {
        const rect = this.video.getBoundingClientRect();
        this.overlay.width = rect.width;
        this.overlay.height = rect.height;
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
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
    window.cameraManager = new MediaPipeCameraManager();
    // Tương thích với training page
    window.cameraTest = window.cameraManager;
});