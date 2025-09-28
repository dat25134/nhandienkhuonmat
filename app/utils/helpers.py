"""
Helper functions for the Face Recognition API
"""
import re


def sanitize_text(value: str, max_len: int = 150) -> str:
    """Sanitize text input"""
    try:
        value = (value or '').strip()
        if len(value) > max_len:
            value = value[:max_len]
        return value
    except Exception:
        return ''


def normalize_phone(phone: str) -> str:
    """Normalize phone number"""
    try:
        digits = ''.join([c for c in (phone or '') if c.isdigit()])
        if len(digits) > 15:
            digits = digits[:15]
        return digits
    except Exception:
        return ''


def build_greeting(name: str, gender: str = None) -> str:
    """Build greeting message based on name and gender"""
    try:
        g = (gender or '').strip().lower()
        if g == 'nam':
            title = 'Ông'
        elif g == 'nữ' or g == 'nu':
            title = 'Bà'
        else:
            title = 'Quý khách'
        
        return f'Chào mừng {title} {name} đã đến với hệ thống của chúng tôi'
    except Exception:
        return f'Chào mừng {name} đã đến với hệ thống của chúng tôi'


def validate_email(email: str) -> bool:
    """Validate email format"""
    try:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    except Exception:
        return False


def format_phone_display(phone: str) -> str:
    """Format phone number for display"""
    try:
        digits = normalize_phone(phone)
        if len(digits) >= 10:
            # Format as Vietnamese phone: 0xxx xxx xxx
            return f"{digits[:4]} {digits[4:7]} {digits[7:]}"
        return phone
    except Exception:
        return phone
