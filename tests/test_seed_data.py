"""
Test utilities to seed users.json and checkins.json for manual and automated testing.

Run with pytest to generate seed data files in data/db/.
Environment variables to control sizes (optional):
  SEED_USERS_COUNT: int (default 20)
  SEED_CHECKINS_COUNT: int (default 60)

This test will always pass; its purpose is to generate realistic data for the API.
"""

import os
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from app.config import Config


def _ensure_dirs():
    Config.DB_DIR.mkdir(parents=True, exist_ok=True)


def _unique_name(idx_zero_based: int) -> str:
    """Generate deterministic, non-suffixed Vietnamese full names.

    Uses a Cartesian product of (family_name x middle_name x given_name) to ensure a large set
    of unique combinations. If requested index exceeds the combination space, we append a suffix.
    """
    family_names = [
        "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
        "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"
    ]
    middle_names = [
        "Văn", "Thị", "Hữu", "Xuân", "Quốc", "Hải", "Minh", "Anh", "Gia", "Ngọc",
        "Thái", "Thanh", "Quang", "Tuấn", "Phương"
    ]
    given_names = [
        "An", "Bình", "Dũng", "Huy", "Trang", "Linh", "Giang", "Ngọc", "Phương", "Hạnh",
        "Hiếu", "Phong", "Thảo", "Lan", "Nam", "Sơn", "Khoa", "Hà", "Ly", "Mai"
    ]

    fam_len, mid_len, giv_len = len(family_names), len(middle_names), len(given_names)
    total = fam_len * mid_len * giv_len

    if idx_zero_based < total:
        fam_idx = idx_zero_based // (mid_len * giv_len)
        rem = idx_zero_based % (mid_len * giv_len)
        mid_idx = rem // giv_len
        giv_idx = rem % giv_len
        return f"{family_names[fam_idx]} {middle_names[mid_idx]} {given_names[giv_idx]}"
    # Fallback with suffix if out of range
    fam_idx = idx_zero_based % fam_len
    mid_idx = (idx_zero_based // fam_len) % mid_len
    giv_idx = (idx_zero_based // (fam_len * mid_len)) % giv_len
    suffix = idx_zero_based - total + 1
    return f"{family_names[fam_idx]} {middle_names[mid_idx]} {given_names[giv_idx]} {suffix}"


def _random_company(i: int) -> str:
    companies = [
        "Công ty ABC", "Tập đoàn XYZ", "Công ty TNHH DAT", "Startup 123", "Solutions JSC",
        "Tech Co.", "Innotech", "Viet Global", "Sao Mai", "Song Hành"
    ]
    return companies[i % len(companies)]


def _gen_users(n: int):
    users = []
    for i in range(1, n + 1):
        # Deterministic unique full name
        full_name = _unique_name(i - 1)
        # Deterministic phone to avoid collisions
        phone_number = f"09{(10_000_000 + i):08d}"[-10:]
        users.append({
            "id": i,
            "name": full_name,
            "phone": phone_number,
            "gender": random.choice(["Nam", "Nữ", ""]),
            "company": _random_company(i),
            "department": random.choice(["Kinh doanh", "Kỹ thuật", "Marketing", "Hành chính", ""]),
            "position": random.choice(["Nhân viên", "Trưởng phòng", "Giám đốc", "Phó phòng", "Chuyên viên"]),
            "seat_number": str(random.randint(1, 500)),
            "email": f"user{i}@example.com",
            "avatar": "",
            "notes": ""
        })
    return users


def _gen_checkins(m: int, users):
    checkins = []
    now = datetime.utcnow()
    for k in range(1, m + 1):
        user = random.choice(users)
        delta_minutes = random.randint(0, 60 * 24 * 7)  # within last 7 days
        checked_at = (now - timedelta(minutes=delta_minutes)).isoformat() + 'Z'
        method = random.choice(["face_recognition", "manual"])  # manual will map to status manual
        # Confidence only for face_recognition
        confidence = None if method == "manual" else round(random.uniform(0.5, 0.99), 6)
        checkins.append({
            "id": k,
            "user_id": user["id"],
            "name": user["name"],
            "phone": user["phone"],
            "gender": user["gender"],
            "company": user["company"],
            "department": user["department"],
            "position": user["position"],
            "seat_number": user["seat_number"],
            "email": user["email"],
            "avatar": user["avatar"],
            "notes": user["notes"],
            "checked_at": checked_at,
            "method": method,
            "confidence": confidence,
            "distance": None if confidence is None else round(1.0 - confidence, 6)
        })
    return checkins


def test_seed_users_and_checkins():
    """Seed users.json and checkins.json with configurable counts.

    This test intentionally always passes; it generates data fixtures for development/testing.
    """
    _ensure_dirs()

    users_count = int(os.environ.get("SEED_USERS_COUNT", "20"))
    checkins_count = int(os.environ.get("SEED_CHECKINS_COUNT", "60"))

    users = _gen_users(users_count)
    checkins = _gen_checkins(checkins_count, users)

    users_path = Config.DB_DIR / 'users.json'
    checkins_path = Config.DB_DIR / 'checkins.json'

    users_payload = {"users": users}
    checkins_payload = {"checkins": checkins}

    with users_path.open('w', encoding='utf-8') as f:
        json.dump(users_payload, f, ensure_ascii=False, indent=2)

    with checkins_path.open('w', encoding='utf-8') as f:
        json.dump(checkins_payload, f, ensure_ascii=False, indent=2)

    # Assert files exist and structure is as expected
    assert users_path.exists()
    assert checkins_path.exists()

    # Minimal schema checks
    with users_path.open('r', encoding='utf-8') as f:
        data = json.load(f)
        assert isinstance(data, dict) and 'users' in data and isinstance(data['users'], list)

    with checkins_path.open('r', encoding='utf-8') as f:
        data = json.load(f)
        assert isinstance(data, dict) and 'checkins' in data and isinstance(data['checkins'], list)

    # Always pass
    assert True


