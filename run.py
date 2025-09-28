#!/usr/bin/env python3
"""
Application entry point for Face Recognition API
"""
import os
from app import create_app
from app.config import config

# Get environment
env = os.environ.get('FLASK_ENV', 'development')

# Create app
app = create_app(config.get(env, config['default']))

if __name__ == '__main__':
    print(f"🚀 Starting Face Recognition API in {env} mode...")
    print(f"📡 Server will be available at: http://0.0.0.0:5000")
    print(f"🔧 Debug mode: {app.config.get('DEBUG', False)}")
    print(f"🎯 Face recognition tolerance: {app.config.get('FACE_RECOGNITION_TOLERANCE', 0.53)}")
    print(f"📸 Blur threshold (enroll): {app.config.get('BLUR_MIN_ENROLL', 80.0)}")
    print(f"📸 Blur threshold (query): {app.config.get('BLUR_MIN_QUERY', 60.0)}")
    print(f"🔄 Cache rebuild on startup: {app.config.get('CACHE_REBUILD_ON_STARTUP', True)}")
    
    app.run(
        debug=app.config.get('DEBUG', False),
        host='0.0.0.0',
        port=5000
    )
