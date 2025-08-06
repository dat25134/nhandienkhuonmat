from flask import Flask, render_template, request, jsonify, send_file
import os
import sqlite3
import base64
import numpy as np
import cv2
import face_recognition
from datetime import datetime
from PIL import Image
import io
from gtts import gTTS
import tempfile

app = Flask(__name__)

# Đảm bảo các thư mục cần thiết tồn tại
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs('models', exist_ok=True)
os.makedirs('data', exist_ok=True)

# Khởi tạo database
def init_db():
    conn = sqlite3.connect('face_recognition.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            face_encoding TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/training')
def training():
    return render_template('training.html')

@app.route('/api/users', methods=['GET'])
def get_users():
    conn = sqlite3.connect('face_recognition.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, created_at FROM users')
    users = cursor.fetchall()
    conn.close()
    
    return jsonify([{
        'id': user[0],
        'name': user[1],
        'created_at': user[2]
    } for user in users])

@app.route('/api/users', methods=['POST'])
def add_user():
    data = request.json
    name = data.get('name')
    image_data = data.get('face_encoding')
    
    if not name:
        return jsonify({'error': 'Tên không được để trống'}), 400
    
    if not image_data:
        return jsonify({'error': 'Không có dữ liệu khuôn mặt'}), 400
    
    try:
        # Decode ảnh
        image_array = decode_image(image_data)
        if image_array is None:
            return jsonify({'error': 'Không thể xử lý ảnh'}), 400
        
        # Trích xuất face encoding
        face_encoding = get_face_encoding(image_array)
        if face_encoding is None:
            return jsonify({'error': 'Không tìm thấy khuôn mặt trong ảnh'}), 400
        
        # Encode face encoding thành base64 để lưu vào database
        face_encoding_str = base64.b64encode(face_encoding.tobytes()).decode('utf-8')
        
        conn = sqlite3.connect('face_recognition.db')
        cursor = conn.cursor()
        cursor.execute('INSERT INTO users (name, face_encoding) VALUES (?, ?)', 
                       (name, face_encoding_str))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Thêm người dùng thành công'})
        
    except Exception as e:
        print(f"Lỗi thêm người dùng: {e}")
        return jsonify({'error': 'Lỗi xử lý thêm người dùng'}), 500

def decode_image(image_data):
    """Chuyển đổi base64 image thành numpy array"""
    try:
        # Loại bỏ phần header của base64
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Chuyển đổi sang RGB nếu cần
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Chuyển đổi sang numpy array
        return np.array(image)
    except Exception as e:
        print(f"Lỗi decode image: {e}")
        return None

def get_face_encoding(image_array):
    """Trích xuất face encoding từ ảnh"""
    try:
        # Tìm khuôn mặt trong ảnh
        face_locations = face_recognition.face_locations(image_array)
        
        if not face_locations:
            return None
        
        # Lấy encoding của khuôn mặt đầu tiên
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        
        if face_encodings:
            return face_encodings[0]
        
        return None
    except Exception as e:
        print(f"Lỗi trích xuất face encoding: {e}")
        return None

@app.route('/api/recognize', methods=['POST'])
def recognize_face():
    data = request.json
    image_data = data.get('face_encoding')
    
    if not image_data:
        return jsonify({
            'recognized': False,
            'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
        }), 400
    
    try:
        # Decode ảnh
        image_array = decode_image(image_data)
        if image_array is None:
            return jsonify({
                'recognized': False,
                'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
            }), 400
        
        # Trích xuất face encoding
        current_face_encoding = get_face_encoding(image_array)
        if current_face_encoding is None:
            return jsonify({
                'recognized': False,
                'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
            }), 400
        
        # So sánh với database
        conn = sqlite3.connect('face_recognition.db')
        cursor = conn.cursor()
        cursor.execute('SELECT name, face_encoding FROM users')
        users = cursor.fetchall()
        conn.close()
        
        for user in users:
            name, stored_encoding_str = user
            
            if stored_encoding_str:
                try:
                    # Decode stored encoding
                    stored_encoding = np.frombuffer(base64.b64decode(stored_encoding_str), dtype=np.float64)
                    
                    # So sánh khuôn mặt
                    matches = face_recognition.compare_faces([stored_encoding], current_face_encoding, tolerance=0.6)
                    
                    if matches[0]:
                        return jsonify({
                            'recognized': True,
                            'name': name,
                            'message': f'Chào mừng ông {name} đã đến với hệ thống của chúng tôi'
                        })
                except Exception as e:
                    print(f"Lỗi so sánh khuôn mặt: {e}")
                    continue
        
        return jsonify({
            'recognized': False,
            'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
        })
        
    except Exception as e:
        print(f"Lỗi nhận dạng khuôn mặt: {e}")
        return jsonify({
            'recognized': False,
            'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
        }), 500

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    data = request.json
    text = data.get('text', '')
    
    if not text:
        return jsonify({'error': 'Không có text để chuyển đổi'}), 400
    
    try:
        # Tạo TTS với gTTS
        tts = gTTS(text=text, lang='vi', slow=False)
        
        # Lưu file tạm thời
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        tts.save(temp_file.name)
        
        # Trả về file audio
        return send_file(temp_file.name, mimetype='audio/mpeg')
        
    except Exception as e:
        print(f"Lỗi TTS: {e}")
        return jsonify({'error': 'Lỗi chuyển đổi text thành speech'}), 500

if __name__ == '__main__':
    init_db()
    
    # Kiểm tra xem có SSL certificate không
    import os
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        print("Chạy với HTTPS...")
        print("Truy cập: https://localhost:5000")
        app.run(debug=True, host='127.0.0.1', port=5000, ssl_context=('cert.pem', 'key.pem'))
    else:
        print("Chạy với HTTP (không có SSL certificate)...")
        print("Truy cập: http://localhost:5000")
        print("Để chạy HTTPS, hãy tạo SSL certificate bằng lệnh:")
        print("openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365")
        app.run(debug=True, host='127.0.0.1', port=5000) 