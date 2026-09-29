import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env(path):
    """Tiny .env loader so `cp .env.example .env` just works."""
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_env(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "core",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "weatherly.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
}]
WSGI_APPLICATION = "weatherly.wsgi.application"
DATABASES = {}  # Weatherly is stateless: favorites live in the browser
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True

# Provider settings (Open-Meteo needs no API key)
OPEN_METEO_FORECAST_URL = os.environ.get("OPEN_METEO_FORECAST_URL", "https://api.open-meteo.com/v1/forecast")
OPEN_METEO_GEOCODING_URL = os.environ.get("OPEN_METEO_GEOCODING_URL", "https://geocoding-api.open-meteo.com/v1/search")
WEATHER_CACHE_SECONDS = int(os.environ.get("WEATHER_CACHE_SECONDS", "600"))
OPEN_METEO_AIR_URL = os.environ.get("OPEN_METEO_AIR_URL", "https://air-quality-api.open-meteo.com/v1/air-quality")
# Optional, free key from https://openweathermap.org/api - enables map layers + place names for GPS.
OWM_API_KEY = os.environ.get("OWM_API_KEY", "")

# OpenStreetMap tile servers require a Referer; Django's default ("same-origin") strips it and tiles get blocked.
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
