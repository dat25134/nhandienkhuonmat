"""
Checkin model for face recognition system
"""
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from app.config import Config


class Checkin:
    """Checkin model with JSON-based storage"""
    
    _checkins_lock = threading.Lock()
    _checkins_file = Config.DB_DIR / 'checkins.json'
    
    def __init__(self, checkin_id: int = None, user_id: int = None, name: str = '', 
                 phone: str = '', gender: str = '', company: str = '', 
                 department: str = '', position: str = '', seat_number: str = '',
                 email: str = '', avatar: str = '', notes: str = '',
                 checked_at: str = None, method: str = 'face_recognition',
                 confidence: float = None, distance: float = None):
        self.id = checkin_id
        self.user_id = user_id
        self.name = name
        self.phone = phone
        self.gender = gender
        self.company = company
        self.department = department
        self.position = position
        self.seat_number = seat_number
        self.email = email
        self.avatar = avatar
        self.notes = notes
        self.checked_at = checked_at or datetime.utcnow().isoformat() + 'Z'
        self.method = method
        self.confidence = confidence
        self.distance = distance
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert checkin to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'phone': self.phone,
            'gender': self.gender,
            'company': self.company,
            'department': self.department,
            'position': self.position,
            'seat_number': self.seat_number,
            'email': self.email,
            'avatar': self.avatar,
            'notes': self.notes,
            'checked_at': self.checked_at,
            'method': self.method,
            'confidence': self.confidence,
            'distance': self.distance
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Checkin':
        """Create checkin from dictionary"""
        checkin = cls()
        # Handle None ID - assign new ID if None
        checkin_id = data.get('id')
        if checkin_id is None:
            checkin.id = None  # Will be assigned in save()
        else:
            checkin.id = checkin_id
        checkin.user_id = data.get('user_id')
        checkin.name = data.get('name', '')
        checkin.phone = data.get('phone', '')
        checkin.gender = data.get('gender', '')
        checkin.company = data.get('company', '')
        checkin.department = data.get('department', '')
        checkin.position = data.get('position', '')
        checkin.seat_number = data.get('seat_number', '')
        checkin.email = data.get('email', '')
        checkin.avatar = data.get('avatar', '')
        checkin.notes = data.get('notes', '')
        checkin.checked_at = data.get('checked_at', '')
        checkin.method = data.get('method', 'face_recognition')
        checkin.confidence = data.get('confidence')
        checkin.distance = data.get('distance')
        return checkin
    
    @classmethod
    def _ensure_checkins_file(cls):
        """Ensure checkins.json file exists"""
        if not cls._checkins_file.exists() or cls._checkins_file.stat().st_size == 0:
            cls._checkins_file.parent.mkdir(parents=True, exist_ok=True)
            with cls._checkins_file.open('w', encoding='utf-8') as f:
                json.dump({"checkins": []}, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def load_all(cls) -> List['Checkin']:
        """Load all checkins from JSON file"""
        cls._ensure_checkins_file()
        try:
            text = cls._checkins_file.read_text(encoding='utf-8')
            if not text.strip():
                return []
            data = json.loads(text)
            checkins = data.get('checkins', [])
            return [cls.from_dict(checkin_data) for checkin_data in checkins]
        except json.JSONDecodeError:
            # Try to restore from backup
            backup_file = cls._checkins_file.with_suffix('.json.bak')
            try:
                if backup_file.exists():
                    text = backup_file.read_text(encoding='utf-8')
                    data = json.loads(text)
                    cls._checkins_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                    checkins = data.get('checkins', [])
                    return [cls.from_dict(checkin_data) for checkin_data in checkins]
            except Exception:
                pass
            # Return empty list if can't restore
            cls._checkins_file.write_text(json.dumps({"checkins": []}, ensure_ascii=False, indent=2), encoding='utf-8')
            return []
    
    @classmethod
    def save_all(cls, checkins: List['Checkin']):
        """Save all checkins to JSON file"""
        cls._ensure_checkins_file()
        # Create backup
        backup_file = cls._checkins_file.with_suffix('.json.bak')
        if cls._checkins_file.exists():
            backup_file.write_text(cls._checkins_file.read_text(encoding='utf-8'), encoding='utf-8')
        
        # Save new data
        data = {"checkins": [checkin.to_dict() for checkin in checkins]}
        with cls._checkins_lock:
            with cls._checkins_file.open('w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def get_by_user_id(cls, user_id: int) -> Optional['Checkin']:
        """Get latest checkin by user ID"""
        checkins = cls.load_all()
        user_checkins = [c for c in checkins if c.user_id == user_id]
        if user_checkins:
            # Sort by checked_at and return latest
            user_checkins.sort(key=lambda x: x.checked_at, reverse=True)
            return user_checkins[0]
        return None
    
    @classmethod
    def get_today_checkin(cls, user_id: int) -> Optional['Checkin']:
        """Get today's checkin for user"""
        from datetime import datetime
        # Use UTC time to match the stored timestamps
        today = datetime.utcnow().strftime('%Y-%m-%d')
        
        checkins = cls.load_all()
        for checkin in checkins:
            if checkin.user_id == user_id and checkin.checked_at:
                checkin_date = checkin.checked_at.split('T')[0]
                if checkin_date == today:
                    return checkin
        return None
    
    @classmethod
    def get_next_id(cls) -> int:
        """Get next available checkin ID"""
        checkins = cls.load_all()
        if not checkins:
            return 1
        # Filter out None IDs and get max
        valid_ids = [checkin.id for checkin in checkins if checkin.id is not None]
        if not valid_ids:
            return 1
        return max(valid_ids) + 1
    
    def save(self):
        """Save checkin to database"""
        checkins = self.load_all()
        
        if self.id is None:
            self.id = self.get_next_id()
        
        # Update existing checkin or add new one
        existing_checkin = None
        for i, checkin in enumerate(checkins):
            if checkin.id == self.id:
                existing_checkin = i
                break
        
        if existing_checkin is not None:
            checkins[existing_checkin] = self
        else:
            checkins.append(self)
        
        self.save_all(checkins)
    
    @classmethod
    def clear_all(cls):
        """Clear all checkins"""
        cls.save_all([])
    
    @classmethod
    def fix_null_ids(cls):
        """Fix checkins with null IDs"""
        checkins = cls.load_all()
        fixed = False
        
        for checkin in checkins:
            if checkin.id is None:
                checkin.id = cls.get_next_id()
                fixed = True
        
        if fixed:
            cls.save_all(checkins)
