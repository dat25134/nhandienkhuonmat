"""
Configuration settings for the Face Recognition API
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directory
BASE_DIR = Path(__file__).parent.parent

class Config:
    """Base configuration"""
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    TESTING = False
    
    # Database settings
    DATA_DIR = BASE_DIR / 'data'
    DB_DIR = DATA_DIR / 'db'
    IMAGES_DIR = DATA_DIR / 'images'
    
    # Face recognition settings
    FACE_RECOGNITION_TOLERANCE = float(os.environ.get('FACE_RECOGNITION_TOLERANCE', '0.6'))
    FACE_RECOGNITION_TOP2_GAP_MIN = float(os.environ.get('FACE_RECOGNITION_TOP2_GAP_MIN', '0.05'))
    BLUR_MIN_ENROLL = float(os.environ.get('BLUR_MIN_ENROLL', '10.0'))
    BLUR_MIN_QUERY = float(os.environ.get('BLUR_MIN_QUERY', '60.0'))
    
    # Cache settings
    CACHE_REBUILD_ON_STARTUP = os.environ.get('CACHE_REBUILD_ON_STARTUP', 'True').lower() == 'true'
    
    # File upload settings
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', str(16 * 1024 * 1024)))  # 16MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    
    @staticmethod
    def init_app(app):
        """Initialize application with config"""
        # Ensure directories exist
        Config.DB_DIR.mkdir(parents=True, exist_ok=True)
        Config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    CACHE_REBUILD_ON_STARTUP = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    CACHE_REBUILD_ON_STARTUP = False


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
