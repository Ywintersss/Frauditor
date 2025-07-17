from django.contrib.auth.admin import UserAdmin
from django.contrib import admin
from .models import User
# Register your models here.

class CustomUserAdmin(UserAdmin):
    fieldsets = (
        (None, {"fields": ("email", "id", "password",)}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                )
            },
        ),
    )
    add_fieldsets = ((None, {"fields": ("email", "password1", "password2",)}),)
    readonly_fields = ("id",)
    list_display = (
        "username",
        "is_staff",
        "is_active",
        "is_superuser",
        "email",
    )
    ordering = ["email"]


admin.site.register(User, CustomUserAdmin)