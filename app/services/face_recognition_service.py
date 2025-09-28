"""
Face Recognition Service
Handles all face recognition operations
"""
import numpy as np
import cv2
import face_recognition
from PIL import Image
import io
import base64
from typing import List, Tuple, Optional, Dict, Any
from app.config import Config


class FaceRecognitionService:
    """Service for face recognition operations"""
    
    def __init__(self):
        self.tolerance = Config.FACE_RECOGNITION_TOLERANCE
        self.top2_gap_min = Config.FACE_RECOGNITION_TOP2_GAP_MIN
        self.blur_min_enroll = Config.BLUR_MIN_ENROLL
        self.blur_min_query = Config.BLUR_MIN_QUERY
    
    def decode_image(self, image_data: str) -> Optional[np.ndarray]:
        """Decode base64 image to numpy array"""
        try:
            # Remove data URL header if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            return np.array(image)
        except Exception as e:
            return None
    
    def preprocess_image(self, image_array: np.ndarray, force_enhance: bool = False) -> np.ndarray:
        """Preprocess image for better face recognition - only enhance when needed"""
        try:
            h, w = image_array.shape[:2]
            max_side = max(h, w)
            target = 640
            if max_side > target:
                scale = target / float(max_side)
                new_w = int(w * scale)
                new_h = int(h * scale)
                image_array = cv2.resize(image_array, (new_w, new_h), interpolation=cv2.INTER_AREA)
            
            # Only enhance if blur score is low or forced
            if force_enhance:
                blur_score = self.compute_blur_score(image_array)
                if blur_score < 80.0:  # Only enhance if below threshold
                    # Light contrast enhancement to increase blur score
                    lab = cv2.cvtColor(image_array, cv2.COLOR_RGB2LAB)
                    l, a, b = cv2.split(lab)
                    clahe = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(16,16))
                    l = clahe.apply(l)
                    lab = cv2.merge([l, a, b])
                    image_array = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
            
            return image_array
        except Exception as e:
            return image_array
    
    def compute_blur_score(self, image_array: np.ndarray) -> float:
        """Compute blur score for image quality assessment"""
        try:
            gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
            return float(cv2.Laplacian(gray, cv2.CV_64F).var())
        except Exception:
            return 0.0
    
    def get_face_encoding(self, image_array: np.ndarray) -> Optional[np.ndarray]:
        """Extract face encoding from image (restored from app.py)"""
        try:
            # Preprocess image
            image_array = self.preprocess_image(image_array)
            
            # Find face locations (upsample to increase detection capability)
            face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=1)
            
            if not face_locations:
                # Fallback with more upsampling if not found
                face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=2)
                if not face_locations:
                    return None
            
            # Get encoding of the first face
            face_encodings = face_recognition.face_encodings(image_array, face_locations)
            
            if face_encodings:
                return face_encodings[0]
            
            return None
        except Exception as e:
            return None
    
    
    def find_face_locations(self, image_array: np.ndarray) -> List[Tuple]:
        """Find all face locations in image"""
        try:
            # Preprocess image
            image_array = self.preprocess_image(image_array)
            
            # Find face locations
            face_locations = face_recognition.face_locations(
                image_array, number_of_times_to_upsample=1
            )
            
            if not face_locations:
                # Try with more upsampling
                face_locations = face_recognition.face_locations(
                    image_array, number_of_times_to_upsample=2
                )
            
            return face_locations
        except Exception as e:
            return []
    
    def get_all_face_encodings(self, image_array: np.ndarray) -> List[np.ndarray]:
        """Get all face encodings from image"""
        try:
            # Preprocess image
            image_array = self.preprocess_image(image_array)
            
            # Find face locations
            face_locations = self.find_face_locations(image_array)
            if not face_locations:
                return []
            
            # Get face encodings
            face_encodings = face_recognition.face_encodings(image_array, face_locations)
            return face_encodings
        except Exception as e:
            return []
    
    def is_image_quality_good(self, image_array: np.ndarray, is_enrollment: bool = False) -> bool:
        """Check if image quality is good enough"""
        blur_score = self.compute_blur_score(image_array)
        min_blur = self.blur_min_enroll if is_enrollment else self.blur_min_query
        return blur_score >= min_blur
    
    def match_face_strict(self, query_encoding: np.ndarray, 
                         known_encodings: List[np.ndarray]) -> Tuple[bool, float, float]:
        """Match face with improved strict criteria"""
        if not known_encodings:
            return False, 1.0, 1.0
        
        try:
            # Calculate distances
            distances = face_recognition.face_distance(
                np.asarray(known_encodings, dtype=np.float32), 
                np.asarray(query_encoding, dtype=np.float32)
            )
            
            # Sort distances
            sorted_distances = np.sort(distances)
            d1 = float(sorted_distances[0])
            d2 = float(sorted_distances[1]) if len(sorted_distances) > 1 else 1.0
            
            # Improved strict criteria with more lenient tolerance
            # Original: tolerance=0.6, gap_min=0.05
            # New: More lenient for better accuracy
            tolerance = 0.65  # Increased from 0.6
            gap_min = 0.03    # Decreased from 0.05
            
            # Check strict criteria
            accepted = (d1 <= tolerance) and ((d2 - d1) >= gap_min)
            
            # Additional check: if distance is very low, accept even without gap
            if d1 <= 0.4:  # Very confident match
                accepted = True
            
            return accepted, d1, d2
        except Exception as e:
            return False, 1.0, 1.0
    
    def match_face_with_fallback(self, query_encoding: np.ndarray, 
                               known_encodings: List[np.ndarray]) -> Tuple[bool, float, float]:
        """Match face with fallback strategy for better accuracy"""
        if not known_encodings:
            return False, 1.0, 1.0
        
        try:
            # Primary matching with strict criteria
            accepted, d1, d2 = self.match_face_strict(query_encoding, known_encodings)
            
            if accepted:
                return True, d1, d2
            
            # Fallback: Try with more lenient criteria
            distances = face_recognition.face_distance(
                np.asarray(known_encodings, dtype=np.float32), 
                np.asarray(query_encoding, dtype=np.float32)
            )
            
            sorted_distances = np.sort(distances)
            d1 = float(sorted_distances[0])
            d2 = float(sorted_distances[1]) if len(sorted_distances) > 1 else 1.0
            
            # Fallback criteria: more lenient
            fallback_tolerance = 0.7  # More lenient
            fallback_gap_min = 0.02   # Smaller gap requirement
            
            fallback_accepted = (d1 <= fallback_tolerance) and ((d2 - d1) >= fallback_gap_min)
            
            return fallback_accepted, d1, d2
            
        except Exception as e:
            return False, 1.0, 1.0
    
    def recognize_single_face(self, image_data: str) -> Dict[str, Any]:
        """Recognize single face from image data"""
        try:
            # Decode image
            image_array = self.decode_image(image_data)
            if image_array is None:
                return {
                    'recognized': False,
                    'message': 'Không thể xử lý ảnh'
                }
            
            # Check image quality
            if not self.is_image_quality_good(image_array, is_enrollment=False):
                return {
                    'recognized': False,
                    'message': 'Ảnh quá mờ, vui lòng chụp lại với ánh sáng tốt hơn'
                }
            
            # Get face encoding
            face_encoding = self.get_face_encoding(image_array)
            if face_encoding is None:
                return {
                    'recognized': False,
                    'message': 'Không phát hiện khuôn mặt trong ảnh'
                }
            
            return {
                'recognized': True,
                'face_encoding': face_encoding,
                'image_quality': self.compute_blur_score(image_array)
            }
        except Exception as e:
            return {
                'recognized': False,
                'message': 'Lỗi xử lý nhận dạng khuôn mặt'
            }
    
    def recognize_multiple_faces(self, images_data: List[str]) -> Dict[str, Any]:
        """Recognize multiple faces from multiple images"""
        try:
            all_face_encodings = []
            
            for img_data in images_data[:5]:  # Limit to 5 images
                # Decode image
                image_array = self.decode_image(img_data)
                if image_array is None:
                    continue
                
                # Get all face encodings from this image
                face_encodings = self.get_all_face_encodings(image_array)
                all_face_encodings.extend(face_encodings)
            
            if not all_face_encodings:
                return {
                    'recognized': False,
                    'message': 'Không phát hiện khuôn mặt nào trong ảnh'
                }
            
            return {
                'recognized': True,
                'face_encodings': all_face_encodings,
                'face_count': len(all_face_encodings)
            }
        except Exception as e:
            return {
                'recognized': False,
                'message': 'Lỗi xử lý nhận dạng nhiều khuôn mặt'
            }
    
