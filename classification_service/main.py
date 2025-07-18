from typing import Dict
from schemas.schema import BulkReviewsSchema, MessageResponseSchema
from classification_model.model import getPredictions
from flask import Flask, request, jsonify


class FakeReviewDetector:
    def __init__(self) -> None:
        pass


app = Flask(__name__)


@app.route("/_api/submit-reviews", methods=["POST"])
def submit_reviews():
    data = request.json
    results = getPredictions("./classification_model/frauditor_model.pkl", data)
    return jsonify({"predictions": results})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
