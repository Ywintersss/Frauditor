#!/bin/bash
set -e

# Apply migrations
echo "Running migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput
python manage.py init_superuser

# Start server
echo "Starting server..."
exec gunicorn --chdir . Frauditor.wsgi:application --bind 0.0.0.0:8000
exec "$@"
