from ninja import ModelSchema
from .models import Review

class Review(ModelSchema):
    class Meta: 
        model = Review
        fields = "__all__"

    
