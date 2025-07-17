from ninja import Router
from .schemas import UserOut
from .models import User
from typing import List
router = Router()

@router.get("/",response=List[UserOut])
def list_users(request):
    return User.objects.all()
