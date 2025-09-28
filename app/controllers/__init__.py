"""
Controllers for the Face Recognition API
"""
from flask import Blueprint

def register_blueprints(app):
    """Register all blueprints with the Flask app"""
    # Import and register blueprints
    from app.controllers.health_controller import health_bp
    from app.controllers.recognition_controller import recognition_bp
    from app.controllers.training_controller import training_bp
    from app.controllers.checkin_controller import checkin_bp
    
    app.register_blueprint(health_bp)
    app.register_blueprint(recognition_bp)
    app.register_blueprint(training_bp)
    app.register_blueprint(checkin_bp)
