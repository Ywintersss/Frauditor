"""
FRAUDITOR ML ENGINE - PRODUCTION READY
Optimized for Malaysian e-commerce fake review detection
Author: Team Fighting - FutureHack 
"""

import pickle
import numpy as np
import pandas as pd
import re
import time
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging
from datetime import datetime

# NLP imports
try:
    import nltk
    from nltk.sentiment import SentimentIntensityAnalyzer
    from nltk.tokenize import word_tokenize
    from nltk.corpus import stopwords
    from textblob import TextBlob
except ImportError:
    print("Installing NLTK components...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'nltk', 'textblob'])
    import nltk
    nltk.download('vader_lexicon', quiet=True)
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FrauditorMLEngine:
    """
    High-Performance ML Engine for Real-time Fake Review Detection
    Optimized for Malaysian e-commerce market
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model = None
        self.vectorizer = None
        self.scaler = None
        self.feature_extractor = None
        self.is_loaded = False
        
        # Initialize NLP components
        self._init_nlp_components()
        
        # Malaysian-specific terms (optimized for performance)
        self.malaysian_terms = {
            'shiok', 'confirm', 'steady', 'power', 'cantik', 'lawa', 'terror',
            'bagus', 'teruk', 'rosak', 'murah', 'baik', 'elok', 'mantap',
            'tiptop', 'padu', 'mmg', 'sgt', 'dia', 'kt', 'kat', 'dah', 'tak',
            'beli', 'dapat', 'sampai', 'cepat', 'lambat', 'ok', 'okay',
            'best', 'nice', 'cheap', 'mahal', 'syok', 'gempak', 'memang'
        }
        
        # Product quality indicators
        self.quality_indicators = {
            'delivery', 'packaging', 'quality', 'size', 'color', 'material',
            'fitting', 'comfort', 'battery', 'charge', 'sound', 'screen',
            'camera', 'performance', 'seller', 'service', 'price', 'value',
            'texture', 'durability', 'functionality', 'design', 'weight'
        }
        
        # Suspicious patterns (cached for performance)
        self.fake_patterns = [
            'highly recommend', 'best product ever', 'amazing quality',
            'exceeded expectations', 'perfect product', 'love it so much',
            'exactly what i needed', 'great value for money', 'buy now',
            'great deal', 'discount', 'sale', 'limited time', 'special offer'
        ]
        
        # Performance metrics
        self.prediction_count = 0
        self.total_prediction_time = 0
        
        logger.info(" FrauditorMLEngine initialized")
    
    def _init_nlp_components(self):
        """Initialize NLP components with error handling"""
        try:
            self.sia = SentimentIntensityAnalyzer()
            self.stop_words = set(stopwords.words('english'))
            logger.info(" NLP components loaded successfully")
        except Exception as e:
            logger.error(f" Error loading NLP components: {e}")
            # Fallback initialization
            self.sia = None
            self.stop_words = set()
    
    def load_model(self, model_path: str = None) -> bool:
        """
         Load trained model with comprehensive error handling
        """
        try:
            if model_path:
                self.model_path = model_path
            
            if not self.model_path:
                logger.error(" No model path specified")
                return False
            
            model_file = Path(self.model_path)
            if not model_file.exists():
                logger.error(f" Model file not found: {self.model_path}")
                return False
            
            logger.info(f" Loading model from {self.model_path}")
            
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f)
            
            # Extract model components
            self.model = model_data.get('models', {}).get('ensemble')
            self.vectorizer = model_data.get('vectorizers', {}).get('tfidf')
            self.scaler = model_data.get('scaler')
            self.feature_extractor = model_data.get('detector')
            
            if not all([self.model, self.vectorizer, self.scaler]):
                logger.error(" Incomplete model data")
                return False
            
            self.is_loaded = True
            logger.info(" Model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f" Error loading model: {e}")
            return False
    
    def extract_features(self, text: str) -> Dict[str, Any]:
        """
        Extract comprehensive features optimized for speed
        """
        if not text or len(text.strip()) == 0:
            return self._get_empty_features()
        
        text = str(text).lower().strip()
        
        # Fast tokenization
        try:
            words = word_tokenize(text) if text else []
        except:
            words = text.split()
        
        # Basic statistics (vectorized for speed)
        features = {
            'length': len(text),
            'word_count': len(words),
            'avg_word_length': np.mean([len(w) for w in words]) if words else 0,
            'sentence_count': len(re.split(r'[.!?]+', text)),
            'exclamation_count': text.count('!'),
            'question_count': text.count('?'),
            'caps_ratio': sum(1 for c in text if c.isupper()) / len(text) if text else 0,
            'punctuation_ratio': sum(1 for c in text if c in '.,!?;:') / len(text) if text else 0
        }
        
        # Sentiment analysis (with fallback)
        if self.sia:
            sentiment = self.sia.polarity_scores(text)
            features.update({
                'sentiment_compound': sentiment['compound'],
                'sentiment_positive': sentiment['pos'],
                'sentiment_negative': sentiment['neg'],
                'sentiment_neutral': sentiment['neu']
            })
        else:
            features.update({
                'sentiment_compound': 0,
                'sentiment_positive': 0,
                'sentiment_negative': 0,
                'sentiment_neutral': 0.5
            })
        
        # Malaysian-specific features (optimized with set operations)
        malaysian_count = sum(1 for word in words if word in self.malaysian_terms)
        quality_count = sum(1 for word in words if word in self.quality_indicators)
        
        features.update({
            'malaysian_terms_count': malaysian_count,
            'malaysian_terms_ratio': malaysian_count / len(words) if words else 0,
            'product_terms_count': quality_count,
            'product_terms_ratio': quality_count / len(words) if words else 0,
            'has_mixed_language': self._detect_mixed_language(text),
            'has_specific_details': quality_count >= 2
        })
        
        # Suspicious patterns (optimized with any())
        features.update({
            'has_generic_phrases': any(phrase in text for phrase in self.fake_patterns[:8]),
            'has_promotional_language': any(phrase in text for phrase in self.fake_patterns[8:]),
            'repeated_words': len(words) - len(set(words)) if words else 0,
            'spelling_errors': self._count_spelling_errors(words)
        })
        
        # TextBlob features (with error handling)
        try:
            blob = TextBlob(text)
            features['textblob_polarity'] = blob.sentiment.polarity
            features['textblob_subjectivity'] = blob.sentiment.subjectivity
        except:
            features['textblob_polarity'] = 0
            features['textblob_subjectivity'] = 0.5
        
        return features
    
    def _detect_mixed_language(self, text: str) -> bool:
        """Fast mixed language detection"""
        malay_indicators = {'yang', 'dan', 'ini', 'itu', 'dengan', 'untuk', 'dari', 'ke', 'pada'}
        english_indicators = {'the', 'and', 'this', 'that', 'with', 'for', 'from', 'to', 'on'}
        
        text_words = set(text.split())
        has_malay = bool(malay_indicators & text_words)
        has_english = bool(english_indicators & text_words)
        
        return has_malay and has_english
    
    def _count_spelling_errors(self, words: List[str]) -> int:
        """Fast spelling error estimation"""
        error_count = 0
        for word in words[:20]:  # Limit for performance
            if len(word) > 3 and not word.isalpha() and word not in self.stop_words:
                error_count += 1
        return error_count
    
    def _get_empty_features(self) -> Dict[str, Any]:
        """Return default empty features"""
        return {
            'length': 0, 'word_count': 0, 'avg_word_length': 0,
            'sentence_count': 0, 'exclamation_count': 0, 'question_count': 0,
            'caps_ratio': 0, 'punctuation_ratio': 0, 'sentiment_compound': 0,
            'sentiment_positive': 0, 'sentiment_negative': 0, 'sentiment_neutral': 0.5,
            'malaysian_terms_count': 0, 'malaysian_terms_ratio': 0,
            'product_terms_count': 0, 'product_terms_ratio': 0,
            'has_mixed_language': False, 'has_specific_details': False,
            'has_generic_phrases': False, 'has_promotional_language': False,
            'repeated_words': 0, 'spelling_errors': 0,
            'textblob_polarity': 0, 'textblob_subjectivity': 0.5
        }
    
    def predict(self, text: str) -> Dict[str, Any]:
        """
        ⚡ Ultra-fast prediction optimized for real-time use
        Target: <200ms response time
        """
        start_time = time.time()
        
        if not self.is_loaded:
            return {
                'error': 'Model not loaded',
                'prediction': 'UNKNOWN',
                'confidence': 0.0,
                'prediction_time': 0
            }
        
        try:
            # 1. Clean and validate input
            if not text or len(text.strip()) < 3:
                return self._get_default_prediction('TOO_SHORT', start_time)
            
            cleaned_text = self._clean_text_fast(text)
            
            # 2. Extract features
            features = self.extract_features(cleaned_text)
            
            # 3. Prepare features for model
            X = self._prepare_model_features(cleaned_text, features)
            
            # 4. Make prediction
            probabilities = self.model.predict_proba(X)[0]
            prediction = self.model.predict(X)[0]
            
            # 5. Calculate metrics
            fake_prob = float(probabilities[1])
            confidence = float(max(probabilities))
            prediction_time = time.time() - start_time
            
            # 6. Determine risk level
            risk_level = self._calculate_risk_level(fake_prob)
            
            # 7. Update performance metrics
            self.prediction_count += 1
            self.total_prediction_time += prediction_time
            
            # 8. Return comprehensive result
            result = {
                'prediction': 'FAKE' if prediction == 1 else 'REAL',
                'confidence': confidence,
                'fake_probability': fake_prob,
                'real_probability': float(probabilities[0]),
                'risk_level': risk_level,
                'prediction_time': prediction_time,
                'analysis': {
                    'word_count': features.get('word_count', 0),
                    'sentiment_score': features.get('sentiment_compound', 0),
                    'malaysian_terms': features.get('malaysian_terms_count', 0),
                    'has_mixed_language': features.get('has_mixed_language', False),
                    'quality_score': self._calculate_quality_score(features),
                    'suspicious_patterns': self._get_suspicious_patterns(features)
                },
                'metadata': {
                    'text_length': len(text),
                    'processed_length': len(cleaned_text),
                    'model_version': '1.0',
                    'timestamp': datetime.now().isoformat()
                }
            }
            
            return result
            
        except Exception as e:
            logger.error(f" Prediction error: {e}")
            return {
                'error': str(e),
                'prediction': 'ERROR',
                'confidence': 0.0,
                'prediction_time': time.time() - start_time
            }
    
    def _clean_text_fast(self, text: str) -> str:
        """Fast text cleaning optimized for performance"""
        text = str(text).lower().strip()
        
        # Remove URLs and emails (vectorized)
        text = re.sub(r'http\S+|www\S+|https\S+|\S+@\S+', '', text)
        
        # Normalize punctuation
        text = re.sub(r'[!]{2,}', '!', text)
        text = re.sub(r'[?]{2,}', '?', text)
        text = re.sub(r'[.]{3,}', '...', text)
        
        # Remove excessive special characters
        text = re.sub(r'[^a-zA-Z0-9\s.,!?-]', '', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _prepare_model_features(self, cleaned_text: str, features: Dict) -> np.ndarray:
        """Prepare features for model prediction"""
        # Text features
        tfidf_features = self.vectorizer.transform([cleaned_text])
        
        # Linguistic features
        feature_order = [
            'length', 'word_count', 'avg_word_length', 'sentence_count',
            'exclamation_count', 'question_count', 'caps_ratio', 'punctuation_ratio',
            'sentiment_compound', 'sentiment_positive', 'sentiment_negative',
            'malaysian_terms_count', 'malaysian_terms_ratio',
            'product_terms_count', 'product_terms_ratio',
            'repeated_words', 'spelling_errors',
            'textblob_polarity', 'textblob_subjectivity',
            'has_mixed_language', 'has_specific_details',
            'has_generic_phrases', 'has_promotional_language'
        ]
        
        feature_vector = []
        for feature_name in feature_order:
            value = features.get(feature_name, 0)
            if isinstance(value, bool):
                value = int(value)
            feature_vector.append(value)
        
        # Scale features
        scaled_features = self.scaler.transform([feature_vector])
        
        # Combine features
        from scipy.sparse import hstack
        combined_features = hstack([tfidf_features, scaled_features])
        
        return combined_features
    
    def _calculate_risk_level(self, fake_prob: float) -> str:
        """Calculate risk level based on probability"""
        if fake_prob >= 0.8:
            return "HIGH"
        elif fake_prob >= 0.6:
            return "MEDIUM"
        elif fake_prob >= 0.4:
            return "LOW"
        else:
            return "MINIMAL"
    
    def _calculate_quality_score(self, features: Dict) -> int:
        """Calculate text quality score (0-100)"""
        score = 50
        
        # Positive indicators
        if features.get('word_count', 0) >= 15:
            score += 10
        if features.get('malaysian_terms_count', 0) > 0:
            score += 15
        if features.get('has_mixed_language', False):
            score += 10
        if features.get('has_specific_details', False):
            score += 10
        if 0.2 <= features.get('sentiment_compound', 0) <= 0.8:
            score += 5
        
        # Negative indicators
        if features.get('exclamation_count', 0) > 5:
            score -= 15
        if features.get('has_generic_phrases', False):
            score -= 10
        if features.get('has_promotional_language', False):
            score -= 15
        if features.get('caps_ratio', 0) > 0.2:
            score -= 10
        
        return max(0, min(100, score))
    
    def _get_suspicious_patterns(self, features: Dict) -> List[str]:
        """Get list of suspicious patterns detected"""
        patterns = []
        
        if features.get('has_generic_phrases', False):
            patterns.append('generic_phrases')
        if features.get('has_promotional_language', False):
            patterns.append('promotional_language')
        if features.get('exclamation_count', 0) > 5:
            patterns.append('excessive_punctuation')
        if features.get('caps_ratio', 0) > 0.2:
            patterns.append('excessive_caps')
        if features.get('repeated_words', 0) > features.get('word_count', 1) * 0.3:
            patterns.append('repetitive_language')
        
        return patterns
    
    def _get_default_prediction(self, reason: str, start_time: float) -> Dict[str, Any]:
        """Return default prediction for edge cases"""
        return {
            'prediction': 'REAL',
            'confidence': 0.5,
            'fake_probability': 0.1,
            'real_probability': 0.9,
            'risk_level': 'MINIMAL',
            'prediction_time': time.time() - start_time,
            'reason': reason,
            'analysis': {
                'word_count': 0,
                'quality_score': 0,
                'suspicious_patterns': []
            }
        }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        avg_time = self.total_prediction_time / self.prediction_count if self.prediction_count > 0 else 0
        
        return {
            'total_predictions': self.prediction_count,
            'average_prediction_time': avg_time,
            'total_prediction_time': self.total_prediction_time,
            'is_model_loaded': self.is_loaded,
            'model_path': self.model_path
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check"""
        return {
            'status': 'healthy' if self.is_loaded else 'unhealthy',
            'model_loaded': self.is_loaded,
            'components': {
                'model': self.model is not None,
                'vectorizer': self.vectorizer is not None,
                'scaler': self.scaler is not None,
                'nlp': self.sia is not None
            },
            'performance': self.get_performance_stats(),
            'version': '1.0',
            'timestamp': datetime.now().isoformat()
        }


# 🚀 GLOBAL INSTANCE FOR DJANGO INTEGRATION
ml_engine = FrauditorMLEngine()


def initialize_ml_engine(model_path: str) -> bool:
    """Initialize global ML engine instance"""
    global ml_engine
    return ml_engine.load_model(model_path)


def predict_review(text: str) -> Dict[str, Any]:
    """Global prediction function for API"""
    global ml_engine
    return ml_engine.predict(text)


def get_ml_health() -> Dict[str, Any]:
    """Get ML engine health status"""
    global ml_engine
    return ml_engine.health_check()