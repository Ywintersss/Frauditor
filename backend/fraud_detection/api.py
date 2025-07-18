"""
API for Real-time Fraud Detection
Optimized for Chrome Extension Integration
"""

from ninja import Router, Schema
from ninja.responses import Response
from django.http import JsonResponse
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import time
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Import ML engine
try:
    from .ml_engine import predict_review, get_ml_health, ml_engine
except ImportError:
    print("  ML Engine not available - using mock responses")
    predict_review = None
    get_ml_health = None
    ml_engine = None

logger = logging.getLogger(__name__)

# Create router
router = Router(tags=[" Fraud Detection"])


# 📋 REQUEST/RESPONSE SCHEMAS
class ReviewAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Review text to analyze")
    context: Optional[Dict] = Field(default=None, description="Additional context (rating, product, etc.)")
    
    class Config:
        schema_extra = {
            "example": {
                "text": "Product bagus, delivery cepat, quality ok. Recommended!",
                "context": {
                    "rating": 5,
                    "product_category": "electronics"
                }
            }
        }


class ReviewAnalysisResponse(BaseModel):
    success: bool = Field(..., description="Whether analysis was successful")
    prediction: str = Field(..., description="REAL or FAKE")
    confidence: float = Field(..., ge=0, le=1, description="Prediction confidence (0-1)")
    fake_probability: float = Field(..., ge=0, le=1, description="Probability of being fake")
    risk_level: str = Field(..., description="MINIMAL, LOW, MEDIUM, HIGH")
    prediction_time: float = Field(..., description="Processing time in seconds")
    analysis: Dict[str, Any] = Field(..., description="Detailed analysis")
    metadata: Dict[str, Any] = Field(..., description="Request metadata")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "prediction": "REAL",
                "confidence": 0.87,
                "fake_probability": 0.13,
                "risk_level": "MINIMAL",
                "prediction_time": 0.082,
                "analysis": {
                    "word_count": 8,
                    "sentiment_score": 0.5,
                    "malaysian_terms": 3,
                    "quality_score": 85
                },
                "metadata": {
                    "model_version": "1.0",
                    "timestamp": "2024-01-20T10:30:00Z"
                }
            }
        }


class BatchAnalysisRequest(BaseModel):
    reviews: List[str] = Field(..., max_items=50, description="List of reviews to analyze")
    
    class Config:
        schema_extra = {
            "example": {
                "reviews": [
                    "Great product, fast delivery!",
                    "Terrible quality, waste of money",
                    "Barang ok, harga berbaloi"
                ]
            }
        }


class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="System health status")
    model_loaded: bool = Field(..., description="Whether ML model is loaded")
    components: Dict[str, bool] = Field(..., description="Component health status")
    performance: Dict[str, Any] = Field(..., description="Performance metrics")
    version: str = Field(..., description="API version")


#  MAIN ENDPOINTS

@router.post("/analyze", response=ReviewAnalysisResponse)
def analyze_review(request, data: ReviewAnalysisRequest):
    """
    Analyze single review for authenticity
    
    **Features:**
    - Real-time analysis (<200ms)
    - Malaysian context awareness
    - Detailed risk assessment
    - Performance optimized
    """
    start_time = time.time()
    
    try:
        # Validate input
        if not data.text or len(data.text.strip()) < 3:
            return Response(
                {
                    "success": False,
                    "error": "Text too short (minimum 3 characters)",
                    "prediction": "INVALID",
                    "confidence": 0.0
                },
                status=400
            )
        
        # Check if ML engine is available
        if not predict_review:
            return _mock_response(data.text, start_time)
        
        # Make prediction
        result = predict_review(data.text)
        
        # Handle errors
        if 'error' in result:
            logger.error(f"ML prediction error: {result['error']}")
            return Response(
                {
                    "success": False,
                    "error": result['error'],
                    "prediction": "ERROR",
                    "confidence": 0.0
                },
                status=500
            )
        
        # Format response
        response_data = {
            "success": True,
            "prediction": result['prediction'],
            "confidence": result['confidence'],
            "fake_probability": result['fake_probability'],
            "risk_level": result['risk_level'],
            "prediction_time": result['prediction_time'],
            "analysis": result.get('analysis', {}),
            "metadata": {
                **result.get('metadata', {}),
                "request_time": time.time() - start_time,
                "api_version": "1.0"
            }
        }
        
        # Add context if provided
        if data.context:
            response_data['metadata']['context'] = data.context
        
        # Log for monitoring
        logger.info(f"Analysis completed: {result['prediction']} ({result['confidence']:.3f}) in {result['prediction_time']:.3f}s")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return Response(
            {
                "success": False,
                "error": f"Internal server error: {str(e)}",
                "prediction": "ERROR",
                "confidence": 0.0,
                "prediction_time": time.time() - start_time
            },
            status=500
        )


@router.post("/analyze/batch")
def analyze_batch(request, data: BatchAnalysisRequest):
    """
     Batch analysis of multiple reviews
    
    **Limits:**
    - Maximum 50 reviews per request
    - Individual timeout per review
    - Aggregated statistics
    """
    start_time = time.time()
    
    try:
        if len(data.reviews) > 50:
            return Response(
                {"error": "Maximum 50 reviews per batch"},
                status=400
            )
        
        results = []
        stats = {
            "total": len(data.reviews),
            "fake_count": 0,
            "real_count": 0,
            "error_count": 0,
            "avg_confidence": 0.0,
            "processing_time": 0.0
        }
        
        # Process each review
        for i, review_text in enumerate(data.reviews):
            try:
                if predict_review:
                    result = predict_review(review_text)
                    if 'error' not in result:
                        results.append({
                            "index": i,
                            "text": review_text[:100] + "..." if len(review_text) > 100 else review_text,
                            "prediction": result['prediction'],
                            "confidence": result['confidence'],
                            "fake_probability": result['fake_probability'],
                            "risk_level": result['risk_level']
                        })
                        
                        # Update stats
                        if result['prediction'] == 'FAKE':
                            stats['fake_count'] += 1
                        else:
                            stats['real_count'] += 1
                        stats['avg_confidence'] += result['confidence']
                    else:
                        results.append({
                            "index": i,
                            "text": review_text[:100] + "..." if len(review_text) > 100 else review_text,
                            "error": result['error']
                        })
                        stats['error_count'] += 1
                else:
                    # Mock response
                    fake_prob = 0.2 if 'good' in review_text.lower() else 0.7
                    results.append({
                        "index": i,
                        "text": review_text[:100] + "..." if len(review_text) > 100 else review_text,
                        "prediction": "REAL" if fake_prob < 0.5 else "FAKE",
                        "confidence": 1 - fake_prob if fake_prob < 0.5 else fake_prob,
                        "fake_probability": fake_prob,
                        "risk_level": "LOW"
                    })
                    if fake_prob < 0.5:
                        stats['real_count'] += 1
                    else:
                        stats['fake_count'] += 1
                    stats['avg_confidence'] += (1 - fake_prob if fake_prob < 0.5 else fake_prob)
                        
            except Exception as e:
                results.append({
                    "index": i,
                    "text": review_text[:100] + "..." if len(review_text) > 100 else review_text,
                    "error": str(e)
                })
                stats['error_count'] += 1
        
        # Calculate final stats
        valid_count = stats['total'] - stats['error_count']
        if valid_count > 0:
            stats['avg_confidence'] /= valid_count
        
        stats['processing_time'] = time.time() - start_time
        stats['fake_percentage'] = (stats['fake_count'] / valid_count * 100) if valid_count > 0 else 0
        
        return {
            "success": True,
            "results": results,
            "statistics": stats,
            "metadata": {
                "total_processing_time": time.time() - start_time,
                "api_version": "1.0",
                "timestamp": time.time()
            }
        }
        
    except Exception as e:
        logger.error(f"Batch analysis error: {e}")
        return Response(
            {"error": f"Batch analysis failed: {str(e)}"},
            status=500
        )


@router.get("/health", response=HealthCheckResponse)
def health_check(request):
    """
    System health check and performance monitoring
    """
    try:
        if get_ml_health:
            health_data = get_ml_health()
            return {
                "status": health_data.get('status', 'unknown'),
                "model_loaded": health_data.get('model_loaded', False),
                "components": health_data.get('components', {}),
                "performance": health_data.get('performance', {}),
                "version": health_data.get('version', '1.0')
            }
        else:
            return {
                "status": "limited",
                "model_loaded": False,
                "components": {
                    "api": True,
                    "model": False,
                    "vectorizer": False,
                    "scaler": False
                },
                "performance": {
                    "total_predictions": 0,
                    "average_prediction_time": 0
                },
                "version": "1.0"
            }
            
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return Response(
            {"error": f"Health check failed: {str(e)}"},
            status=500
        )


@router.get("/stats")
def get_statistics(request):
    """
    Get detailed system statistics
    """
    try:
        if ml_engine and ml_engine.is_loaded:
            stats = ml_engine.get_performance_stats()
            return {
                "success": True,
                "statistics": stats,
                "system_info": {
                    "model_loaded": ml_engine.is_loaded,
                    "model_path": ml_engine.model_path,
                    "api_version": "1.0"
                }
            }
        else:
            return {
                "success": False,
                "message": "ML engine not loaded",
                "statistics": {
                    "total_predictions": 0,
                    "average_prediction_time": 0
                }
            }
            
    except Exception as e:
        return Response(
            {"error": f"Statistics unavailable: {str(e)}"},
            status=500
        )


# CHROME EXTENSION OPTIMIZED ENDPOINT
@router.post("/extension/analyze")
def extension_analyze(request, data: ReviewAnalysisRequest):
    """
    Optimized endpoint for Chrome extension
    
    **Features:**
    - CORS enabled
    - Minimal response size
    - Fast processing
    - Error resilience
    """
    start_time = time.time()
    
    try:
        # Quick validation
        text = data.text.strip()
        if len(text) < 3:
            return {
                "status": "invalid",
                "message": "Text too short",
                "risk": "unknown"
            }
        
        # Get prediction
        if predict_review:
            result = predict_review(text)
            
            if 'error' not in result:
                # Simplified response for extension
                return {
                    "status": "success",
                    "prediction": result['prediction'].lower(),
                    "confidence": round(result['confidence'], 3),
                    "risk": result['risk_level'].lower(),
                    "fake_prob": round(result['fake_probability'], 3),
                    "details": {
                        "malaysian": result.get('analysis', {}).get('malaysian_terms', 0) > 0,
                        "quality": result.get('analysis', {}).get('quality_score', 50),
                        "time": round(result['prediction_time'], 3)
                    }
                }
            else:
                return {
                    "status": "error",
                    "message": "Analysis failed",
                    "risk": "unknown"
                }
        else:
            # Mock response for testing
            return _mock_extension_response(text)
            
    except Exception as e:
        logger.error(f"Extension analysis error: {e}")
        return {
            "status": "error",
            "message": "Service temporarily unavailable",
            "risk": "unknown"
        }


# UTILITY FUNCTIONS

def _mock_response(text: str, start_time: float) -> Dict[str, Any]:
    """Generate mock response when ML engine is not available"""
    # Simple heuristic for demo
    fake_indicators = ['amazing', 'perfect', 'best ever', '!!!', 'buy now']
    fake_score = sum(1 for indicator in fake_indicators if indicator in text.lower())
    fake_prob = min(0.9, fake_score * 0.2 + 0.1)
    
    return {
        "success": True,
        "prediction": "FAKE" if fake_prob > 0.5 else "REAL",
        "confidence": 1 - fake_prob if fake_prob <= 0.5 else fake_prob,
        "fake_probability": fake_prob,
        "risk_level": "HIGH" if fake_prob > 0.7 else "LOW",
        "prediction_time": 0.05,
        "analysis": {
            "word_count": len(text.split()),
            "sentiment_score": 0.0,
            "malaysian_terms": 0,
            "quality_score": 50
        },
        "metadata": {
            "model_version": "mock",
            "timestamp": time.time(),
            "request_time": time.time() - start_time
        }
    }


def _mock_extension_response(text: str) -> Dict[str, Any]:
    """Mock response for extension testing"""
    fake_prob = 0.3 if any(word in text.lower() for word in ['good', 'ok', 'nice']) else 0.7
    
    return {
        "status": "success",
        "prediction": "real" if fake_prob < 0.5 else "fake",
        "confidence": round(1 - fake_prob if fake_prob < 0.5 else fake_prob, 3),
        "risk": "low" if fake_prob < 0.5 else "high",
        "fake_prob": round(fake_prob, 3),
        "details": {
            "malaysian": 'lah' in text.lower() or 'ok' in text.lower(),
            "quality": 60,
            "time": 0.05
        }
    }


# ERROR HANDLERS

@router.exception_handler(Exception)
def general_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return Response(
        {
            "success": False,
            "error": "An unexpected error occurred",
            "details": str(exc) if settings.DEBUG else None
        },
        status=500
    )