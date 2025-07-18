from ninja import Router, Schema
from typing import Dict, Any, Optional
from pydantic import Field


# Pydantic schemas for Django Ninja
class ReviewSchema(Schema):
    """Schema for individual review"""

    username: str
    ratings: int
    purchase_date: str
    item_variation: str
    location: str
    subreview: Dict[str, Dict[str, str]]  # "sub n" -> {"string": string}
    review_content: str
    has_image: bool


# NEW: Bulk reviews schema with dynamic keys
class BulkReviewsSchema(Schema):
    """Schema for multiple reviews with dynamic keys like 'review 1', 'review 2', etc."""

    pass

    def __init__(self, **data):
        # This allows any key-value pairs where values are ReviewSchema-compatible
        super().__init__(**data)


# Input schema for creating/updating subreviews
class SubReviewInputSchema(Schema):
    """Schema for subreview input"""

    data: Dict[str, str]


# Response schemas
class MessageResponseSchema(Schema):
    """Generic message response"""

    message: str


class ErrorResponseSchema(Schema):
    """Error response schema"""

    error: str


# Create router
router = Router()
