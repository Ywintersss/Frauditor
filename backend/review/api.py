from ninja import Router
import json
from classification_model.model import getPredictions
from .schemas import MessageResponseSchema, ReviewSchema, BulkReviewsSchema

router = Router()


@router.post("/submit-reviews")
def submit_reviews(request, payload: BulkReviewsSchema):
    data = json.loads(request.body)
    evaluation = {}

    predictions = getPredictions(
        "./classification_model/frauditor_improved_model.pkl",
        data,
    )

    for key, prediction in predictions.items():
        evaluation[key] = prediction

    return {"message": "OK", "predictions": evaluation}
