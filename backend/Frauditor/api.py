from user.api import router as user_router
from scraper.api import router as scraper_router
from review.api import router as review_router
# from fraud_detection.api import router as fraud_router
from ninja import NinjaAPI

api = NinjaAPI(
    title="Frauditor API",
    description="Real-time fake review detection system for Malaysian e-commerce",
    version="1.0.0",
    docs_url="/api/docs/",  # Enable automatic API documentation
)

api.add_router("users", user_router)
api.add_router("scraper", scraper_router)
api.add_router("reviews", review_router)
# api.add_router("fraud", fraud_router)
