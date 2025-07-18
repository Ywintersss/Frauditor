from django.apps import AppConfig
import os
from pathlib import Path


class FraudDetectionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'fraud_detection'
    verbose_name = ' Fraud Detection'
    
    def ready(self):
        """Initialize ML engine when Django starts"""
        try:
            from .ml_engine import initialize_ml_engine
            
            # Find model file
            model_path = self._find_model_file()
            if model_path and model_path.exists():
                success = initialize_ml_engine(str(model_path))
                if success:
                    print(" ML Engine initialized successfully")
                else:
                    print(" Failed to initialize ML Engine")
            else:
                print("  Model file not found - please train and upload model")
                
        except Exception as e:
            print(f" Error initializing ML Engine: {e}")
    
    def _find_model_file(self):
        """Find the model file in various possible locations"""
        base_dir = Path(__file__).resolve().parent.parent
        possible_paths = [
            base_dir / 'fraud_detection' / 'models' / 'frauditor_model.pkl',
            base_dir / 'models' / 'frauditor_model.pkl',
            base_dir / 'frauditor_model.pkl',
            Path.cwd() / 'frauditor_model.pkl',
        ]
        
        for path in possible_paths:
            if path.exists():
                return path
        return None
