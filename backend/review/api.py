from ninja import Router
import json

# from classification_model.model import getPredictions
from .schemas import MessageResponseSchema, ReviewSchema, BulkReviewsSchema
import requests

router = Router()


@router.post("/submit-reviews")
async def submit_reviews(request, payload: BulkReviewsSchema):
    response = requests.post(
        "https://frauditor-microservice.onrender.com/_api/submit-reviews",
        request.body,
        headers={"Content-Type": "application/json"},
    )

    return {"message": "OK", "predictions": response.json()}
