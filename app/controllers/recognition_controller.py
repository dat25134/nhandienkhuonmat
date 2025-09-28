"""
Recognition Controller
Handles face recognition API endpoints
"""
import os
from flask import Blueprint, request, jsonify
from app.services.face_recognition_service import FaceRecognitionService
from app.services.cache_service import CacheService

recognition_bp = Blueprint('recognition', __name__)

# Global services (would be better with dependency injection in production)
face_service = FaceRecognitionService()
cache_service = CacheService()

# Build cache on module import
cache_service.build_cache()

@recognition_bp.route('/api/recognize/multi', methods=['POST'])
def recognize_face_multi():
    """Recognize multiple faces from multiple images"""
    data = request.json
    images_data = data.get('images') or []

    if not images_data or not isinstance(images_data, list):
        return jsonify({
            'recognized': False,
            'message': 'Vui lòng gửi danh sách ảnh (1-5 ảnh)'
        }), 400

    try:
        all_recognized = []
        
        for img_b64 in images_data[:5]:  # Limit to 5 images
            # Decode image
            image_array = face_service.decode_image(img_b64)
            if image_array is None:
                continue
                
            # Get all face encodings from this image
            face_encodings = face_service.get_all_face_encodings(image_array)
            
            for face_encoding in face_encodings:
                # Match face with cache
                accepted, uid, uname, ugender, d1, d2 = cache_service.match_face_strict(face_encoding)
                if accepted:
                    # Get full user info
                    from app.models.user import User
                    user = User.get_by_id(uid)
                    
                    if user:
                        # Convert file paths to URLs
                        user_images = []
                        if user.images:
                            user_images = [
                                f'/api/media/images/{user.id}/{os.path.basename(img_path)}' 
                                for img_path in user.images
                            ]
                        
                        user_avatar = ''
                        if user.avatar:
                            user_avatar = f'/api/media/avatar/{user.id}/{os.path.basename(user.avatar)}'
                        
                        all_recognized.append({
                            'user_id': user.id,
                            'name': uname,
                            'gender': ugender,
                            'message': f'Chào mừng {uname} đã đến với hệ thống của chúng tôi',
                            'distance': d1,
                            'images': user_images,
                            'phone': user.phone,
                            'company': user.company,
                            'department': user.department,
                            'position': user.position,
                            'seat_number': user.seat_number,
                            'email': user.email,
                            'avatar': user_avatar,
                            'notes': user.notes,
                            'created_at': user.created_at
                        })

        if all_recognized:
            # Remove duplicates based on user_id
            unique_recognized = []
            seen_ids = set()
            for item in all_recognized:
                if item['user_id'] not in seen_ids:
                    unique_recognized.append(item)
                    seen_ids.add(item['user_id'])
            
            return jsonify({
                'recognized': True,
                'count': len(unique_recognized),
                'faces': unique_recognized
            })

        return jsonify({
            'recognized': False,
            'message': 'Hiện tại hệ thống chưa có thông tin về bạn, hãy liên hệ với người có thẩm quyền hoặc tự thêm thông tin vào hệ thống'
        })

    except Exception as e:
        print(f"Error in face recognition (multi): {e}")
        return jsonify({
            'recognized': False,
            'message': 'Lỗi xử lý nhận dạng (multi)'
        }), 500

@recognition_bp.route('/api/cache/rebuild', methods=['POST'])
def rebuild_cache():
    """Rebuild face encoding cache"""
    try:
        cache_service.build_cache()
        status = cache_service.get_cache_status()
        return jsonify({
            'status': 'ok',
            'users': status['users_cached'],
            'encodings': status['total_encodings']
        })
    except Exception as e:
        print(f"Error rebuilding cache: {e}")
        return jsonify({'error': 'Lỗi rebuild cache'}), 500

@recognition_bp.route('/api/cache/status', methods=['GET'])
def cache_status():
    """Get cache status"""
    try:
        status = cache_service.get_cache_status()
        return jsonify(status)
    except Exception as e:
        print(f"Error getting cache status: {e}")
        return jsonify({'error': 'Lỗi lấy trạng thái cache'}), 500
