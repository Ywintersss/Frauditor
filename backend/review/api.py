from ninja import Router
import json
# from classification_model.model import getPredictions
from .schemas import MessageResponseSchema, ReviewSchema, BulkReviewsSchema
import requests

router = Router()


@router.post("/submit-reviews")
def submit_reviews(request, payload: BulkReviewsSchema):
    print(request)
    response = requests.post(
        "http://127.0.0.1:5000/_api/submit-reviews", json=payload.dict()
    )
    print(response)
    data = response
    # data = json.loads(request.body)
    evaluation = {}

    # predictions = getPredictions(
    #     "./classification_model/frauditor_model.pkl",
    #     data,
    # )

    # for key, prediction in predictions.items():
    #     evaluation[key] = prediction

    return {"message": "OK", "predictions": evaluation}
