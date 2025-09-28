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
                 checked_at: str = None, method: str = 'face_recognition'):
        self.id = checkin_id
        self.user_id = user_id
        self.name = name
        self.phone = phone
        self.gender = gender
        self.company = company
        self.department = department
        self.position = position
        self.seat_number = seat_number
        self.checked_at = checked_at or datetime.utcnow().isoformat() + 'Z'
        self.method = method
    
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
            'checked_at': self.checked_at,
            'method': self.method
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Checkin':
        """Create checkin from dictionary"""
        checkin = cls()
        checkin.id = data.get('id')
        checkin.user_id = data.get('user_id')
        checkin.name = data.get('name', '')
        checkin.phone = data.get('phone', '')
        checkin.gender = data.get('gender', '')
        checkin.company = data.get('company', '')
        checkin.department = data.get('department', '')
        checkin.position = data.get('position', '')
        checkin.seat_number = data.get('seat_number', '')
        checkin.checked_at = data.get('checked_at', '')
        checkin.method = data.get('method', 'face_recognition')
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
    def get_next_id(cls) -> int:
        """Get next available checkin ID"""
        checkins = cls.load_all()
        if not checkins:
            return 1
        return max(checkin.id for checkin in checkins if checkin.id) + 1
    
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
