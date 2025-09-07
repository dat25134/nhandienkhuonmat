import argparse
import json
import os
import random
import shutil
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

try:
    from sklearn.datasets import fetch_lfw_people
except Exception:
    fetch_lfw_people = None


BASE_DIR = Path(__file__).resolve().parent.parent
USERS_JSON = BASE_DIR / "data/db/users.json"
IMAGES_DIR = BASE_DIR / "data/images"


def load_users_json() -> dict:
    USERS_JSON.parent.mkdir(parents=True, exist_ok=True)
    if not USERS_JSON.exists() or USERS_JSON.stat().st_size == 0:
        USERS_JSON.write_text(json.dumps({"users": []}, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        return json.loads(USERS_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # reset if corrupt
        data = {"users": []}
        USERS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return data


def save_users_json(data: dict) -> None:
    backup = USERS_JSON.with_suffix(".json.bak")
    if USERS_JSON.exists():
        backup.write_text(USERS_JSON.read_text(encoding="utf-8"), encoding="utf-8")
    USERS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def next_user_id(users: list) -> int:
    if not users:
        return 1
    return int(max(u.get("id", 0) for u in users) + 1)


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def timestamp_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")


def augment_image(pil_img: Image.Image) -> Image.Image:
    # Random brightness/contrast, slight rotation, blur
    img = pil_img.copy()
    # brightness
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.85, 1.15))
    # contrast
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.9, 1.1))
    # rotate small
    angle = random.uniform(-5, 5)
    img = img.rotate(angle, expand=True, fillcolor=(0, 0, 0))
    # resize to reasonable max
    max_side = max(img.width, img.height)
    if max_side > 1024:
        scale = 1024 / max_side
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    # optional slight blur
    if random.random() < 0.3:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.2, 0.6)))
    return img


def _measure_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    try:
        # Pillow ≥8: use textbbox for accurate sizing
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    except Exception:
        try:
            # Fallback to font.getsize if available
            return font.getsize(text)
        except Exception:
            # Safe default
            return (len(text) * 20, 32)


def create_placeholder_portrait(name: str, size: int = 512) -> Image.Image:
    # Create a simple placeholder portrait (NOTE: not a real face)
    bg_color = tuple(np.random.randint(30, 200, size=3).tolist())
    img = Image.new("RGB", (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    initials = "".join([p[0].upper() for p in name.split() if p][:2]) or "U"
    # Draw circle avatar
    r = int(size * 0.42)
    center = (size // 2, int(size * 0.40))
    draw.ellipse([
        center[0] - r, center[1] - r,
        center[0] + r, center[1] + r
    ], fill=(235, 235, 235))
    # Draw initials
    try:
        font = ImageFont.truetype("arial.ttf", int(size * 0.22))
    except Exception:
        font = ImageFont.load_default()
    tw, th = _measure_text(draw, initials, font)
    draw.text((center[0] - tw // 2, center[1] - th // 2), initials, fill=(40, 40, 40), font=font)
    # Shoulder rectangle
    draw.rectangle([0, int(size * 0.65), size, size], fill=(220, 220, 220))
    return img


# -------------------- Synthetic profile fields --------------------
FIRST_NAMES_MALE = ["Anh", "Bảo", "Cường", "Duy", "Hùng", "Khang", "Long", "Minh", "Nam", "Quang"]
FIRST_NAMES_FEMALE = ["Anh", "Bích", "Chi", "Dung", "Hạnh", "Lan", "Linh", "Mai", "Ngọc", "Thảo"]
LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh", "Hoàng", "Phan", "Vũ", "Võ", "Đặng"]
COMPANIES = ["Cty Du lịch Biển Xanh", "TravelPlus", "SunSea Group", "VietTrade", "ExpoAsia", "Urban Tour", "Delta Commerce"]
DEPARTMENTS = ["Kinh doanh", "Marketing", "Vận hành", "Nhân sự", "Tài chính", "CNTT"]
POSITIONS = ["Nhân viên", "Chuyên viên", "Trưởng phòng", "Phó phòng", "Giám đốc", "Phó giám đốc"]


def random_gender() -> str:
    return random.choice(["Nam", "Nữ", "Khác"]) if random.random() < 0.9 else "Khác"


def random_phone() -> str:
    prefix = random.choice(["03", "05", "07", "08", "09"])  # VN mobile prefixes
    rest = ''.join(str(random.randint(0, 9)) for _ in range(8))
    return prefix + rest


def random_company() -> str:
    return random.choice(COMPANIES)


def random_department() -> str:
    return random.choice(DEPARTMENTS)


def random_position() -> str:
    return random.choice(POSITIONS)


def collect_source_images(src_dir: Path) -> list[Path]:
    if not src_dir or not src_dir.exists():
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    files = [p for p in src_dir.rglob("*") if p.suffix.lower() in exts]
    return files


def collect_lfw_images(limit: int = 1000) -> list[Image.Image]:
    images = []
    if fetch_lfw_people is None:
        return images
    try:
        lfw = fetch_lfw_people(color=True, resize=1.0, funneled=False, download_if_missing=True)
        X = lfw.images  # shape (n_samples, h, w, 3), dtype float
        for i in range(min(len(X), limit)):
            arr = X[i]
            # Normalize if in [0,1]
            if arr.max() <= 1.0:
                arr = (arr * 255.0).clip(0, 255)
            arr = arr.astype(np.uint8)
            img = Image.fromarray(arr, mode="RGB")
            images.append(img)
    except Exception as e:
        print("Lỗi tải LFW:", e)
    return images


def save_image_for_user(user_id: int, pil_img: Image.Image) -> str:
    now = datetime.now(timezone.utc)
    subdir = now.strftime("%Y/%m")
    out_dir = IMAGES_DIR / str(user_id) / subdir
    ensure_dir(out_dir)
    ts = timestamp_str()
    out_path = out_dir / f"{ts}_generated.jpg"
    pil_img.save(out_path, format="JPEG", quality=90)
    return str(out_path.relative_to(BASE_DIR))


def main():
    parser = argparse.ArgumentParser(description="Generate test users and images for face recognition app")
    parser.add_argument("--num_users", type=int, default=100, help="Number of users to create")
    parser.add_argument("--min_images", type=int, default=3, help="Min images per user")
    parser.add_argument("--max_images", type=int, default=5, help="Max images per user")
    parser.add_argument("--src_dir", type=str, default="", help="Optional source dir of real face images to copy/augment")
    parser.add_argument("--use_lfw", action="store_true", help="Download and use LFW real face dataset for generation")
    args = parser.parse_args()

    if args.min_images < 1 or args.max_images < args.min_images:
        raise SystemExit("Invalid min/max images configuration")

    data = load_users_json()
    users = data.get("users", [])
    next_id = next_user_id(users)

    src_paths = collect_source_images(Path(args.src_dir)) if args.src_dir else []
    lfw_images = []
    if args.use_lfw:
        # Thử tải LFW; nếu lỗi, tiếp tục với placeholder
        try:
            lfw_images = collect_lfw_images(limit=args.num_users * args.max_images)
        except Exception as e:
            print("Lỗi tải LFW:", e)
            lfw_images = []

    created = 0
    for i in range(args.num_users):
        user_id = next_id + i
        g = random_gender()
        if g == "Nam":
            fname = random.choice(FIRST_NAMES_MALE)
        elif g == "Nữ":
            fname = random.choice(FIRST_NAMES_FEMALE)
        else:
            fname = random.choice(FIRST_NAMES_MALE + FIRST_NAMES_FEMALE)
        lname = random.choice(LAST_NAMES)
        name = f"{lname} {fname}"
        num_images = random.randint(args.min_images, args.max_images)
        image_paths = []

        for j in range(num_images):
            if src_paths:
                src = src_paths[(i * num_images + j) % len(src_paths)]
                try:
                    img = Image.open(src).convert("RGB")
                except Exception:
                    img = create_placeholder_portrait(name)
            elif lfw_images:
                img = lfw_images[(i * num_images + j) % len(lfw_images)].copy()
            else:
                img = create_placeholder_portrait(name)

            img = augment_image(img)
            rel_path = save_image_for_user(user_id, img)
            image_paths.append(rel_path)

        users.append({
            "id": user_id,
            "name": name,
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "images": image_paths,
            "phone": random_phone(),
            "gender": g,
            "company": random_company(),
            "department": random_department(),
            "position": random_position(),
        })
        created += 1

    data["users"] = users
    save_users_json(data)
    print(f"Created {created} users. Total users: {len(users)}")


if __name__ == "__main__":
    main()


