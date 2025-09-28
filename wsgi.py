"""
WSGI entry point for production deployment
"""
import os
from app import create_app
from app.config import config

# Get environment
env = os.environ.get('FLASK_ENV', 'production')

# Create app
application = create_app(config.get(env, config['default']))

if __name__ == '__main__':
    application.run()
