
# Create your models here.
from django.db import models



class Review(models.Model):
    username = models.CharField(max_length=150)
    ratings = models.IntegerField()
    purchase_date = models.DateField()
    item_variation = models.CharField(max_length=100)
    location = models.CharField(max_length=100)
    review_content = models.TextField()
    has_image = models.BooleanField()
    subreview = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"Review by {self.username} on {self.purchase_date}"

