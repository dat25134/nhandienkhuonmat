"""
User Service
Business logic for user management
"""
from typing import List, Optional, Dict, Any
from app.models.user import User


class UserService:
    """Service for user management operations"""
    
    def __init__(self):
        pass
    
    def get_all_users(self) -> List[User]:
        """Get all users"""
        return User.load_all()
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return User.get_by_id(user_id)
    
    def create_user(self, user_data: Dict[str, Any]) -> User:
        """Create new user"""
        user = User(
            name=user_data.get('name', ''),
            phone=user_data.get('phone', ''),
            gender=user_data.get('gender', ''),
            company=user_data.get('company', ''),
            department=user_data.get('department', ''),
            position=user_data.get('position', ''),
            seat_number=user_data.get('seat_number', ''),
            images=user_data.get('images', [])
        )
        user.save()
        return user
    
    def update_user(self, user_id: int, user_data: Dict[str, Any]) -> Optional[User]:
        """Update user"""
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        # Update fields
        for key, value in user_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        user.save()
        return user
    
    def delete_user(self, user_id: int) -> bool:
        """Delete user"""
        user = self.get_user_by_id(user_id)
        if not user:
            return False
        
        user.delete()
        return True
    
    def search_users(self, query: str = '') -> List[User]:
        """Search users"""
        return User.search(query)
