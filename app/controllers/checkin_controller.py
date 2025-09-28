"""
Checkin controller for face recognition system
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.checkin import Checkin
from app.models.user import User
from app.utils.helpers import sanitize_text, normalize_phone

checkin_bp = Blueprint('checkin', __name__)


@checkin_bp.route('/api/checkin/<int:user_id>', methods=['POST'])
def checkin_user(user_id):
    """Check-in user by ID (overwrites previous checkin for same user)"""
    try:
        # Get user data from users.json
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'User not found'
                }
            }), 404
        
        # Create checkin with user data synchronized
        checkin = Checkin(
            user_id=user_id,
            name=user.name,
            phone=user.phone,
            gender=user.gender,
            company=user.company,
            department=user.department,
            position=user.position,
            seat_number=user.seat_number,
            email=user.email,
            avatar=user.avatar,
            notes=user.notes,
            method='manual'
        )
        
        # Save checkin (this will auto-assign ID)
        checkin.save()
        
        return jsonify({
            'status': 'ok', 
            'checked_at': checkin.checked_at,
            'user_id': user_id,
            'name': user.name,
            'checkin_id': checkin.id
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Checkin error: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkins', methods=['GET'])
def get_checkins():
    """Get all checkins"""
    try:
        checkins = Checkin.load_all()
        return jsonify([checkin.to_dict() for checkin in checkins])
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error loading checkins: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkins/clear', methods=['POST'])
def clear_checkins():
    """Clear all checkins"""
    try:
        Checkin.clear_all()
        return jsonify({
            'success': True,
            'message': 'Đã xóa toàn bộ checkins',
            'cleared': True
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error clearing checkins: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/manual-checkin', methods=['POST'])
def manual_checkin():
    """Manual checkin by user_id with duplicate check"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Thiếu user_id'
                }
            }), 400
        
        # Check if user exists
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Không tìm thấy người dùng'
                }
            }), 404
        
        # Check if already checked in today
        existing_checkin = Checkin.get_today_checkin(user_id)
        if existing_checkin:
            return jsonify({
                'error': 'Khách đã checkin',
                'message': f'{user.name} đã check-in lúc {existing_checkin.checked_at}',
                'checked_at': existing_checkin.checked_at
            }), 400
        
        # Create new checkin
        checkin = Checkin(
            user_id=user_id,
            name=user.name,
            phone=user.phone,
            gender=user.gender,
            company=user.company,
            department=user.department,
            position=user.position,
            seat_number=user.seat_number,
            email=user.email,
            avatar=user.avatar,
            notes=user.notes,
            method='manual'
        )
        
        # Save checkin (this will auto-assign ID)
        checkin.save()
        
        return jsonify({
            'success': True,
            'message': f'Check-in thành công cho {user.name}',
            'checkin': checkin.to_dict()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Lỗi checkin thủ công: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkin-status/<int:user_id>', methods=['GET'])
def check_checkin_status(user_id):
    """Check checkin status for user"""
    try:
        checkin = Checkin.get_by_user_id(user_id)
        
        if checkin:
            return jsonify({
                'checked_in': True,
                'checkin_time': checkin.checked_at,
                'name': checkin.name,
                'method': checkin.method
            })
        
        return jsonify({'checked_in': False, 'checkin_time': None})
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Lỗi kiểm tra trạng thái check-in: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkins/fix-ids', methods=['POST'])
def fix_checkin_ids():
    """Fix checkins with null IDs"""
    try:
        Checkin.fix_null_ids()
        return jsonify({
            'success': True,
            'message': 'Đã sửa các ID null trong checkins'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error fixing IDs: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/users/search', methods=['GET'])
def search_users():
    """Search users for manual checkin"""
    try:
        query = request.args.get('q', '').lower()
        users = User.get_all()
        
        if query:
            # Search by name, phone, company, seat_number
            filtered_users = [u for u in users if 
                            query in u.name.lower() or
                            query in u.phone.lower() or
                            query in u.company.lower() or
                            query in u.seat_number.lower()]
        else:
            filtered_users = users
        
        # Return only necessary info for checkin
        result = []
        for user in filtered_users:
            result.append({
                'id': user.id,
                'name': user.name,
                'phone': user.phone,
                'company': user.company,
                'department': user.department,
                'position': user.position,
                'gender': user.gender,
                'seat_number': user.seat_number
            })
        
        return jsonify({'users': result})
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Lỗi tìm kiếm users: {str(e)}'
            }
        }), 500
