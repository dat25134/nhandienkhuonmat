# 🎯 Face Recognition API

A professional Python backend API for face recognition using Flask, OpenCV, and face_recognition library.

## 🏗️ Project Structure

```
face_recognition_api/
├── app/                          # Main application package
│   ├── __init__.py              # Flask app factory
│   ├── config.py                # Configuration settings
│   ├── models/                  # Data models
│   │   ├── __init__.py
│   │   ├── user.py              # User model
│   │   └── checkin.py           # Checkin model
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── face_recognition.py  # Face recognition service
│   │   ├── user_service.py      # User management service
│   │   └── cache_service.py     # Cache management
│   ├── controllers/             # API controllers
│   │   ├── __init__.py
│   │   ├── user_controller.py   # User API endpoints
│   │   ├── recognition_controller.py  # Recognition API
│   │   └── checkin_controller.py     # Checkin API
│   ├── utils/                   # Utility functions
│   │   ├── __init__.py
│   │   ├── image_utils.py       # Image processing utilities
│   │   ├── validation.py        # Input validation
│   │   └── helpers.py            # General helpers
│   └── middleware/              # Middleware
│       ├── __init__.py
│       └── cors.py              # CORS handling
├── data/                        # Data storage
│   ├── db/                      # Database files
│   └── images/                  # Image storage
├── tests/                       # Test files
├── scripts/                     # Utility scripts
├── requirements/                # Dependencies by environment
│   ├── base.txt                # Base dependencies
│   ├── development.txt         # Dev dependencies
│   └── production.txt          # Production dependencies
├── config/                      # Configuration files
├── docs/                        # Documentation
├── run.py                      # Application entry point
└── wsgi.py                     # WSGI entry point for production
```

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd face_recognition_api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements/development.txt
```

### 2. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env file with your settings
nano .env
```

### 3. Run Application

```bash
# Development mode
python run.py

# Production mode
export FLASK_ENV=production
python run.py
```

### 4. Test API

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test face recognition
curl -X POST http://localhost:5000/api/recognize/multi \
  -H "Content-Type: application/json" \
  -d '{"images": ["base64_image_data"]}'
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_ENV` | Environment (development/production) | development |
| `SECRET_KEY` | Flask secret key | dev-secret-key |
| `FACE_RECOGNITION_TOLERANCE` | Face matching tolerance | 0.53 |
| `BLUR_MIN_ENROLL` | Minimum blur score for enrollment | 80.0 |
| `BLUR_MIN_QUERY` | Minimum blur score for query | 60.0 |

### Face Recognition Settings

- **Tolerance**: Lower values = stricter matching (0.4-0.6 recommended)
- **Blur Thresholds**: Higher values = stricter quality requirements
- **Top2 Gap**: Minimum difference between best and second-best matches

## 📚 API Documentation

### Core Endpoints

#### Face Recognition
- `POST /api/recognize/multi` - Recognize multiple faces
- `POST /api/detect-face` - Detect faces in image

#### User Management
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/{id}` - Get user by ID
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

#### Check-in System
- `POST /api/checkin/{user_id}` - Check-in user
- `GET /api/checkins` - List all check-ins
- `POST /api/checkins/clear` - Clear all check-ins

#### Cache Management
- `POST /api/cache/rebuild` - Rebuild face encoding cache

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_models.py
```

## 🚀 Production Deployment

### Using Gunicorn

```bash
# Install production dependencies
pip install -r requirements/production.txt

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:application
```

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements/ requirements/
RUN pip install -r requirements/production.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "wsgi:application"]
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /media/ {
        alias /path/to/face_recognition_api/data/images/;
        expires 30d;
    }
}
```

## 🔍 Development

### Code Quality

```bash
# Format code
black app/

# Sort imports
isort app/

# Lint code
flake8 app/

# Type checking
mypy app/
```

### Database Management

```bash
# Initialize database
python scripts/setup_database.py

# Backup data
python scripts/backup_data.py

# Restore data
python scripts/restore_data.py
```

## 📖 Best Practices

### 1. **Separation of Concerns**
- Models: Data structure and persistence
- Services: Business logic
- Controllers: API endpoints
- Utils: Helper functions

### 2. **Configuration Management**
- Environment-specific configs
- Centralized settings
- Environment variables

### 3. **Error Handling**
- Consistent error responses
- Proper HTTP status codes
- Logging and monitoring

### 4. **Testing**
- Unit tests for models and services
- Integration tests for API endpoints
- Test coverage reporting

### 5. **Security**
- Input validation
- CORS configuration
- Rate limiting (if needed)

## 🐛 Troubleshooting

### Common Issues

1. **Face Recognition Not Working**
   - Check image quality and lighting
   - Verify face is clearly visible
   - Ensure proper image format

2. **Performance Issues**
   - Rebuild face encoding cache
   - Check system resources
   - Optimize image preprocessing

3. **Database Issues**
   - Check file permissions
   - Verify JSON file integrity
   - Restore from backup if needed

### Debug Mode

```bash
# Enable debug logging
export FLASK_ENV=development
export FLASK_DEBUG=1
python run.py
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide
