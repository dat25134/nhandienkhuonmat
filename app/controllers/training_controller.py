"""
Training Controller
Handles user training/registration API endpoints
"""
from flask import Blueprint, request, jsonify
from app.services.user_service import UserService
from app.services.face_recognition_service import FaceRecognitionService
from app.services.cache_service import CacheService
from app.utils.helpers import build_greeting, sanitize_text, normalize_phone
from app.models.user import User
from datetime import datetime
import os
import base64
import io
import numpy as np
from PIL import Image

training_bp = Blueprint('training', __name__)

# Global services
user_service = UserService()
face_service = FaceRecognitionService()
cache_service = CacheService()

@training_bp.route('/api/training', methods=['POST'])
def training():
    """Training endpoint for user registration with multiple images"""
    try:
        data = request.json
        
        # Extract delegate info
        delegate_info = data.get('delegateInfo', {})
        training_images = data.get('trainingImages', [])
        
        
        # Validate required fields
        if not delegate_info.get('name'):
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Tên không được để trống'
                }
            }), 400
        
        if not training_images or len(training_images) == 0:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Cần cung cấp ít nhất 1 ảnh training'
                }
            }), 400
        
        # Extract user information
        name = sanitize_text(delegate_info.get('name', ''))
        phone = normalize_phone(delegate_info.get('phone', ''))
        email = sanitize_text(delegate_info.get('email', ''))
        organization = sanitize_text(delegate_info.get('organization', ''))
        position = sanitize_text(delegate_info.get('position', ''))
        notes = sanitize_text(delegate_info.get('notes', ''))
        avatar = delegate_info.get('avatar', '')
        
        # Check for existing user with same name, phone, and email FIRST
        existing_user = None
        all_users = User.get_all()
        for u in all_users:
            if (u.name == name and 
                u.phone == phone and 
                u.email == email and 
                email):  # Only check if email is provided
                existing_user = u
                break
        
        # Determine user_id - use existing or generate new
        if existing_user:
            user_id = existing_user.id
        else:
            user_id = User.get_next_id()
        
        # Process training images
        saved_images = []
        valid_encodings = []
        processing_errors = []
        
        for i, img_data in enumerate(training_images):
            
            # Check for both 'image' and 'imageData' fields
            image_base64 = img_data.get('image') or img_data.get('imageData')
            if not image_base64:
                error_msg = f"Image {i+1}: No image data provided"
                processing_errors.append(error_msg)
                continue
                
            try:
                # Decode base64 image
                if ',' in image_base64:
                    image_base64 = image_base64.split(',')[1]
                
                image_bytes = base64.b64decode(image_base64)
                
                # Check image quality BEFORE saving
                img = Image.open(io.BytesIO(image_bytes))
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img_array = np.array(img)
                
                # Check image quality and enhance if needed
                original_blur = face_service.compute_blur_score(img_array)
                if original_blur < face_service.blur_min_enroll:
                    # Try to enhance the image
                    enhanced_img = face_service.preprocess_image(img_array, force_enhance=True)
                    enhanced_blur = face_service.compute_blur_score(enhanced_img)
                    if enhanced_blur < face_service.blur_min_enroll:
                        error_msg = f"Image {i+1}: Chất lượng ảnh không đạt yêu cầu (blur: {original_blur:.1f} -> {enhanced_blur:.1f}), hãy chụp lại"
                        processing_errors.append(error_msg)
                        continue
                    # Use enhanced image for further processing
                    img_array = enhanced_img
                
                if not face_service.is_image_quality_good(img_array, is_enrollment=True):
                    error_msg = f"Image {i+1}: Không phát hiện khuôn mặt hợp lệ trong ảnh"
                    processing_errors.append(error_msg)
                    continue
                
                # Extract face encoding for validation
                face_encoding = face_service.get_face_encoding(img_array)
                
                if face_encoding is not None:
                    # Save image file only if quality is good and face detected
                    user_dir = os.path.join('data', 'images', str(user_id))
                    os.makedirs(user_dir, exist_ok=True)
                    
                    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
                    angle = img_data.get('angle', f'img_{i}')
                    filename = f'{timestamp}_{angle}.jpg'
                    image_path = os.path.join(user_dir, filename)
                    
                    with open(image_path, 'wb') as f:
                        f.write(image_bytes)
                    
                    saved_images.append(image_path)
                    valid_encodings.append(face_encoding)
                
            except Exception as e:
                error_msg = f"Image {i+1}: Error processing - {str(e)}"
                processing_errors.append(error_msg)
                continue
        
        
        if not saved_images:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Không có ảnh nào đạt chất lượng yêu cầu, Hãy chụp lại ảnh với chất lượng tốt hơn (rõ nét, ánh sáng tốt)',
                    'details': processing_errors,
                    'suggestion': 'Hãy chụp lại ảnh với chất lượng tốt hơn (rõ nét, ánh sáng tốt)'
                }
            }), 400
        
        if len(valid_encodings) == 0:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Không phát hiện khuôn mặt hợp lệ trong ảnh',
                    'details': processing_errors,
                    'suggestion': 'Vui lòng chụp ảnh rõ nét, có khuôn mặt rõ ràng và ánh sáng tốt'
                }
            }), 400
        
        # Process avatar if provided
        avatar_path = ''
        if avatar:
            try:
                # Create avatar directory for user
                avatar_dir = os.path.join('data', 'avatar', str(user_id))
                os.makedirs(avatar_dir, exist_ok=True)
                
                # Decode base64 avatar
                if avatar.startswith('data:image'):
                    # Remove data URL prefix
                    avatar_base64 = avatar.split(',')[1]
                else:
                    avatar_base64 = avatar
                
                avatar_bytes = base64.b64decode(avatar_base64)
                
                # Save avatar file
                timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
                avatar_filename = f'avatar_{timestamp}.jpg'
                avatar_path = os.path.join(avatar_dir, avatar_filename)
                
                with open(avatar_path, 'wb') as f:
                    f.write(avatar_bytes)
            except Exception as e:
                processing_errors.append(f"Avatar processing error: {str(e)}")
        
        if existing_user:
            # Update existing user with new images and avatar
            
            # Add new images to existing user
            existing_user.images.extend(saved_images)
            
            # Update avatar if provided
            if avatar_path:
                existing_user.avatar = avatar_path
            
            # Update other fields if they're different
            if organization and organization != existing_user.company:
                existing_user.company = organization
            if position and position != existing_user.position:
                existing_user.position = position
            if delegate_info.get('department') and delegate_info.get('department') != existing_user.department:
                existing_user.department = delegate_info.get('department', '')
            if delegate_info.get('notes') and delegate_info.get('notes') != existing_user.notes:
                existing_user.notes = delegate_info.get('notes', '')
            
            # Save updated user
            existing_user.save()
            user = existing_user
        else:
            # Create new user
            user_data = {
                'id': user_id,  # Use the determined user_id
                'name': name,
                'phone': phone,
                'gender': delegate_info.get('gender', ''),
                'company': organization,
                'department': delegate_info.get('department', ''),
                'position': position,
                'seat_number': delegate_info.get('seat_number', ''),
                'email': email or '',
                'avatar': avatar_path,  # Store file path instead of base64
                'notes': delegate_info.get('notes', ''),
                'images': saved_images
            }
            
            # Create user in database
            user = user_service.create_user(user_data)
        
        # Rebuild cache to include new user
        cache_service.build_cache()
        
        # Convert file paths to URLs for response
        user_dict = user.to_dict()
        
        # Convert image paths to URLs
        if user_dict.get('images'):
            user_dict['images'] = [
                f'/api/media/images/{user_id}/{os.path.basename(img_path)}' 
                for img_path in user_dict['images']
            ]
        
        # Convert avatar path to URL
        if user_dict.get('avatar'):
            user_dict['avatar'] = f'/api/media/avatar/{user_id}/{os.path.basename(user_dict["avatar"])}'
        
        return jsonify({
            'success': True,
            'message': f'Đăng ký thành công cho {name}',
            'user': user_dict,
            'images_processed': len(saved_images),
            'valid_faces': len(valid_encodings),
            'greeting': build_greeting(name, ''),
            'debug_info': {
                'processing_errors': processing_errors,
                'total_images': len(training_images)
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': 'Lỗi xử lý đăng ký'
            }
        }), 500

@training_bp.route('/api/training/validate', methods=['POST'])
def validate_training_images():
    """Validate training images before registration"""
    try:
        data = request.json
        training_images = data.get('trainingImages', [])
        
        if not training_images:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Không có ảnh để validate'
                }
            }), 400
        
        results = []
        valid_count = 0
        
        for i, img_data in enumerate(training_images):
            # Check for both 'image' and 'imageData' fields
            image_base64 = img_data.get('image') or img_data.get('imageData')
            if not image_base64:
                results.append({
                    'index': i,
                    'angle': img_data.get('angle', f'img_{i}'),
                    'valid': False,
                    'error': 'Không có dữ liệu ảnh (checked image and imageData fields)'
                })
                continue
            
            try:
                # Decode and process image
                if ',' in image_base64:
                    image_base64 = image_base64.split(',')[1]
                
                image_bytes = base64.b64decode(image_base64)
                
                img = Image.open(io.BytesIO(image_bytes))
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img_array = np.array(img)
                
                # Check image quality
                quality_good = face_service.is_image_quality_good(img_array, is_enrollment=True)
                face_encoding = face_service.get_face_encoding(img_array)
                
                is_valid = quality_good and face_encoding is not None
                if is_valid:
                    valid_count += 1
                
                results.append({
                    'index': i,
                    'angle': img_data.get('angle', f'img_{i}'),
                    'valid': is_valid,
                    'quality_good': quality_good,
                    'face_detected': face_encoding is not None,
                    'error': None if is_valid else 'Chất lượng ảnh kém hoặc không phát hiện khuôn mặt'
                })
                
            except Exception as e:
                results.append({
                    'index': i,
                    'angle': img_data.get('angle', f'img_{i}'),
                    'valid': False,
                    'error': f'Lỗi xử lý ảnh: {str(e)}'
                })
        
        return jsonify({
            'valid_count': valid_count,
            'total_count': len(training_images),
            'results': results,
            'ready_for_training': valid_count > 0
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': 'Lỗi validate ảnh'
            }
        }), 500
