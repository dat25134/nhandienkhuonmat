"""
User model for face recognition system
"""
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from app.config import Config


class User:
    """User model with JSON-based storage"""
    
    _users_lock = threading.Lock()
    _users_file = Config.DB_DIR / 'users.json'
    
    def __init__(self, user_id: int = None, name: str = '', phone: str = '', 
                 gender: str = '', company: str = '', department: str = '', 
                 position: str = '', seat_number: str = '', images: List[str] = None,
                 email: str = '', avatar: str = '', notes: str = ''):
        self.id = user_id
        self.name = name
        self.phone = phone
        self.gender = gender
        self.company = company
        self.department = department
        self.position = position
        self.seat_number = seat_number
        self.images = images or []
        self.email = email
        self.avatar = avatar
        self.notes = notes
        self.created_at = datetime.utcnow().isoformat() + 'Z'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'gender': self.gender,
            'company': self.company,
            'department': self.department,
            'position': self.position,
            'seat_number': self.seat_number,
            'images': self.images,
            'email': self.email,
            'avatar': self.avatar,
            'notes': self.notes,
            'created_at': self.created_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        """Create user from dictionary"""
        user = cls()
        user.id = data.get('id')
        user.name = data.get('name', '')
        user.phone = data.get('phone', '')
        user.gender = data.get('gender', '')
        user.company = data.get('company', '')
        user.department = data.get('department', '')
        user.position = data.get('position', '')
        user.seat_number = data.get('seat_number', '')
        user.images = data.get('images', [])
        user.email = data.get('email', '')
        user.avatar = data.get('avatar', '')
        user.notes = data.get('notes', '')
        user.created_at = data.get('created_at', '')
        return user
    
    @classmethod
    def _ensure_users_file(cls):
        """Ensure users.json file exists"""
        if not cls._users_file.exists():
            cls._users_file.parent.mkdir(parents=True, exist_ok=True)
            with cls._users_file.open('w', encoding='utf-8') as f:
                json.dump({"users": []}, f, ensure_ascii=False, indent=2)
        else:
            # Check if file is empty
            try:
                if cls._users_file.stat().st_size == 0:
                    with cls._users_file.open('w', encoding='utf-8') as f:
                        json.dump({"users": []}, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
    
    @classmethod
    def load_all(cls) -> List['User']:
        """Load all users from JSON file"""
        cls._ensure_users_file()
        try:
            text = cls._users_file.read_text(encoding='utf-8')
            if not text.strip():
                return []
            data = json.loads(text)
            users = data.get('users', [])
            return [cls.from_dict(user_data) for user_data in users]
        except json.JSONDecodeError:
            # Try to restore from backup
            backup_file = cls._users_file.with_suffix('.json.bak')
            try:
                if backup_file.exists():
                    text = backup_file.read_text(encoding='utf-8')
                    data = json.loads(text)
                    cls._users_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                    users = data.get('users', [])
                    return [cls.from_dict(user_data) for user_data in users]
            except Exception:
                pass
            # Return empty list if can't restore
            cls._users_file.write_text(json.dumps({"users": []}, ensure_ascii=False, indent=2), encoding='utf-8')
            return []
    
    @classmethod
    def save_all(cls, users: List['User']):
        """Save all users to JSON file"""
        cls._ensure_users_file()
        # Create backup
        backup_file = cls._users_file.with_suffix('.json.bak')
        if cls._users_file.exists():
            backup_file.write_text(cls._users_file.read_text(encoding='utf-8'), encoding='utf-8')
        
        # Save new data
        data = {"users": [user.to_dict() for user in users]}
        with cls._users_lock:
            with cls._users_file.open('w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def get_by_id(cls, user_id: int) -> Optional['User']:
        """Get user by ID"""
        users = cls.load_all()
        for user in users:
            if user.id == user_id:
                return user
        return None
    
    @classmethod
    def get_all(cls) -> List['User']:
        """Get all users (alias for load_all)"""
        return cls.load_all()
    
    @classmethod
    def get_next_id(cls) -> int:
        """Get next available user ID"""
        users = cls.load_all()
        if not users:
            return 1
        return max(user.id for user in users if user.id) + 1
    
    def save(self):
        """Save user to database"""
        users = self.load_all()
        
        if self.id is None:
            self.id = self.get_next_id()
        
        # Update existing user or add new one
        existing_user = None
        for i, user in enumerate(users):
            if user.id == self.id:
                existing_user = i
                break
        
        if existing_user is not None:
            users[existing_user] = self
        else:
            users.append(self)
        
        self.save_all(users)
    
    def delete(self):
        """Delete user from database"""
        users = self.load_all()
        users = [user for user in users if user.id != self.id]
        self.save_all(users)
    
    @classmethod
    def search(cls, query: str = '') -> List['User']:
        """Search users by name, phone, company, or seat_number"""
        users = cls.load_all()
        if not query:
            return users
        
        query_lower = query.lower()
        filtered_users = []
        for user in users:
            if (query_lower in (user.name or '').lower() or
                query_lower in (user.phone or '').lower() or
                query_lower in (user.company or '').lower() or
                query_lower in (user.seat_number or '').lower()):
                filtered_users.append(user)
        
        return filtered_users
