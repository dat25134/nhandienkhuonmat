class FaceRecognitionApp {
    constructor() {
        this.scanButton = document.getElementById('scanFace');
        this.resultContainer = document.getElementById('recognitionResult');
        this.resultContent = document.getElementById('resultContent');
        this.usersList = document.getElementById('usersList');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadUsers();
    }
    
    setupEventListeners() {
        this.scanButton.addEventListener('click', () => this.scanFace());
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
        if (!window.cameraManager || !window.cameraManager.stream) {
            this.showError('Vui lòng bật camera trước khi quét khuôn mặt');
            return;
        }
        
        this.scanButton.disabled = true;
        this.scanButton.textContent = 'Đang quét...';
        
        try {
            // Chụp ảnh từ camera
            const imageData = window.cameraManager.captureImage();
            
            // Gửi ảnh lên server để nhận dạng
            const response = await fetch('/api/recognize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    face_encoding: imageData
                })
            });
            
            const result = await response.json();
            
            // Xử lý cả trường hợp thành công và lỗi
            if (result.recognized) {
                this.showRecognitionResult(result);
                this.playWelcomeMessage(result.message);
            } else {
                this.showRecognitionResult(result);
                // Thêm debug để kiểm tra
                console.log('Không nhận diện được, message:', result.message);
                this.playWelcomeMessage(result.message);
            }
            
        } catch (error) {
            console.error('Lỗi quét khuôn mặt:', error);
            this.showError('Lỗi khi quét khuôn mặt');
        } finally {
            this.scanButton.disabled = false;
            this.scanButton.textContent = 'Quét khuôn mặt';
        }
    }
    
    showRecognitionResult(result) {
        if (result.recognized) {
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
        
        // Ẩn kết quả sau 8 giây (lâu hơn cho thông báo dài)
        setTimeout(() => {
            this.resultContainer.style.display = 'none';
        }, 8000);
    }
    
    async playWelcomeMessage(message) {
        console.log('Bắt đầu phát âm thanh:', message);
        
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
                // Tạo blob từ audio
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                
                console.log('Audio blob created, size:', audioBlob.size);
                
                // Phát audio
                const audio = new Audio(audioUrl);
                
                // Thêm event listeners để debug
                audio.onloadstart = () => console.log('Audio loading started');
                audio.oncanplay = () => console.log('Audio can play');
                audio.onplay = () => console.log('Audio started playing');
                audio.onended = () => {
                    console.log('Audio finished playing');
                    URL.revokeObjectURL(audioUrl);
                };
                audio.onerror = (e) => console.error('Audio error:', e);
                
                const playResult = await audio.play();
                console.log('Audio play result:', playResult);
                
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
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'vi-VN';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            
            // Thêm event listeners để debug
            utterance.onstart = () => console.log('Web Speech started');
            utterance.onend = () => console.log('Web Speech ended');
            utterance.onerror = (e) => console.error('Web Speech error:', e);
            
            speechSynthesis.speak(utterance);
            console.log('Web Speech utterance created');
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
}

// Khởi tạo ứng dụng khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    new FaceRecognitionApp();
}); 