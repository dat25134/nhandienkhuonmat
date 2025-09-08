from flask import Flask, render_template, request, jsonify, send_file
import os
import json
import threading
import base64
import numpy as np
import cv2
import face_recognition
from datetime import datetime
from PIL import Image
import io
from gtts import gTTS
import tempfile
from werkzeug.utils import secure_filename
from pathlib import Path
from flask import send_from_directory, abort

app = Flask(__name__)

# Đảm bảo các thư mục cần thiết tồn tại
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs('models', exist_ok=True)
os.makedirs('data', exist_ok=True)
os.makedirs('data/images', exist_ok=True)
os.makedirs('data/db', exist_ok=True)

USERS_JSON_PATH = Path('data/db/users.json')
_users_lock = threading.Lock()
CHECKINS_JSON_PATH = Path('data/db/checkins.json')
_checkins_lock = threading.Lock()

# Serve media files under data/images via /media/<path>
@app.route('/media/<path:relpath>')
def serve_media(relpath):
    # Only allow serving files inside data/images
    safe_root = Path('data/images').resolve()
    full_path = Path(relpath).resolve()
    try:
        # If relpath is absolute or doesn't start with data/images, prepend
        if not str(full_path).startswith(str(safe_root)):
            full_path = (Path('.') / relpath).resolve()
        if not str(full_path).startswith(str(safe_root)):
            return abort(404)
        if not full_path.exists() or not full_path.is_file():
            return abort(404)
        return send_file(str(full_path))
    except Exception:
        return abort(404)

def _ensure_users_json():
    if not USERS_JSON_PATH.exists():
        USERS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        with USERS_JSON_PATH.open('w', encoding='utf-8') as f:
            json.dump({"users": []}, f, ensure_ascii=False, indent=2)
    else:
        # Nếu file rỗng, ghi cấu trúc mặc định
        try:
            if USERS_JSON_PATH.stat().st_size == 0:
                with USERS_JSON_PATH.open('w', encoding='utf-8') as f:
                    json.dump({"users": []}, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

def load_users_json():
    _ensure_users_json()
    try:
        text = USERS_JSON_PATH.read_text(encoding='utf-8')
        if not text.strip():
            return {"users": []}
        data = json.loads(text)
        if not isinstance(data, dict) or 'users' not in data or not isinstance(data['users'], list):
            return {"users": []}
        return data
    except json.JSONDecodeError:
        # Thử khôi phục từ bản sao lưu
        backup_path = USERS_JSON_PATH.with_suffix('.json.bak')
        try:
            if backup_path.exists():
                text = backup_path.read_text(encoding='utf-8')
                data = json.loads(text)
                # Ghi phục hồi
                USERS_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                return data
        except Exception:
            pass
        # Trả về mặc định nếu không thể khôi phục
        USERS_JSON_PATH.write_text(json.dumps({"users": []}, ensure_ascii=False, indent=2), encoding='utf-8')
        return {"users": []}

def save_users_json(data):
    _ensure_users_json()
    # backup
    backup_path = USERS_JSON_PATH.with_suffix('.json.bak')
    if USERS_JSON_PATH.exists():
        backup_path.write_text(USERS_JSON_PATH.read_text(encoding='utf-8'), encoding='utf-8')
    with USERS_JSON_PATH.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_checkins_json():
    CHECKINS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not CHECKINS_JSON_PATH.exists() or CHECKINS_JSON_PATH.stat().st_size == 0:
        CHECKINS_JSON_PATH.write_text(json.dumps({"checkins": []}, ensure_ascii=False, indent=2), encoding='utf-8')
    try:
        text = CHECKINS_JSON_PATH.read_text(encoding='utf-8')
        if not text.strip():
            return {"checkins": []}
        data = json.loads(text)
        if not isinstance(data, dict) or 'checkins' not in data or not isinstance(data['checkins'], list):
            return {"checkins": []}
        return data
    except json.JSONDecodeError:
        backup = CHECKINS_JSON_PATH.with_suffix('.json.bak')
        if backup.exists():
            text = backup.read_text(encoding='utf-8')
            data = json.loads(text)
            CHECKINS_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            return data
        CHECKINS_JSON_PATH.write_text(json.dumps({"checkins": []}, ensure_ascii=False, indent=2), encoding='utf-8')
        return {"checkins": []}

def save_checkins_json(data):
    backup = CHECKINS_JSON_PATH.with_suffix('.json.bak')
    if CHECKINS_JSON_PATH.exists():
        backup.write_text(CHECKINS_JSON_PATH.read_text(encoding='utf-8'), encoding='utf-8')
    CHECKINS_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def next_user_id(data):
    users = data.get('users', [])
    if not users:
        return 1
    return int(max(u.get('id', 0) for u in users) + 1)

def sanitize_text(value: str, max_len: int = 150) -> str:
    try:
        value = (value or '').strip()
        if len(value) > max_len:
            value = value[:max_len]
        return value
    except Exception:
        return ''

def normalize_phone(phone: str) -> str:
    digits = ''.join([c for c in (phone or '') if c.isdigit()])
    if len(digits) > 15:
        digits = digits[:15]
    return digits

def build_greeting(name: str, gender: str | None) -> str:
    g = (gender or '').strip().lower()
    if g == 'nam':
        title = 'ông'
    elif g == 'nữ' or g == 'nu':
        title = 'Bà'
    else:
        title = 'Quý khách'
    # Giữ nguyên chữ hoa đầu câu
    if title == 'ông':
        title = 'Ông'
    return f'Chào mừng {title} {name} đã đến với hệ thống của chúng tôi'

def init_db():
    # JSON-based storage; ensure file exists
    _ensure_users_json()
    build_encoding_cache()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/training')
def training():
    return render_template('training.html')
@app.route('/checkins')
def checkins_page():
    return render_template('checkins.html')

@app.route('/manage')
def manage_page():
    return render_template('manage.html')

@app.route('/api/users', methods=['GET'])
def get_users():
    data = load_users_json()
    users = data.get('users', [])
    return jsonify([
        {
            'id': u.get('id'),
            'name': u.get('name'),
            'created_at': u.get('created_at'),
            'phone': u.get('phone', ''),
            'gender': u.get('gender', ''),
            'company': u.get('company', ''),
            'department': u.get('department', ''),
            'position': u.get('position', '')
        }
        for u in users
    ])

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    data = load_users_json()
    for u in data.get('users', []):
        if u.get('id') == user_id:
            return jsonify(u)
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/users', methods=['POST'])
def add_user():
    data = request.json
    name = data.get('name')
    image_data = data.get('face_encoding')
    phone = normalize_phone(data.get('phone', ''))
    gender = sanitize_text(data.get('gender', ''))
    company = sanitize_text(data.get('company', ''))
    department = sanitize_text(data.get('department', ''))
    position = sanitize_text(data.get('position', ''))
    
    if not name:
        return jsonify({'error': 'Tên không được để trống'}), 400
    
    if not image_data:
        return jsonify({'error': 'Không có dữ liệu khuôn mặt'}), 400
    
    try:
        # Lưu ảnh từ base64 sang file và ghi JSON
        data_bytes = decode_dataurl_to_bytes(image_data)
        if not data_bytes:
            return jsonify({'error': 'Không thể xử lý ảnh'}), 400

        with _users_lock:
            users_data = load_users_json()
            user_id = next_user_id(users_data)
            # tạo thư mục và ghi file
            now = datetime.utcnow()
            subdir = now.strftime('%Y/%m')
            user_dir = os.path.join('data', 'images', str(user_id), subdir)
            os.makedirs(user_dir, exist_ok=True)
            ts = now.strftime('%Y%m%d%H%M%S%f')
            filename = f'{ts}_captured.jpg'
            save_path = os.path.join(user_dir, filename)
            with open(save_path, 'wb') as f:
                f.write(data_bytes)

            users = users_data.get('users', [])
            users.append({
                'id': user_id,
                'name': name,
                'created_at': datetime.utcnow().isoformat() + 'Z',
                'images': [save_path],
                'phone': phone,
                'gender': gender,
                'company': company,
                'department': department,
                'position': position
            })
            users_data['users'] = users
            save_users_json(users_data)

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
        # Tiền xử lý: resize về tối đa 800px cạnh dài
        image_array = preprocess_image(image_array)
        # Tìm khuôn mặt trong ảnh (upsample để tăng khả năng phát hiện)
        face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=1)
        
        if not face_locations:
            # Fallback thêm một lần upsample nếu chưa thấy
            face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=2)
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

def preprocess_image(image_array):
    try:
        h, w = image_array.shape[:2]
        max_side = max(h, w)
        target = 800
        if max_side > target:
            scale = target / float(max_side)
            new_w = int(w * scale)
            new_h = int(h * scale)
            image_array = cv2.resize(image_array, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return image_array
    except Exception as e:
        print(f'Lỗi preprocess ảnh: {e}')
        return image_array

# ------------------ Encoding cache ------------------
ENCODING_CACHE = []  # list of dicts: { 'id': int, 'name': str, 'encodings': [np.ndarray] }
CENTROID_CACHE = []  # list of dicts: { 'id': int, 'name': str, 'gender': str, 'centroid': np.ndarray, 'count': int }

# Strict recognition policy
STRICT_TOLERANCE = 0.53
TOP2_GAP_MIN = 0.07
BLUR_MIN_ENROLL = 80.0   # discard enrollment images blurrier than this
BLUR_MIN_QUERY = 60.0    # reject very blurry queries

def build_encoding_cache():
    global ENCODING_CACHE
    global CENTROID_CACHE
    ENCODING_CACHE = []
    CENTROID_CACHE = []
    try:
        users = load_users_json().get('users', [])
        for u in users:
            uid = u.get('id')
            name = u.get('name')
            gender = u.get('gender', '')
            paths = u.get('images', [])
            encs = []
            for p in paths:
                try:
                    with open(p, 'rb') as f:
                        img = Image.open(io.BytesIO(f.read()))
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        arr = np.array(img)
                        # Blur quality filter for enrollment
                        if compute_blur_score(arr) < BLUR_MIN_ENROLL:
                            continue
                        e = get_face_encoding(arr)
                        if e is not None:
                            encs.append(e)
                except Exception as e:
                    print(f'Lỗi cache ảnh {p}: {e}')
                    continue
            if encs:
                ENCODING_CACHE.append({'id': uid, 'name': name, 'encodings': encs})
                centroid = np.mean(np.vstack(encs), axis=0)
                CENTROID_CACHE.append({'id': uid, 'name': name, 'gender': gender, 'centroid': centroid, 'count': len(encs)})
    except Exception as e:
        print(f'Lỗi build cache: {e}')
    print(f'Cache encodings: {sum(len(x.get("encodings", [])) for x in ENCODING_CACHE)} vectors; centroids: {len(CENTROID_CACHE)} users')

def add_user_encodings_to_cache(user_id, name, image_paths):
    try:
        encs = []
        for p in image_paths:
            try:
                with open(p, 'rb') as f:
                    img = Image.open(io.BytesIO(f.read()))
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    arr = np.array(img)
                    if compute_blur_score(arr) < BLUR_MIN_ENROLL:
                        continue
                    e = get_face_encoding(arr)
                    if e is not None:
                        encs.append(e)
            except Exception as e:
                print(f'Lỗi cache ảnh mới {p}: {e}')
                continue
        if encs:
            ENCODING_CACHE.append({'id': user_id, 'name': name, 'encodings': encs})
            centroid = np.mean(np.vstack(encs), axis=0)
            # append or replace centroid for this user
            global CENTROID_CACHE
            CENTROID_CACHE = [c for c in CENTROID_CACHE if c.get('id') != user_id]
            # find gender from users.json
            ugender = ''
            try:
                for u in load_users_json().get('users', []):
                    if u.get('id') == user_id:
                        ugender = u.get('gender', '')
                        break
            except Exception:
                pass
            CENTROID_CACHE.append({'id': user_id, 'name': name, 'gender': ugender, 'centroid': centroid, 'count': len(encs)})
    except Exception as e:
        print(f'Lỗi add cache: {e}')

def find_best_match(query_encoding, tolerance=0.65):
    """Tìm người phù hợp nhất theo khoảng cách thấp nhất"""
    best_name = None
    best_distance = 1e9
    for entry in ENCODING_CACHE:
        name = entry.get('name')
        encs = entry.get('encodings', [])
        if not encs:
            continue
        try:
            distances = face_recognition.face_distance(encs, query_encoding)
            dmin = float(np.min(distances)) if len(distances) > 0 else 1e9
            if dmin < best_distance:
                best_distance = dmin
                best_name = name
        except Exception as e:
            print(f'Lỗi tính distance: {e}')
            continue
    if best_distance <= tolerance:
        return best_name, best_distance
    return None, best_distance

def compute_blur_score(image_array):
    try:
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())
    except Exception:
        return 0.0

def match_centroid_strict(query_encoding):
    """Return (accepted:boolean, user_id, name, gender, d1, d2) with strict threshold+gap on centroids"""
    if not CENTROID_CACHE:
        return False, None, None, None, None, None
    # build matrix
    centroids = np.vstack([c['centroid'] for c in CENTROID_CACHE]).astype(np.float64)
    dists = face_recognition.face_distance(centroids, query_encoding)
    order = np.argsort(dists)
    if len(order) == 0:
        return False, None, None, None, None, None
    i1 = int(order[0])
    d1 = float(dists[i1])
    d2 = float(dists[int(order[1])]) if len(order) > 1 else 1e9
    cand = CENTROID_CACHE[i1]
    accept = (d1 <= STRICT_TOLERANCE) and ((d2 - d1) >= TOP2_GAP_MIN)
    if not accept:
        return False, None, None, None, d1, d2
    return True, cand['id'], cand['name'], cand.get('gender', ''), d1, d2

def average_encodings(encodings_list):
    try:
        if not encodings_list:
            return None
        arr = np.vstack(encodings_list)
        mean_vec = arr.mean(axis=0)
        return mean_vec
    except Exception as e:
        print(f"Lỗi gộp encoding: {e}")
        return None

def save_image_file(user_id, file_storage):
    try:
        # Lưu ảnh vào data/images/<user_id>/YYYY/MM/<timestamp>_<filename>
        now = datetime.utcnow()
        subdir = now.strftime('%Y/%m')
        user_dir = os.path.join('data', 'images', str(user_id), subdir)
        os.makedirs(user_dir, exist_ok=True)
        filename = secure_filename(file_storage.filename or f'image_{now.strftime("%H%M%S%f")}.jpg')
        ts = now.strftime('%Y%m%d%H%M%S%f')
        save_path = os.path.join(user_dir, f'{ts}_{filename}')
        file_storage.save(save_path)
        return save_path
    except Exception as e:
        print(f'Lỗi lưu ảnh: {e}')
        return None

def delete_image_file(path: str) -> bool:
    try:
        if path and os.path.exists(path):
            os.remove(path)
        return True
    except Exception as e:
        print(f'Lỗi xóa ảnh: {e}')
        return False

def decode_dataurl_to_bytes(data_url):
    try:
        if ',' in data_url:
            data_url = data_url.split(',')[1]
        return base64.b64decode(data_url)
    except Exception as e:
        print(f'Lỗi decode data url: {e}')
        return None

@app.route('/api/users/multi', methods=['POST'])
def add_user_multi():
    data = request.json
    name = data.get('name')
    images_data = data.get('images') or []
    phone = normalize_phone(data.get('phone', ''))
    gender = sanitize_text(data.get('gender', ''))
    company = sanitize_text(data.get('company', ''))
    department = sanitize_text(data.get('department', ''))
    position = sanitize_text(data.get('position', ''))

    if not name:
        return jsonify({'error': 'Tên không được để trống'}), 400
    if not images_data or not isinstance(images_data, list):
        return jsonify({'error': 'Cần cung cấp danh sách ảnh (1-5 ảnh)'}), 400

    try:
        used = 0
        saved_paths = []
        with _users_lock:
            users_data = load_users_json()
            user_id = next_user_id(users_data)
            now = datetime.utcnow()
            subdir = now.strftime('%Y/%m')
            user_dir = os.path.join('data', 'images', str(user_id), subdir)
            os.makedirs(user_dir, exist_ok=True)

            for img_b64 in images_data[:5]:
                data_bytes = decode_dataurl_to_bytes(img_b64)
                if not data_bytes:
                    continue
                ts = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
                filename = f'{ts}_captured.jpg'
                path = os.path.join(user_dir, filename)
                with open(path, 'wb') as f:
                    f.write(data_bytes)
                saved_paths.append(path)
                used += 1

            if not saved_paths:
                return jsonify({'error': 'Không thể lưu ảnh hợp lệ'}), 400

            users = users_data.get('users', [])
            users.append({
                'id': user_id,
                'name': name,
                'created_at': datetime.utcnow().isoformat() + 'Z',
                'images': saved_paths,
                'phone': phone,
                'gender': gender,
                'company': company,
                'department': department,
                'position': position
            })
            users_data['users'] = users
            save_users_json(users_data)

        # Cập nhật cache encodings
        add_user_encodings_to_cache(user_id, name, saved_paths)

        return jsonify({'message': 'Thêm người dùng thành công', 'images_used': used})

    except Exception as e:
        print(f"Lỗi thêm người dùng (multi): {e}")
        return jsonify({'error': 'Lỗi xử lý thêm người dùng (multi)'}), 500

@app.route('/api/users/upload', methods=['POST'])
def add_user_upload():
    name = request.form.get('name')
    phone = normalize_phone(request.form.get('phone', ''))
    gender = sanitize_text(request.form.get('gender', ''))
    company = sanitize_text(request.form.get('company', ''))
    department = sanitize_text(request.form.get('department', ''))
    position = sanitize_text(request.form.get('position', ''))
    files = request.files.getlist('files')

    if not name:
        return jsonify({'error': 'Tên không được để trống'}), 400
    if not files:
        return jsonify({'error': 'Vui lòng upload 1-5 ảnh'}), 400

    try:
        with _users_lock:
            users_data = load_users_json()
            user_id = next_user_id(users_data)

            saved_paths = []
            used = 0
            for file in files[:5]:
                path = save_image_file(user_id, file)
                if not path:
                    continue
                saved_paths.append(path)
                used += 1

            if not saved_paths:
                return jsonify({'error': 'Không thể lưu ảnh hợp lệ'}), 400

            users = users_data.get('users', [])
            users.append({
                'id': user_id,
                'name': name,
                'created_at': datetime.utcnow().isoformat() + 'Z',
                'images': saved_paths,
                'phone': phone,
                'gender': gender,
                'company': company,
                'department': department,
                'position': position
            })
            users_data['users'] = users
            save_users_json(users_data)

        # Cập nhật cache encodings
        add_user_encodings_to_cache(user_id, name, saved_paths)

        return jsonify({'message': 'Thêm người dùng thành công', 'user_id': user_id, 'images_used': used, 'saved': len(saved_paths)})

    except Exception as e:
        print(f'Lỗi thêm người dùng (upload): {e}')
        return jsonify({'error': 'Lỗi xử lý thêm người dùng (upload)'}), 500

@app.route('/api/recognize/upload', methods=['POST'])
def recognize_upload():
    files = request.files.getlist('files')
    if not files:
        return jsonify({'recognized': False, 'message': 'Vui lòng upload 1-5 ảnh'}), 400

    try:
        encodings = []
        used = 0
        for file in files[:5]:
            try:
                img = Image.open(file.stream)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                image_array = np.array(img)
                e = get_face_encoding(image_array)
                if e is not None:
                    encodings.append(e)
                    used += 1
            except Exception as e:
                print(f'Lỗi đọc/trích xuất ảnh upload: {e}')
                continue

        if not encodings:
            return jsonify({'recognized': False, 'message': 'Không tìm thấy khuôn mặt trong các ảnh'}), 400

        fused = average_encodings(encodings)

        conn = sqlite3.connect('face_recognition.db')
        cursor = conn.cursor()
        cursor.execute('SELECT name, face_encoding FROM users')
        users = cursor.fetchall()
        conn.close()

        for user in users:
            name, stored_encoding_str = user
            if stored_encoding_str:
                try:
                    stored_encoding = np.frombuffer(base64.b64decode(stored_encoding_str), dtype=np.float64)
                    matches = face_recognition.compare_faces([stored_encoding], fused, tolerance=0.6)
                    if matches[0]:
                        # Greeting theo giới tính đã lưu
                        ugender = ''
                        try:
                            users_json = load_users_json().get('users', [])
                            for uu in users_json:
                                if uu.get('name') == name:
                                    ugender = uu.get('gender', '')
                                    break
                        except Exception:
                            pass
                        return jsonify({'recognized': True, 'name': name, 'message': build_greeting(name, ugender), 'images_used': used})
                except Exception as e:
                    print(f'Lỗi so sánh khuôn mặt (upload): {e}')
                    continue

        return jsonify({'recognized': False, 'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'})

    except Exception as e:
        print(f'Lỗi nhận dạng (upload): {e}')
        return jsonify({'recognized': False, 'message': 'Lỗi xử lý nhận dạng (upload)'}), 500

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
        
        # Lọc chất lượng query
        if compute_blur_score(image_array) < BLUR_MIN_QUERY:
            return jsonify({'recognized': False, 'message': 'Ảnh quá mờ, vui lòng chụp lại với ánh sáng tốt hơn'}), 400

        # So khớp nghiêm ngặt theo centroid + gap
        accepted, uid, uname, ugender, d1, d2 = match_centroid_strict(current_face_encoding)
        if accepted:
            return jsonify({
                'recognized': True,
                'user_id': uid,
                'name': uname,
                'message': build_greeting(uname, ugender),
                'distance': d1
            })
        
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

@app.route('/api/detect-face', methods=['POST'])
def detect_face():
    """API để kiểm tra có khuôn mặt trong ảnh hay không"""
    data = request.json
    image_data = data.get('image')
    
    if not image_data:
        return jsonify({'has_face': False, 'message': 'Không có dữ liệu ảnh'}), 400
    
    try:
        # Decode ảnh
        image_array = decode_image(image_data)
        if image_array is None:
            return jsonify({'has_face': False, 'message': 'Lỗi decode ảnh'}), 400
        
        # Kiểm tra có khuôn mặt không
        face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=1)
        
        if not face_locations:
            # Thử upsample thêm một lần nữa
            face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=2)
        
        has_face = len(face_locations) > 0
        
        return jsonify({
            'has_face': has_face,
            'face_count': len(face_locations),
            'message': f'Phát hiện {len(face_locations)} khuôn mặt' if has_face else 'Không phát hiện khuôn mặt'
        })
        
    except Exception as e:
        print(f"Lỗi detect face: {e}")
        return jsonify({'has_face': False, 'message': 'Lỗi xử lý phát hiện khuôn mặt'}), 500

@app.route('/api/recognize/multi', methods=['POST'])
def recognize_face_multi():
    data = request.json
    images_data = data.get('images') or []

    if not images_data or not isinstance(images_data, list):
        return jsonify({
            'recognized': False,
            'message': 'Vui lòng gửi danh sách ảnh (1-5 ảnh)'
        }), 400

    try:
        encodings = []
        found = False
        best_name = None
        d1 = None
        for img_b64 in images_data[:5]:
            image_array = decode_image(img_b64)
            if image_array is None:
                continue
            e = get_face_encoding(image_array)
            if e is not None:
                encodings.append(e)

        if not encodings:
            return jsonify({
                'recognized': False,
                'message': 'Không tìm thấy khuôn mặt trong các ảnh'
            }), 400

        fused = average_encodings(encodings)
        if fused is None:
            return jsonify({
                'recognized': False,
                'message': 'Lỗi xử lý dữ liệu khuôn mặt'
            }), 500

        # So khớp nghiêm ngặt theo centroid + gap
        accepted, uid, uname, ugender, d1, d2 = match_centroid_strict(fused)
        if accepted:
            best_name = uname
            found = True

        if found:
            # Lấy user_id và giới tính
            uid = None
            ugender = ''
            users = load_users_json().get('users', [])
            for u in users:
                if u.get('name') == best_name:
                    uid = u.get('id')
                    ugender = u.get('gender', '')
                    break
            return jsonify({
                'recognized': True,
                'user_id': uid,
                'name': best_name,
                'message': build_greeting(best_name, ugender),
                'distance': d1
            })

        return jsonify({
            'recognized': False,
            'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
        })

    except Exception as e:
        print(f"Lỗi nhận dạng khuôn mặt (multi): {e}")
        return jsonify({
            'recognized': False,
            'message': 'Lỗi xử lý nhận dạng (multi)'
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

@app.route('/api/users/<int:user_id>/profile', methods=['PUT'])
def update_profile(user_id):
    data = request.json or {}
    allowed = ['phone', 'gender', 'company', 'department', 'position']
    update_fields = {k: sanitize_text(v if k != 'phone' else normalize_phone(v)) for k, v in data.items() if k in allowed}
    if not update_fields:
        return jsonify({'error': 'No fields to update'}), 400
    with _users_lock:
        users = load_users_json()
        changed = False
        for u in users.get('users', []):
            if u.get('id') == user_id:
                for k, v in update_fields.items():
                    u[k] = v
                changed = True
                break
        if not changed:
            return jsonify({'error': 'User not found'}), 404
        save_users_json(users)
    return jsonify({'status': 'ok'})

@app.route('/api/users/<int:user_id>/images', methods=['POST'])
def add_images_to_user(user_id):
    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'Vui lòng upload 1-5 ảnh'}), 400
    saved = []
    for file in files[:5]:
        p = save_image_file(user_id, file)
        if p:
            saved.append(p)
    if not saved:
        return jsonify({'error': 'Không lưu được ảnh'}), 400
    with _users_lock:
        data = load_users_json()
        found = False
        for u in data.get('users', []):
            if u.get('id') == user_id:
                u.setdefault('images', [])
                u['images'].extend(saved)
                found = True
                break
        if not found:
            return jsonify({'error': 'User not found'}), 404
        save_users_json(data)
    # Refresh cache for this user
    add_user_encodings_to_cache(user_id, next((u.get('name') for u in data.get('users', []) if u.get('id')==user_id), ''), saved)
    return jsonify({'saved': len(saved), 'paths': saved})

@app.route('/api/users/<int:user_id>/images', methods=['DELETE'])
def delete_images_of_user(user_id):
    payload = request.json or {}
    paths = payload.get('paths') or []
    if not isinstance(paths, list) or not paths:
        return jsonify({'error': 'paths required'}), 400
    removed = 0
    for p in paths:
        if delete_image_file(p):
            removed += 1
    with _users_lock:
        data = load_users_json()
        for u in data.get('users', []):
            if u.get('id') == user_id:
                u['images'] = [x for x in u.get('images', []) if x not in paths]
                break
        save_users_json(data)
    # Rebuild cache fully to drop deleted vectors
    build_encoding_cache()
    return jsonify({'removed': removed})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    with _users_lock:
        data = load_users_json()
        users = data.get('users', [])
        target = None
        for u in users:
            if u.get('id') == user_id:
                target = u
                break
        if not target:
            return jsonify({'error': 'User not found'}), 404
        # Không xóa thư mục ảnh theo yêu cầu hiện tại, chỉ bỏ liên kết
        data['users'] = [u for u in users if u.get('id') != user_id]
        save_users_json(data)
    build_encoding_cache()
    return jsonify({'status': 'ok'})

@app.route('/api/cache/rebuild', methods=['POST'])
def rebuild_cache():
    build_encoding_cache()
    return jsonify({'status': 'ok', 'users': len(ENCODING_CACHE)})

@app.route('/api/checkin/<int:user_id>', methods=['POST'])
def checkin_user(user_id):
    # Ghi đè lần check-in mới nhất của user
    payload = request.json or {}
    now_iso = datetime.utcnow().isoformat() + 'Z'
    with _checkins_lock:
        data = load_checkins_json()
        lst = data.get('checkins', [])
        # Xóa bản cũ nếu có
        lst = [c for c in lst if c.get('user_id') != user_id]
        entry = {
            'user_id': user_id,
            'name': sanitize_text(payload.get('name', '')),
            'phone': normalize_phone(payload.get('phone', '')),
            'gender': sanitize_text(payload.get('gender', '')),
            'company': sanitize_text(payload.get('company', '')),
            'department': sanitize_text(payload.get('department', '')),
            'position': sanitize_text(payload.get('position', '')),
            'checked_at': now_iso,
        }
        lst.append(entry)
        data['checkins'] = lst
        save_checkins_json(data)
    return jsonify({'status': 'ok', 'checked_at': now_iso})

@app.route('/api/checkins', methods=['GET'])
def get_checkins():
    data = load_checkins_json()
    return jsonify(data.get('checkins', []))

if __name__ == '__main__':
    init_db()
    
    # Kiểm tra xem có SSL certificate không
    import os
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        print("Chạy với HTTPS...")
        print("Truy cập LAN: https://<IP_LAN>:5000")
        app.run(debug=True, host='0.0.0.0', port=5000, ssl_context=('cert.pem', 'key.pem'))
    else:
        print("Chạy với HTTP (không có SSL certificate)...")
        print("Truy cập LAN: http://<IP_LAN>:5000")
        print("Để chạy HTTPS, hãy tạo SSL certificate bằng lệnh:")
        print("openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365")
        app.run(debug=True, host='0.0.0.0', port=5000)