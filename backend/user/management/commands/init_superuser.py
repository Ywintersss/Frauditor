from django.core.management.base import BaseCommand
from user.models import User
import os
from django.db.transaction import atomic


class Command(BaseCommand):
    help = "Custom management commands"

    @atomic
    def handle(self, *args, **options):
        if not User.objects.filter(is_superuser=True).exists():
            User.objects.create_superuser(
                email=os.getenv("SUPERUSER_EMAIL"),
                password=os.getenv("SUPERUSER_PASSWORD"),
                username=os.getenv("SUPERUSER_USERNAME")
            )
            print("Superuser created")
