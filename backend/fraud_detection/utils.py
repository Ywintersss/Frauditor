"""
Utility functions for fraud detection
"""
import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List
from django.conf import settings
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


def get_model_path() -> str:
    """Get the ML model file path"""
    # Try multiple possible locations
    possible_paths = [
        getattr(settings, 'ML_MODEL_PATH', None),
        os.path.join(settings.BASE_DIR, 'fraud_detection', 'models', 'frauditor_model.pkl'),
        os.path.join(settings.BASE_DIR, 'models', 'frauditor_model.pkl'),
        os.path.join(settings.BASE_DIR, 'frauditor_model.pkl'),
    ]
    
    for path in possible_paths:
        if path and os.path.exists(path):
            return path
    
    logger.warning("Model file not found in any expected location")
    return None


def cache_prediction(text: str, result: Dict[str, Any], timeout: int = 300):
    """Cache prediction result"""
    try:
        cache_key = f"fraud_prediction_{hash(text)}"
        cache.set(cache_key, result, timeout)
    except Exception as e:
        logger.error(f"Cache error: {e}")


def get_cached_prediction(text: str) -> Dict[str, Any]:
    """Get cached prediction result"""
    try:
        cache_key = f"fraud_prediction_{hash(text)}"
        return cache.get(cache_key)
    except Exception as e:
        logger.error(f"Cache retrieval error: {e}")
        return None


def validate_text_input(text: str) -> tuple[bool, str]:
    """Validate text input"""
    if not text:
        return False, "Text is required"
    
    if len(text.strip()) < 3:
        return False, "Text too short (minimum 3 characters)"
    
    if len(text) > 5000:
        return False, "Text too long (maximum 5000 characters)"
    
    return True, ""


def sanitize_text(text: str) -> str:
    """Sanitize text input"""
    # Remove potentially harmful content
    text = text.strip()
    
    # Remove excessive whitespace
    import re
    text = re.sub(r'\s+', ' ', text)
    
    return text


def calculate_rate_limit_key(request) -> str:
    """Calculate rate limiting key for request"""
    # Use IP address for rate limiting
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    
    return f"rate_limit_{ip}"


def is_rate_limited(request, max_requests: int = 100, window: int = 3600) -> bool:
    """Check if request is rate limited"""
    try:
        key = calculate_rate_limit_key(request)
        current_count = cache.get(key, 0)
        
        if current_count >= max_requests:
            return True
        
        # Increment counter
        cache.set(key, current_count + 1, window)
        return False
        
    except Exception as e:
        logger.error(f"Rate limiting error: {e}")
        return False  # Don't block on error


def log_prediction_stats(prediction: str, confidence: float, prediction_time: float):
    """Log prediction statistics (without database)"""
    try:
        stats = {
            'prediction': prediction,
            'confidence': confidence,
            'prediction_time': prediction_time,
            'timestamp': time.time()
        }
        logger.info(f"Prediction stats: {json.dumps(stats)}")
    except Exception as e:
        logger.error(f"Stats logging error: {e}")


def create_directories():
    """Create necessary directories"""
    directories = [
        Path(settings.BASE_DIR) / 'fraud_detection' / 'models',
        Path(settings.BASE_DIR) / 'logs',
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


# Initialize directories on import
create_directories()