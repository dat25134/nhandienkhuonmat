class WelcomeCameraManager {
    constructor() {
        this.video = document.getElementById('cameraVideo');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.startButton = document.getElementById('cameraToggle');
        this.overlay = document.getElementById('cameraOverlay');
        this.stream = null;
        this.cameras = [];
        this.detecting = false;
        this.isInitialized = false;
        
        // MediaPipe objects (exactly like index.html)
        this.mesh = null;
        this.camera = null;
        this.mpFaceMesh = null;
        this.drawingUtils = null;
        
        // Animation loop management
        this.animationId = null;
        
        // Face detection state
        this.stableCounter = 0;
        this.lastX = null;
        this.cooling = false;
        
        // Auto scan settings (optimized for better performance)
        this.detectionInterval = null;
        this.lastCheckinTime = 0;
        this.checkinCooldown = 1000; // 1 second cooldown between check-ins (reduced from 5s)
        
        // Queue system for handling multiple people
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Callback for check-in events
        this.onCheckin = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadCameras();
            this.setupEventListeners();
        } catch (error) {
            console.error('[WELCOME_CAMERA] Lỗi khởi tạo camera:', error);
        }
    }
    
    async loadCameras() {
        try {
            // Kiểm tra xem mediaDevices có tồn tại không (same as index.html)
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
            console.error('[WELCOME_CAMERA] Lỗi tải danh sách camera:', error);
        }
    }
    
    setupEventListeners() {
        // Camera toggle button
        this.startButton.addEventListener('click', () => this.toggleCamera());
        
        // Camera selection
        this.cameraSelect.addEventListener('change', () => {
            if (this.detecting) {
                this.stopCamera();
                setTimeout(() => this.startCamera(), 100);
            }
        });
    }
    
    async loadMediaPipeScripts() {
        return new Promise((resolve, reject) => {
            // Kiểm tra xem MediaPipe đã được load chưa (same as index.html)
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
            
            // Load face_mesh.js với timeout (same as index.html)
            if (!window.mpFaceMesh) {
                const script1 = document.createElement('script');
                script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
                script1.onload = checkComplete;
                script1.onerror = () => handleError(new Error('Không thể tải face_mesh.js'));
                
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
            
            // Load camera_utils.js với timeout (same as index.html)
            if (!window.Camera) {
                const script2 = document.createElement('script');
                script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
                script2.onload = checkComplete;
                script2.onerror = () => handleError(new Error('Không thể tải camera_utils.js'));
                
                // Timeout sau 10 giây (same as index.html)
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
            
            // Load drawing_utils.js với timeout (same as index.html)
            if (!window.drawingUtils) {
                const script3 = document.createElement('script');
                script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
                script3.onload = checkComplete;
                script3.onerror = () => handleError(new Error('Không thể tải drawing_utils.js'));
                
                // Timeout sau 10 giây (same as index.html)
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
            return;
        }
        
        if (this.detecting) {
            return;
        }
        
        try {
            // Load MediaPipe scripts (same as index.html)
            await this.loadMediaPipeScripts();
            this.mpFaceMesh = window.mpFaceMesh || window;
            this.drawingUtils = window.drawingUtils || window;
            
            let constraints;
            if (selectedIndex === 'default') {
                constraints = { video: true };
            } else {
                const deviceId = this.cameras[selectedIndex].deviceId;
                constraints = { video: { deviceId: { exact: deviceId } } };
            }
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.video.onloadedmetadata = () => {
                this.setupOverlay();
                this.initMediaPipe();
            };
            
            this.updateCameraUI(true);
            
        } catch (error) {
            console.error('[WELCOME_CAMERA] Lỗi khởi động camera:', error);
        }
    }
    
    setupOverlay() {
        if (!this.overlay) return;
        
        this.overlay.width = this.video.videoWidth;
        this.overlay.height = this.video.videoHeight;
    }
    
    async initMediaPipe() {
        try {
            // Chỉ khởi tạo FaceMesh nếu chưa có (same as index.html)
            if (!this.mesh) {
                
                // Khởi tạo FaceMesh với locateFile đúng cách (same as index.html)
                this.mesh = new this.mpFaceMesh.FaceMesh({
                    locateFile: (file) => {
                        const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/';
                        return `${baseUrl}${file}`;
                    }
                });
                
                this.mesh.setOptions({
                    maxNumFaces: 5,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.6 
                });
                
                this.mesh.onResults((results) => {
                    this.onResults(results);
                });
                this.isInitialized = true;
            }
            
            // Bắt đầu detection loop
            this.startFaceDetectionLoop();
            this.detecting = true;
            
            // Start auto scan (like index.html)
            this.startAutoScan();
            
            
        } catch (error) {
            console.error('[WELCOME_CAMERA] Lỗi khởi tạo MediaPipe:', error);
        }
    }
    
    startFaceDetectionLoop() {
        // Dừng animation loop cũ nếu có (same as index.html)
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        const detectFaces = async () => {
            // Kiểm tra điều kiện dừng (same as index.html)
            if (!this.detecting || !this.video || this.video.readyState < 2 || !this.mesh) {
                this.animationId = requestAnimationFrame(detectFaces);
                return;
            }
            
            try {
                // Gửi ảnh trực tiếp từ video element (same as index.html)
                await this.mesh.send({ image: this.video });
            } catch (error) {
                console.warn('[WELCOME_CAMERA] Lỗi phát hiện khuôn mặt:', error);
            }
            
            // Tiếp tục vòng lặp (same as index.html)
            this.animationId = requestAnimationFrame(detectFaces);
        };
        
        detectFaces();
    }
    
    onResults(results) {
        if (!this.overlay || !this.detecting) return;
        
        const ctx = this.overlay.getContext('2d');
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        
        // Draw video frame first (same as index.html)
        ctx.drawImage(results.image, 0, 0, this.overlay.width, this.overlay.height);
        
        // Kiểm tra có khuôn mặt nào không (same as index.html)
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return;
        }
        
        // Màu sắc khác nhau cho từng khuôn mặt (same as index.html)
        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
        
        // Vẽ tất cả các khuôn mặt được phát hiện (same as index.html)
        results.multiFaceLandmarks.forEach((landmarks, index) => {
            const color = colors[index % colors.length];
            
            // Vẽ oval nhẹ cho từng khuôn mặt (same as index.html)
            this.drawingUtils.drawConnectors(ctx, landmarks, this.mpFaceMesh.FACEMESH_FACE_OVAL, { 
                lineWidth: 1.0,
                color: `rgba(255, 255, 255, 0.6)`
            });
            
            // Tính toán vị trí khuôn mặt (same as index.html)
            const faceBox = this.getFaceBox(landmarks);
            if (faceBox) {
                // Vẽ khung khuôn mặt với màu riêng (same as index.html)
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(faceBox.x, faceBox.y, faceBox.width, faceBox.height);
                
                // Vẽ label cho khuôn mặt (same as index.html)
                ctx.fillStyle = color;
                ctx.font = 'bold 14px Arial';
                ctx.fillText(`Khuôn mặt ${index + 1}`, faceBox.x, faceBox.y - 10);
            }
        });
    }
    
    // Tính toán bounding box từ landmarks (same as index.html)
    getFaceBox(landmarks) {
        if (!landmarks || landmarks.length < 468) return null;
        
        try {
            let minX = 1, maxX = 0, minY = 1, maxY = 0;
            
            // Sử dụng các điểm quan trọng (same as index.html)
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
            console.error('[WELCOME_CAMERA] Error calculating face box:', error);
            return null;
        }
    }
    
    startAutoScan() {
        // Auto scan every 1 second for better responsiveness
        this.detectionInterval = setInterval(() => {
            if (this.detecting && this.video && this.video.readyState >= 2) {
                this.triggerCheckin();
            }
        }, 1000); // Every 1 second (reduced from 3s for better responsiveness)
    }
    
    // Method to trigger check-in API call (optimized for better performance)
    async triggerCheckin() {
        try {
            const now = Date.now();
            
            // Add to queue instead of blocking
            const checkinTask = {
                timestamp: now,
                id: Math.random().toString(36).substr(2, 9)
            };
            
            this.processingQueue.push(checkinTask);
            
            // Process queue if not already processing
            if (!this.isProcessing) {
                this.processQueue();
            }
            
        } catch (error) {
            console.error('[WELCOME_CAMERA] Error during check-in:', error);
        }
    }
    
    // Process the check-in queue
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            while (this.processingQueue.length > 0) {
                const task = this.processingQueue.shift();
                const now = Date.now();
                
                // Check cooldown for this specific task
                if (now - this.lastCheckinTime < this.checkinCooldown) {
                    // Put task back to front of queue and wait
                    this.processingQueue.unshift(task);
                    await new Promise(resolve => setTimeout(resolve, this.checkinCooldown));
                    continue;
                }
                
                this.lastCheckinTime = now;
                
                // Capture current frame from video
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.video.videoWidth;
                canvas.height = this.video.videoHeight;
                ctx.drawImage(this.video, 0, 0);
                
                // Convert to base64
                const base64Image = canvas.toDataURL('image/jpeg', 0.8);
                
                // Step 1: Check if face exists in image
                const hasFace = await this.detectFaceInImage(base64Image);
                if (!hasFace) {
                    continue;
                }
                
                // Step 2: Call /api/recognize/multi to recognize faces
                const response = await fetch('/api/recognize/multi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        images: [base64Image]
                    })
                });
                
                if (!response.ok) {
                    continue;
                }
                
                const result = await response.json();
                
                if (result.recognized && result.faces && result.faces.length > 0) {
                    // Step 3: Process each recognized face in parallel
                    const checkinPromises = result.faces.map(face => this.autoCheckin(face));
                    const checkinResults = await Promise.allSettled(checkinPromises);
                    
                    const newFaces = [];
                    checkinResults.forEach((checkinResult, index) => {
                        if (checkinResult.status === 'fulfilled' && checkinResult.value) {
                            newFaces.push(result.faces[index]);
                            // Call the callback if set
                            if (this.onCheckin && typeof this.onCheckin === 'function') {
                                this.onCheckin(checkinResult.value);
                            }
                        }
                    });
                    
                    // Only show notification if there are new check-ins
                    if (newFaces.length > 0) {
                        console.log(`[WELCOME_CAMERA] Processed ${newFaces.length} new check-ins`);
                    }
                }
            }
        } catch (error) {
            console.error('[WELCOME_CAMERA] Error processing queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }
    
    // Check if face exists in image (same as index.html)
    async detectFaceInImage(imageData) {
        try {
            const response = await fetch('/api/detect-face', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData
                })
            });
            
            const result = await response.json();
            return result.has_face;
        } catch (error) {
            console.error('[WELCOME_CAMERA] Error detecting face:', error);
            // If error, still allow recognition to avoid complete blocking
            return true;
        }
    }
    
    // Auto check-in logic (same as index.html)
    async autoCheckin(face) {
        try {
            const userId = face.user_id;
            const confidence = face.confidence;
            
            // Check if user is already checked in
            const checkinStatusResponse = await fetch(`/api/checkin-status/${userId}`);
            if (checkinStatusResponse.ok) {
                const statusData = await checkinStatusResponse.json();
                if (statusData.checked_in) {
                    return null;
                }
            }
            
            // Perform check-in
            const checkinResponse = await fetch(`/api/checkin/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    confidence: confidence
                })
            });
            
            if (!checkinResponse.ok) {
                return null;
            }
            
            const checkinData = await checkinResponse.json();
            
            // Get user data
            const userResponse = await fetch(`/api/users/${userId}`);
            if (!userResponse.ok) {
                return null;
            }
            
            const userData = await userResponse.json();
            
            // Return check-in result with all necessary data
            const checkinResult = {
                user_id: userId,
                name: userData.name,
                gender: userData.gender,
                position: userData.position,
                company: userData.company,
                department: userData.department,
                phone: userData.phone,
                seat_number: userData.seat_number,
                confidence: confidence,
                checkin_time: checkinData.checkin_time,
                images: userData.images || [],
                image: userData.images?.[0] || ''
            };
            
            return checkinResult;
            
        } catch (error) {
            console.error(`[WELCOME_CAMERA] Error in auto check-in for user ${face.user_id}:`, error);
            return null;
        }
    }
    
    stopCamera() {
        if (!this.detecting) return;
        
        // Stop auto scan
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        
        // Stop animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Clear processing queue
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Dừng detection nhưng KHÔNG đóng FaceMesh (same as index.html)
        this.detecting = false;
        
        // Xóa video source
        this.video.srcObject = null;
        
        // Cập nhật UI
        this.updateCameraUI(false);
    }
    
    toggleCamera() {
        if (this.detecting) {
            this.stopCamera();
        } else {
            this.startCamera();
        }
    }
    
    // Update camera UI based on state
    updateCameraUI(isActive) {
        const cameraToggle = document.getElementById('cameraToggle');
        const cameraVideo = document.getElementById('cameraVideo');
        const cameraPlaceholder = document.getElementById('cameraPlaceholder');
        
        if (isActive) {
            // Camera is active
            cameraToggle.innerHTML = '<span class="camera-icon">⏹️</span>';
            cameraToggle.title = 'Tắt Camera';
            cameraVideo.style.display = 'block';
            cameraPlaceholder.style.display = 'none';
        } else {
            // Camera is inactive
            cameraToggle.innerHTML = '<span class="camera-icon">📹</span>';
            cameraToggle.title = 'Bật Camera';
            cameraVideo.style.display = 'none';
            cameraPlaceholder.style.display = 'flex';
        }
    }
    
    // Method to be called by welcome.js to set the callback
    setOnCheckin(callback) {
        this.onCheckin = callback;
    }
    
    // Method để cleanup hoàn toàn FaceMesh (chỉ dùng khi cần thiết) (same as index.html)
    async cleanupMediaPipe() {
        // Dừng detection trước
        this.detecting = false;
        
        // Dừng animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Đóng FaceMesh (same as index.html)
        if (this.mesh) {
            try {
                await this.mesh.close();
                this.mesh = null;
                this.isInitialized = false;
            } catch (error) {
                console.warn('[WELCOME_CAMERA] Lỗi khi cleanup FaceMesh:', error);
            }
        }
    }
}

// Export for use in welcome.js
window.WelcomeCameraManager = WelcomeCameraManager;