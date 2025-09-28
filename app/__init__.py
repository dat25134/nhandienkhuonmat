"""
Face Recognition API Application Factory
"""
from flask import Flask
from flask_cors import CORS
from app.config import Config


def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize CORS with specific origins
    CORS(app, origins=[
        'http://localhost:3000',  # React development server
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        # Add production URLs here when needed
    ])
    
    # Register blueprints
    from app.controllers import register_blueprints
    register_blueprints(app)
    
    # Initialize cache on startup if needed
    if app.config.get('CACHE_REBUILD_ON_STARTUP', True):
        from app.services.cache_service import CacheService
        cache_service = CacheService()
        cache_service.build_cache()
        print("✅ Face encoding cache built on startup")
    
    return app
