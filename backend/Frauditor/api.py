from user.api import router as user_router
from scraper.api import router as scraper_router
from ninja import NinjaAPI

api = NinjaAPI()

api.add_router("users", user_router)
api.add_router("scraper", scraper_router)
