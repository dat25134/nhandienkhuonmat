"""
Health check controller
"""
import os
from flask import Blueprint, jsonify, send_from_directory, abort, send_file

health_bp = Blueprint('health', __name__)

@health_bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Face Recognition API is running',
        'version': '1.0.0'
    })

@health_bp.route('/api/media/<path:relpath>')
def serve_media(relpath):
    """Serve media files (images and avatars)"""
    try:
        # Check if it's an avatar request
        if relpath.startswith('avatar/'):
            # Serve avatar files - use absolute path from project root
            avatar_path = os.path.join(os.getcwd(), 'data', relpath)
            if os.path.exists(avatar_path) and os.path.isfile(avatar_path):
                return send_file(avatar_path)
        elif relpath.startswith('images/'):
            # Serve image files - use absolute path from project root
            image_path = os.path.join(os.getcwd(), 'data', relpath)
            if os.path.exists(image_path) and os.path.isfile(image_path):
                return send_file(image_path)
        
        abort(404)
    except Exception as e:
        print(f"Error serving media: {e}")
        abort(404)
