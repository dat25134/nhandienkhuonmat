"""
Controllers for the Face Recognition API
"""
from flask import Blueprint

def register_blueprints(app):
    """Register all blueprints with the Flask app"""
    # Import and register blueprints
    from app.controllers.health_controller import health_bp
    from app.controllers.recognition_controller import recognition_bp
    
    app.register_blueprint(health_bp)
    app.register_blueprint(recognition_bp)
