"""
Models for fraud detection 
"""

from django.db import models

class FraudDetectionStats(models.Model):
    """Optional model for tracking statistics"""
    prediction_count = models.IntegerField(default=0)
    fake_count = models.IntegerField(default=0)
    real_count = models.IntegerField(default=0)
    average_confidence = models.FloatField(default=0.0)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Fraud Detection Statistics"
        verbose_name_plural = "Fraud Detection Statistics"

