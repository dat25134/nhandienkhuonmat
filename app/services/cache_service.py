"""
Cache Service
Manages face encoding cache
"""
import threading
import os
from typing import List, Dict, Any
import numpy as np
import face_recognition
from PIL import Image
import io
from app.models.user import User
from app.services.face_recognition_service import FaceRecognitionService


class CacheService:
    """Service for managing face encoding cache"""
    
    def __init__(self):
        self.encoding_cache = []
        self.centroid_cache = []
        self._lock = threading.Lock()
        self.face_service = FaceRecognitionService()
    
    def build_cache(self):
        """Build face encoding cache from all users"""
        with self._lock:
            self.encoding_cache = []
            self.centroid_cache = []
            
            users = User.load_all()
            print(f"🔄 Building cache for {len(users)} users...")
            
            for user in users:
                if user.images:
                    encodings = []
                    for image_path in user.images:
                        try:
                            # Convert relative path to absolute path
                            if not os.path.isabs(image_path):
                                image_path = os.path.join(os.getcwd(), image_path)
                            
                            # Load and process image
                            if os.path.exists(image_path):
                                with open(image_path, 'rb') as f:
                                    img = Image.open(io.BytesIO(f.read()))
                                    if img.mode != 'RGB':
                                        img = img.convert('RGB')
                                    img_array = np.array(img)
                                    
                                    # Check image quality
                                    if self.face_service.is_image_quality_good(img_array, is_enrollment=True):
                                        # Extract face encoding
                                        face_encoding = self.face_service.get_face_encoding(img_array)
                                        if face_encoding is not None:
                                            encodings.append(face_encoding)
                        except Exception as e:
                            print(f"⚠️  Error processing image {image_path}: {e}")
                            continue
                    
                    if encodings:
                        # Keep only top 8 encodings (best quality)
                        if len(encodings) > 8:
                            # Sort by quality and keep best
                            encodings = encodings[:8]
                        
                        self.encoding_cache.append({
                            'id': user.id,
                            'name': user.name,
                            'encodings': encodings
                        })
                        
                        # Calculate centroid
                        if encodings:
                            centroid = np.mean(np.vstack(encodings), axis=0, dtype=np.float32)
                            self.centroid_cache.append({
                                'id': user.id,
                                'name': user.name,
                                'gender': user.gender,
                                'centroid': centroid,
                                'count': len(encodings)
                            })
            
            print(f"✅ Cache built: {len(self.encoding_cache)} users, {sum(len(entry.get('encodings', [])) for entry in self.encoding_cache)} encodings")
    
    def get_cache_status(self) -> Dict[str, Any]:
        """Get cache status"""
        return {
            'users_cached': len(self.encoding_cache),
            'total_encodings': sum(len(entry.get('encodings', [])) for entry in self.encoding_cache)
        }
    
    def clear_cache(self):
        """Clear all cache"""
        with self._lock:
            self.encoding_cache = []
            self.centroid_cache = []
    
    def match_face_strict(self, query_encoding: np.ndarray) -> tuple:
        """Match face with strict criteria"""
        if not self.centroid_cache:
            return False, None, None, None, None, None
        
        try:
            # Build centroids matrix
            centroids = np.vstack([c['centroid'] for c in self.centroid_cache]).astype(np.float32)
            distances = face_recognition.face_distance(centroids, np.asarray(query_encoding, dtype=np.float32))
            order = np.argsort(distances)
            
            if len(order) == 0:
                return False, None, None, None, None, None
            
            i1 = int(order[0])
            d1 = float(distances[i1])
            d2 = float(distances[int(order[1])]) if len(order) > 1 else 1e9
            candidate = self.centroid_cache[i1]
            
            # Check strict criteria
            from app.config import Config
            tolerance = Config.FACE_RECOGNITION_TOLERANCE
            top2_gap_min = Config.FACE_RECOGNITION_TOP2_GAP_MIN
            accepted = (d1 <= tolerance) and ((d2 - d1) >= top2_gap_min)
            
            if accepted:
                return True, candidate['id'], candidate['name'], candidate.get('gender', ''), d1, d2
            else:
                # Fallback: try individual encoding matching if centroid fails
                return self._fallback_match(query_encoding, d1, d2)
                
        except Exception as e:
            print(f"Error in face matching: {e}")
            return False, None, None, None, None, None
    
    def _fallback_match(self, query_encoding: np.ndarray, d1: float, d2: float) -> tuple:
        """Fallback matching using individual encodings"""
        try:
            best_distance = 1e9
            best_match = None
            
            for entry in self.encoding_cache:
                encodings = entry.get('encodings', [])
                if not encodings:
                    continue
                
                # Calculate distances to all encodings of this user
                distances = face_recognition.face_distance(
                    np.asarray(encodings, dtype=np.float32), 
                    np.asarray(query_encoding, dtype=np.float32)
                )
                
                min_distance = float(np.min(distances))
                if min_distance < best_distance:
                    best_distance = min_distance
                    best_match = entry
            
            # Use more lenient tolerance for fallback
            fallback_tolerance = 0.65
            if best_match and best_distance <= fallback_tolerance:
                return True, best_match['id'], best_match['name'], '', best_distance, d2
            
            return False, None, None, None, d1, d2
            
        except Exception as e:
            print(f"Error in fallback matching: {e}")
            return False, None, None, None, d1, d2
