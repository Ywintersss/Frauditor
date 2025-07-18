from pydantic import RootModel, BaseModel, Field
from typing import Dict


# Pydantic schema for an individual review
class ReviewSchema(BaseModel):
    username: str
    ratings: int
    purchase_date: str
    item_variation: str
    location: str
    subreview: Dict[
        str, Dict[str, str]
    ]  # e.g., "sub 0": {"category": "Quality", "content": "Good"}
    review_content: str
    has_image: bool


class BulkReviewsSchema(RootModel[Dict[str, ReviewSchema]]):
    root: Dict[str, ReviewSchema]

    class Config:
        schema_extra = {
            "example": {
                "review 1": {
                    "username": "john_doe",
                    "ratings": 4,
                    "purchase_date": "2025-07-18",
                    "item_variation": "Variation: Red, Size M",
                    "location": "New York",
                    "subreview": {
                        "sub 0": {"category": "Quality", "content": "Very good"}
                    },
                    "review_content": "Excellent product overall.",
                    "has_image": True,
                }
            }
        }


# Input schema for creating/updating subreviews
class SubReviewInputSchema(BaseModel):
    data: Dict[str, str]


# Generic message response
class MessageResponseSchema(BaseModel):
    message: str


# Error response
class ErrorResponseSchema(BaseModel):
    error: str
