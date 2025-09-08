class FaceRecognitionApp {
    constructor() {
        this.scanButton = document.getElementById('scanFace');
        this.resultContainer = document.getElementById('recognitionResult');
        this.resultContent = document.getElementById('resultContent');
        this.usersList = document.getElementById('usersList');
        this.captureButton = document.getElementById('captureIdentify');
        this.clearButton = document.getElementById('clearIdentify');
        this.capturedImages = [];
        this.checkinBtn = document.getElementById('checkinBtn');
        this.recognizedUserId = null;
        this.recognizedName = '';
        
        // Thêm các thuộc tính cho chế độ tự động quét
        this.autoScanEnabled = false;
        this.autoScanInterval = null;
        this.scanDelay = null;
        this.isScanning = false;
        this.scanCooldown = 0; // Không delay, quét liên tục
        
        // Thống kê hiệu suất
        this.scanStats = {
            totalScans: 0,
            successfulScans: 0,
            faceDetectedScans: 0,
            noFaceScans: 0,
            lastScanTime: null
        };
        
        // Trạng thái âm thanh
        this.audioEnabled = false;
        this.audioEl = null;
        this.audioCtx = null;
        
        // Danh sách chào mừng
        this.welcomeMessages = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadUsers();
        this.enableAudioOnFirstInteraction();
        // Đồng bộ danh sách chào mừng từ checkins.json khi mở trang
        this.syncWelcomeFromCheckins();
    }
    
    setupEventListeners() {
        this.scanButton.addEventListener('click', () => this.scanFace());
        if (this.captureButton) {
            this.captureButton.addEventListener('click', () => this.captureOne());
        }
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearCaptured());
        }
        if (this.checkinBtn) {
            this.checkinBtn.addEventListener('click', () => this.submitCheckin());
        }
        
        // Thêm event listener cho nút tự động quét
        const autoScanButton = document.getElementById('autoScanToggle');
        if (autoScanButton) {
            autoScanButton.addEventListener('click', () => this.toggleAutoScan());
        }
    }
    
    async loadUsers() {
        try {
            const response = await fetch('/api/users');
            const users = await response.json();
            this.displayUsers(users);
        } catch (error) {
            console.error('Lỗi tải danh sách người dùng:', error);
            this.usersList.innerHTML = '<p>Lỗi tải danh sách người dùng</p>';
        }
    }
    
    displayUsers(users) {
        if (users.length === 0) {
            this.usersList.innerHTML = '<p>Chưa có người dùng nào được thêm</p>';
            return;
        }
        
        this.usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <h4>${user.name}</h4>
                    <p>Đăng ký: ${new Date(user.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
            </div>
        `).join('');
    }
    
    async scanFace() {
        if ((!window.cameraManager || !window.cameraManager.stream) && (!this.capturedImages || this.capturedImages.length === 0)) {
            this.showError('Vui lòng bật camera hoặc chụp ít nhất 1 ảnh');
            return;
        }
        
        if (this.isScanning) {
            return; // Tránh quét đồng thời
        }
        
        this.isScanning = true;
        this.scanButton.disabled = true;
        this.scanButton.textContent = 'Đang quét...';
        
        // Reset thông tin khách mời trước khi quét mới
        this.resetGuestInfo();
        
        try {
            // Chụp ảnh từ camera
            const images = [];
            if (this.capturedImages && this.capturedImages.length > 0) images.push(...this.capturedImages);
            if (images.length === 0 && window.cameraManager && window.cameraManager.stream) {
                const one = window.cameraManager.captureImage();
                images.push(one);
                this.capturedImages.push(one);
                this.renderCapturedPreview();
            }

            // Cập nhật thống kê
            this.scanStats.totalScans++;
            this.scanStats.lastScanTime = new Date();
            
            // Kiểm tra có khuôn mặt trong ảnh trước khi nhận dạng
            const hasFace = await this.detectFaceInImage(images[0]);
            if (!hasFace) {
                // Không có khuôn mặt, bỏ qua lần quét này
                this.scanStats.noFaceScans++;
                console.log('Không phát hiện khuôn mặt, bỏ qua lần quét');
                
                // Xóa ảnh khi không phát hiện khuôn mặt
                this.clearCaptured();
                this.updateScanStats();
                return;
            }
            
            this.scanStats.faceDetectedScans++;

            const response = await fetch('/api/recognize/multi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    images: images
                })
            });
            
            const result = await response.json();
            
            // Xử lý cả trường hợp thành công và lỗi
            if (result.recognized) {
                this.scanStats.successfulScans++;
                this.showRecognitionResult(result);
                
                // Xử lý nhiều khuôn mặt được nhận diện
                if (result.faces && result.faces.length > 0) {
                    const newFaces = []; // Chỉ hiển thị khách chưa check-in
                    for (const face of result.faces) {
                        const isNewCheckin = await this.autoCheckin(face);
                        if (isNewCheckin) {
                            newFaces.push(face);
                        }
                    }
                    
                    // Chỉ hiển thị thông báo nếu có khách mới check-in
                    if (newFaces.length > 0) {
                        result.faces = newFaces;
                        result.count = newFaces.length;
                    } else {
                        // Không hiển thị thông báo nếu tất cả đã check-in
                        return;
                    }
                } else {
                    // Fallback cho format cũ (1 khuôn mặt)
                    this.recognizedUserId = result.user_id || null;
                    this.recognizedName = result.name || '';
                    if (this.recognizedUserId) {
                        const isNewCheckin = await this.autoCheckin(result);
                        if (!isNewCheckin) {
                            // Không hiển thị thông báo nếu đã check-in
                            return;
                        }
                    }
                }
                
                // Không cần delay, tiếp tục quét liên tục
            } else {
                this.showRecognitionResult(result);
                // Thêm debug để kiểm tra
                console.log('Không nhận diện được, message:', result.message);
                // Không phát âm thanh khi không nhận diện được
                this.recognizedUserId = null;
                if (this.checkinBtn) this.checkinBtn.disabled = true;
            }
            
            // Cập nhật thống kê và tối ưu hóa tần suất
            this.updateScanStats();
            this.optimizeScanFrequency();
            
        } catch (error) {
            console.error('Lỗi quét khuôn mặt:', error);
            this.showError('Lỗi khi quét khuôn mặt');
        } finally {
            // Đảm bảo ảnh luôn được xóa sau mỗi lần quét
            this.clearCaptured();
            
            this.isScanning = false;
            this.scanButton.disabled = false;
            this.scanButton.textContent = 'Quét khuôn mặt';
        }
    }

    async autoCheckin(faceData) {
        try {
            const userId = faceData.user_id;
            const displayName = faceData.name || '';
            let gender = faceData.gender || '';
            const images = faceData.images || [];
            // Thông tin hồ sơ để ghi vào checkin
            let phone = '';
            let company = '';
            let department = '';
            let position = '';
            
            // Kiểm tra trạng thái check-in trước
            const statusRes = await fetch(`/api/checkin-status/${userId}`);
            const statusData = await statusRes.json();
            
            if (statusData.checked_in) {
                console.log(`${displayName} đã check-in rồi, bỏ qua thông báo`);
                return false; // Trả về false để báo đã check-in rồi
            }
            
            // Lấy thông tin đầy đủ từ API users trước khi ghi check-in
            try {
                const userRes = await fetch(`/api/users/${userId}`);
                if (userRes.ok) {
                    const userData = await userRes.json();
                    phone = userData.phone || '';
                    gender = userData.gender || gender || '';
                    company = userData.company || '';
                    department = userData.department || '';
                    position = userData.position || '';
                }
            } catch (_) { /* ignore, fallback to defaults */ }

            // Tự động check-in
            const res = await fetch(`/api/checkin/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: displayName, 
                    phone: phone, 
                    gender: gender, 
                    company: company, 
                    department: department, 
                    position: position 
                })
            });
            
            if (res.ok) {
                // Lấy thông tin đầy đủ từ API users
                try {
                    const userRes = await fetch(`/api/users/${userId}`);
                    const userData = await userRes.json();
                    
                    // Thêm vào danh sách chào mừng với thông tin đầy đủ
                    this.addWelcomeMessage(
                        displayName, 
                        gender, 
                        images[0] || '', 
                        userData.company || company || '', 
                        userData.position || position || ''
                    );
                } catch (e) {
                    // Fallback nếu không lấy được thông tin đầy đủ
                    this.addWelcomeMessage(displayName, gender, images[0] || '');
                }
                
                console.log('Auto check-in thành công cho:', displayName);
                return true; // Trả về true để báo check-in thành công
            } else {
                console.error('Auto check-in thất bại cho:', displayName);
                return false;
            }
        } catch (e) {
            console.error('Lỗi auto check-in:', e);
            return false;
        }
    }

    async submitCheckin() {
        if (!this.recognizedUserId) {
            this.showError('Chưa nhận diện được khách mời');
            return;
        }
        // Dữ liệu check-in lấy từ profile hiển thị (không nhập lại)
        const phone = document.getElementById('infoPhone')?.textContent || '';
        const gender = document.getElementById('infoGender')?.textContent || '';
        const company = document.getElementById('infoCompany')?.textContent || '';
        const department = document.getElementById('infoDepartment')?.textContent || '';
        const position = document.getElementById('infoPosition')?.textContent || '';

        try {
            // Ghi check-in
            const name = (this.recognizedName || document.getElementById('infoName')?.textContent || '').trim();
            const res = await fetch(`/api/checkin/${this.recognizedUserId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, gender, company, department, position })
            });
            if (res.ok) {
                this.showRecognitionResult({ recognized: true, name, message: 'Check-in thành công!' });
                this.checkinBtn.disabled = true;
            } else {
                this.showError('Ghi check-in thất bại');
            }
        } catch (e) {
            console.error(e);
            this.showError('Lỗi kết nối khi check-in');
        }
    }

    captureOne() {
        if (!window.cameraManager || !window.cameraManager.stream) {
            this.showError('Vui lòng bật camera trước khi chụp');
            return;
        }
        if (this.capturedImages.length >= 5) {
            this.showError('Bạn đã chụp tối đa 5 ảnh');
            return;
        }
        const img = window.cameraManager.captureImage();
        this.capturedImages.push(img);
        this.renderCapturedPreview();
    }

    clearCaptured() {
        this.capturedImages = [];
        const prev = document.querySelector('.captured-identify-preview');
        if (prev) prev.remove();
    }

    async handleUpload(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;
        const limited = files.slice(0, 5);
        const promises = limited.map(file => this.readFileAsDataUrl(file));
        const results = await Promise.all(promises);
        this.uploadedImages = results.filter(Boolean);
        this.renderUploadPreview();
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
        const container = document.getElementById('recognitionResult');
        if (!container) return;
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

        container.parentNode.insertBefore(wrap, container);
    }

    renderCapturedPreview() {
        // Ẩn phần hiển thị hình ảnh chụp - không cần hiển thị nữa
        return;
        
        const container = document.getElementById('recognitionResult');
        if (!container) return;
        const old = document.querySelector('.captured-identify-preview');
        if (old) old.remove();

        if (!this.capturedImages || this.capturedImages.length === 0) return;

        const wrap = document.createElement('div');
        wrap.className = 'captured-identify-preview';
        wrap.style.cssText = 'margin: 10px 0; display:flex; gap:8px; flex-wrap:wrap;';

        this.capturedImages.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #27ae60;';
            wrap.appendChild(img);
        });

        container.parentNode.insertBefore(wrap, container);
    }
    
    showRecognitionResult(result) {
        if (result.recognized) {
            if (result.faces && result.faces.length > 0) {
                // Hiển thị nhiều khuôn mặt
                const facesHtml = result.faces.map(face => `
                    <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <div style="font-weight: bold; color: #27ae60;">✅ ${face.name}</div>
                        <div style="font-style: italic; color: #7f8c8d; font-size: 12px;">
                            "${face.message}"
                        </div>
                    </div>
                `).join('');
                
                this.resultContent.innerHTML = `
                    <div style="color: #27ae60; font-weight: bold; margin-bottom: 10px;">
                        ✅ Nhận dạng thành công ${result.count} khuôn mặt!
                    </div>
                    ${facesHtml}
                `;
            } else {
                // Fallback cho format cũ
                this.resultContent.innerHTML = `
                    <div style="color: #27ae60; font-weight: bold; margin-bottom: 10px;">
                        ✅ Nhận dạng thành công!
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Tên:</strong> ${result.name}
                    </div>
                    <div style="font-style: italic; color: #7f8c8d;">
                        "${result.message}"
                    </div>
                `;
            }
        } else {
            this.resultContent.innerHTML = `
                <div style="color: #e74c3c; font-weight: bold; margin-bottom: 10px;">
                    ❌ Không nhận dạng được khuôn mặt
                </div>
                <div style="font-style: italic; color: #7f8c8d;">
                    "${result.message}"
                </div>
            `;
        }
        
        this.resultContainer.style.display = 'block';
        
        // Ẩn kết quả sau 5 giây (ngắn hơn vì có nhiều thông báo)
        setTimeout(() => {
            this.resultContainer.style.display = 'none';
        }, 5000);
    }
    
    async playWelcomeMessage(message) {
        console.log('Bắt đầu phát âm thanh:', message, 'Audio enabled:', this.audioEnabled);
        
        // Kiểm tra xem âm thanh đã được kích hoạt chưa
        if (!this.audioEnabled) {
            console.log('Âm thanh chưa được kích hoạt, thử kích hoạt tự động...');
            // Thử kích hoạt âm thanh tự động
            this.audioEnabled = true;
        }
        
        try {
            // Sử dụng gTTS thông qua API
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: message
                })
            });
            
            console.log('TTS response status:', response.status);
            
            if (response.ok) {
                // Tạo blob từ audio và phát qua thẻ audio tái sử dụng (Safari-friendly)
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log('Audio blob created, size:', audioBlob.size);
                
                if (!this.audioEl) {
                    this.audioEl = document.createElement('audio');
                    this.audioEl.setAttribute('playsinline', '');
                    this.audioEl.setAttribute('preload', 'auto');
                    this.audioEl.style.display = 'none';
                    document.body.appendChild(this.audioEl);
                }
                
                this.audioEl.src = audioUrl;
                this.audioEl.onended = () => {
                    console.log('Audio finished playing');
                    URL.revokeObjectURL(audioUrl);
                };
                this.audioEl.onerror = (e) => console.error('Audio error:', e);
                
                // Thử phát audio với xử lý autoplay/Safari
                try {
                    if (this.audioCtx && this.audioCtx.state === 'suspended') {
                        await this.audioCtx.resume().catch(() => {});
                    }
                    const playResult = await this.audioEl.play();
                    console.log('Audio play result:', playResult);
                } catch (playError) {
                    console.log('Autoplay bị chặn, thử fallback:', playError);
                    // Fallback về Web Speech API
                    this.playWithWebSpeech(message);
                }
                
            } else {
                console.log('TTS API failed, falling back to Web Speech API');
                // Fallback về Web Speech API
                this.playWithWebSpeech(message);
            }
        } catch (error) {
            console.error('Lỗi TTS:', error);
            // Fallback về Web Speech API
            this.playWithWebSpeech(message);
        }
    }
    
    playWithWebSpeech(message) {
        console.log('Sử dụng Web Speech API cho:', message);
        
        // Fallback sử dụng Web Speech API
        if ('speechSynthesis' in window) {
            // Dừng bất kỳ speech nào đang phát
            speechSynthesis.cancel();
            
            // Đợi một chút để đảm bảo cancel hoàn tất
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'vi-VN';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 1;
                
                // Thêm event listeners để debug
                utterance.onstart = () => console.log('Web Speech started');
                utterance.onend = () => console.log('Web Speech ended');
                utterance.onerror = (e) => console.error('Web Speech error:', e);
                
                // Thử phát ngay lập tức
                try {
                    speechSynthesis.speak(utterance);
                    console.log('Web Speech utterance created and started');
                } catch (error) {
                    console.error('Lỗi khi phát Web Speech:', error);
                }
            }, 100);
        } else {
            console.log('Trình duyệt không hỗ trợ Text-to-Speech');
        }
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
    
    // Phương thức bật/tắt chế độ tự động quét
    toggleAutoScan() {
        if (this.autoScanEnabled) {
            this.stopAutoScan();
        } else {
            this.startAutoScan();
        }
    }
    
    // Bắt đầu chế độ tự động quét
    startAutoScan() {
        if (!window.cameraManager || !window.cameraManager.stream) {
            this.showError('Vui lòng bật camera trước khi sử dụng chế độ tự động quét');
            return;
        }
        
        this.autoScanEnabled = true;
        this.updateAutoScanUI();
        
        // Kích hoạt âm thanh khi bắt đầu tự động quét
        this.audioEnabled = true;
        console.log('Âm thanh đã được kích hoạt cho chế độ tự động quét');
        
        // Bắt đầu quét tự động mỗi 3 giây
        this.autoScanInterval = setInterval(() => {
            if (!this.isScanning && !this.scanDelay) {
                this.scanFace();
            }
        }, 3000);
        
        console.log('Chế độ tự động quét đã được bật');
    }
    
    // Dừng chế độ tự động quét
    stopAutoScan() {
        this.autoScanEnabled = false;
        this.updateAutoScanUI();
        
        if (this.autoScanInterval) {
            clearInterval(this.autoScanInterval);
            this.autoScanInterval = null;
        }
        
        if (this.scanDelay) {
            clearTimeout(this.scanDelay);
            this.scanDelay = null;
        }
        
        console.log('Chế độ tự động quét đã được tắt');
    }
    
    // Bắt đầu thời gian chờ sau khi nhận dạng thành công
    startScanCooldown() {
        if (this.scanDelay) {
            clearTimeout(this.scanDelay);
        }
        
        this.scanDelay = setTimeout(() => {
            this.scanDelay = null;
            console.log('Hết thời gian chờ, tiếp tục quét tự động');
        }, this.scanCooldown);
        
        this.updateCooldownDisplay();
    }
    
    // Cập nhật UI cho chế độ tự động quét
    updateAutoScanUI() {
        const autoScanButton = document.getElementById('autoScanToggle');
        const statusDiv = document.getElementById('autoScanStatus');
        
        if (autoScanButton) {
            autoScanButton.textContent = this.autoScanEnabled ? 'Tắt tự động quét' : 'Bật tự động quét';
            autoScanButton.className = this.autoScanEnabled ? 'btn btn-warning' : 'btn btn-success';
        }
        
        if (statusDiv) {
            if (this.autoScanEnabled) {
                statusDiv.textContent = '🟢 Đang quét tự động';
                statusDiv.style.color = '#27ae60';
            } else {
                statusDiv.textContent = '🔴 Tắt tự động quét';
                statusDiv.style.color = '#e74c3c';
            }
        }
    }
    
    // Cập nhật hiển thị thời gian chờ
    updateCooldownDisplay() {
        const cooldownDiv = document.getElementById('cooldownStatus');
        if (!cooldownDiv) return;
        
        let remainingTime = this.scanCooldown / 1000;
        
        const updateTimer = () => {
            if (remainingTime > 0) {
                cooldownDiv.textContent = `⏳ Tạm dừng quét: ${remainingTime}s`;
                cooldownDiv.style.color = '#f39c12';
                remainingTime--;
                setTimeout(updateTimer, 1000);
            } else {
                cooldownDiv.textContent = '';
            }
        };
        
        updateTimer();
    }
    
    // Kiểm tra có khuôn mặt trong ảnh hay không
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
            console.error('Lỗi kiểm tra khuôn mặt:', error);
            // Nếu có lỗi, vẫn cho phép nhận dạng để tránh bị chặn hoàn toàn
            return true;
        }
    }
    
    // Cập nhật hiển thị thống kê
    updateScanStats() {
        const statsDiv = document.getElementById('scanStats');
        if (!statsDiv) return;
        
        const successRate = this.scanStats.totalScans > 0 
            ? ((this.scanStats.successfulScans / this.scanStats.totalScans) * 100).toFixed(1)
            : 0;
        
        const faceDetectionRate = this.scanStats.totalScans > 0
            ? ((this.scanStats.faceDetectedScans / this.scanStats.totalScans) * 100).toFixed(1)
            : 0;
        
        const lastScanTime = this.scanStats.lastScanTime 
            ? this.scanStats.lastScanTime.toLocaleTimeString('vi-VN')
            : 'Chưa có';
        
        statsDiv.innerHTML = `
            <div style="font-size: 12px; color: #666; margin-top: 10px;">
                <div>📊 Tổng quét: ${this.scanStats.totalScans} | Thành công: ${this.scanStats.successfulScans} (${successRate}%)</div>
                <div>👤 Phát hiện khuôn mặt: ${this.scanStats.faceDetectedScans} (${faceDetectionRate}%) | Không có mặt: ${this.scanStats.noFaceScans}</div>
                <div>🕐 Lần quét cuối: ${lastScanTime}</div>
            </div>
        `;
    }
    
    // Tối ưu hóa: Giảm tần suất quét khi không có người
    optimizeScanFrequency() {
        if (!this.autoScanEnabled) return;
        
        // Nếu liên tiếp nhiều lần không phát hiện khuôn mặt, tăng khoảng cách quét
        if (this.scanStats.noFaceScans > 5) {
            // Tăng interval lên 5 giây thay vì 3 giây
            if (this.autoScanInterval) {
                clearInterval(this.autoScanInterval);
                this.autoScanInterval = setInterval(() => {
                    if (!this.isScanning && !this.scanDelay) {
                        this.scanFace();
                    }
                }, 5000);
            }
        } else {
            // Quay lại interval bình thường 3 giây
            if (this.autoScanInterval) {
                clearInterval(this.autoScanInterval);
                this.autoScanInterval = setInterval(() => {
                    if (!this.isScanning && !this.scanDelay) {
                        this.scanFace();
                    }
                }, 3000);
            }
        }
    }
    
    // Kích hoạt âm thanh khi người dùng tương tác lần đầu
    enableAudioOnFirstInteraction() {
        const enableAudio = () => {
            try {
                // Tạo thẻ audio ẩn để tái sử dụng (tương thích Safari)
                if (!this.audioEl) {
                    this.audioEl = document.createElement('audio');
                    this.audioEl.setAttribute('playsinline', '');
                    this.audioEl.setAttribute('preload', 'auto');
                    this.audioEl.style.display = 'none';
                    document.body.appendChild(this.audioEl);
                }
                // Unlock AudioContext nếu có (Safari iOS)
                if (!this.audioCtx && window.AudioContext) {
                    this.audioCtx = new window.AudioContext();
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }
                this.audioEnabled = true;
                console.log('Âm thanh đã được kích hoạt (unlocked)');
            } catch (e) {
                console.warn('Không thể kích hoạt audio:', e);
            }
            
            // Loại bỏ event listeners sau khi kích hoạt
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
        };
        
        // Thêm event listeners cho các tương tác đầu tiên
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('keydown', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });
        
        // Tự động kích hoạt âm thanh khi bật camera (tương tác đầu tiên)
        const originalStartCamera = window.cameraManager?.startCamera;
        if (originalStartCamera) {
            window.cameraManager.startCamera = async function(...args) {
                const result = await originalStartCamera.apply(this, args);
                // Kích hoạt âm thanh khi camera được bật
                if (window.faceRecognitionApp) {
                    try {
                        const app = window.faceRecognitionApp;
                        if (!app.audioEl) {
                            app.audioEl = document.createElement('audio');
                            app.audioEl.setAttribute('playsinline', '');
                            app.audioEl.setAttribute('preload', 'auto');
                            app.audioEl.style.display = 'none';
                            document.body.appendChild(app.audioEl);
                        }
                        if (!app.audioCtx && window.AudioContext) {
                            app.audioCtx = new window.AudioContext();
                        }
                        if (app.audioCtx && app.audioCtx.state === 'suspended') {
                            await app.audioCtx.resume().catch(() => {});
                        }
                        app.audioEnabled = true;
                        console.log('Âm thanh đã được kích hoạt khi bật camera');
                    } catch (e) { console.warn(e); }
                }
                return result;
            };
        }
    }
    
    // Reset thông tin khách mời
    resetGuestInfo() {
        // Reset các biến
        this.recognizedUserId = null;
        this.recognizedName = '';
        
        // Ẩn thẻ khách mời
        const card = document.getElementById('guestCard');
        if (card) {
            card.style.display = 'none';
        }
        
        // Reset các trường thông tin
        const fields = ['infoName', 'infoPhone', 'infoGender', 'infoCompany', 'infoDepartment', 'infoPosition'];
        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.textContent = '-';
            }
        });
        
        // Vô hiệu hóa nút check-in
        if (this.checkinBtn) {
            this.checkinBtn.disabled = true;
        }
        
        console.log('Đã reset thông tin khách mời');
    }
    
    // Chuẩn hóa URL ảnh giống màn /manage
    resolveImageUrl(path) {
        if (!path || typeof path !== 'string') return '';
        const src = path.startsWith('data/images') ? `/media/${path}` : `/${path}`;
        return src.replace('//', '/');
    }

    // Thêm thông báo chào mừng vào danh sách
    addWelcomeMessage(name, gender, imageUrl, company = '', position = '') {
        const title = this.getTitle(gender);
        const message = `Chúng tôi rất vui mừng được chào đón ${title.toLowerCase()} tham gia sự kiện! Hãy tận hưởng những phiên thảo luận bổ ích và cơ hội kết nối tuyệt vời.`;
        const timestamp = new Date();
        
        const welcomeItem = {
            id: Date.now(),
            name,
            gender,
            title,
            message,
            imageUrl: this.resolveImageUrl(imageUrl),
            timestamp,
            company,
            position
        };
        
        // Thêm vào đầu danh sách (mới nhất lên đầu)
        this.welcomeMessages.unshift(welcomeItem);
        
        // Giới hạn tối đa 10 thông báo để tránh quá tải
        if (this.welcomeMessages.length > 10) {
            this.welcomeMessages = this.welcomeMessages.slice(0, 10);
        }
        
        this.renderWelcomeMessagesWithAnimation();
    }
    
    // Lấy title dựa trên giới tính
    getTitle(gender) {
        const g = (gender || '').trim().toLowerCase();
        if (g === 'nam') return 'Ông';
        if (g === 'nữ' || g === 'nu') return 'Bà';
        return 'Quý khách';
    }
    
    // Đồng bộ danh sách đã check-in từ API khi vào trang chủ
    async syncWelcomeFromCheckins() {
        try {
            const res = await fetch('/api/checkins');
            const data = await res.json();
            if (!Array.isArray(data)) return;
            // Sắp xếp mới nhất lên đầu
            const sorted = data
                .filter(c => c && c.name)
                .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
            // Lấy ảnh đầu tiên của từng user (nếu có)
            const top = sorted.slice(0, 10);
            const cache = {};
            const withImages = await Promise.all(top.map(async c => {
                let firstImage = '';
                try {
                    if (typeof c.user_id === 'number') {
                        if (!cache[c.user_id]) {
                            const ures = await fetch(`/api/users/${c.user_id}`);
                            cache[c.user_id] = await ures.json();
                        }
                        const u = cache[c.user_id] || {};
                        const imgs = Array.isArray(u.images) ? u.images : [];
                        firstImage = imgs.length > 0 ? imgs[0] : '';
                    }
                } catch (e) { /* noop */ }
                return {
                    id: `${c.user_id}-${c.checked_at}`,
                    name: c.name || '',
                    gender: c.gender || '',
                    title: this.getTitle(c.gender || ''),
                    message: `Chúng tôi rất vui mừng được chào đón ${this.getTitle(c.gender || '').toLowerCase()} tham gia sự kiện! Hãy tận hưởng những phiên thảo luận bổ ích và cơ hội kết nối tuyệt vời.`,
                    imageUrl: this.resolveImageUrl(firstImage),
                    timestamp: new Date(c.checked_at),
                    company: c.company || '',
                    position: c.position || ''
                };
            }));
            this.welcomeMessages = withImages;
            this.renderWelcomeMessagesWithAnimation();
        } catch (e) {
            console.warn('Không thể đồng bộ check-ins:', e);
        }
    }
    
    // Render danh sách chào mừng với hiệu ứng trượt
    renderWelcomeMessagesWithAnimation() {
        const container = document.getElementById('welcomeMessages');
        if (!container) return;
        
        if (this.welcomeMessages.length === 0) {
            container.innerHTML = '<div class="no-messages">Chưa có khách mời nào check-in</div>';
            return;
        }
        
        // Lưu trạng thái hiện tại để so sánh
        const currentCards = container.querySelectorAll('.welcome-card');
        const currentIds = Array.from(currentCards).map(card => card.dataset.id);
        
        // Render HTML mới
        container.innerHTML = this.welcomeMessages.map((item, index) => `
            <div class="welcome-card ${index === 0 ? 'new-card' : ''}" data-id="${item.id}">
                <div class="welcome-card-header">
                    <div class="welcome-profile-image">
                        ${item.imageUrl ? 
                            `<img src="${item.imageUrl}" alt="${item.name}" onerror="this.style.display='none'">` : 
                            '<div class="no-image">👤</div>'
                        }
                    </div>
                    <div class="welcome-guest-info">
                        <div class="welcome-guest-name">Chào mừng ${item.title} ${item.name}</div>
                        <div class="welcome-guest-title">${item.position || 'Khách mời'}</div>
                        <div class="welcome-guest-company">${item.company || 'Tham gia sự kiện'}</div>
                    </div>
                </div>
                <div class="welcome-message-box">
                    <div class="welcome-message-text">${item.message}</div>
                </div>
                <div class="welcome-card-footer">
                    <div class="welcome-checkin-time">${item.timestamp.toLocaleString('vi-VN')}</div>
                    <div class="welcome-status-badge">Đã check-in</div>
                </div>
            </div>
        `).join('');
        
        // Thêm hiệu ứng trượt xuống cho các card cũ
        if (currentCards.length > 0) {
            currentCards.forEach(card => {
                if (!currentIds.includes(card.dataset.id)) {
                    card.classList.add('slide-down');
                }
            });
        }
        
        // Xóa class animation sau khi hoàn thành
        setTimeout(() => {
            const newCards = container.querySelectorAll('.welcome-card');
            newCards.forEach(card => {
                card.classList.remove('new-card', 'slide-down');
            });
        }, 800);
    }
    
    // Render danh sách chào mừng (phương thức cũ để tương thích)
    renderWelcomeMessages() {
        this.renderWelcomeMessagesWithAnimation();
    }
}

// Khởi tạo ứng dụng khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    window.faceRecognitionApp = new FaceRecognitionApp();
}); 