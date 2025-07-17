from ninja import ModelSchema
from .models import User

class UserOut(ModelSchema):
    class Meta:
        model = User
        exclude = ["password", "user_permissions", "groups", "id"]