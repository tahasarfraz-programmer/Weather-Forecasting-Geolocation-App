from django.conf import settings
from django.core.cache import cache
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from . import analytics, providers

TEMP_UNITS = {"celsius", "fahrenheit"}
WIND_UNITS = {"kmh", "mph", "ms"}
TILE_LAYERS = {"clouds_new", "precipitation_new", "temp_new", "wind_new", "pressure_new"}


def _coords(request):
    try:
        lat, lon = float(request.GET["lat"]), float(request.GET["lon"])
    except (KeyError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return round(lat, 4), round(lon, 4)


def _params(request):
    c = _coords(request)
    temp, wind = request.GET.get("temp", "celsius"), request.GET.get("wind", "kmh")
    if not c or temp not in TEMP_UNITS or wind not in WIND_UNITS:
        return None
    return c, temp, wind


def _fail(message, status):
    return JsonResponse({"error": message}, status=status)


@require_GET
def index(request):
    return render(request, "core/index.html", {"owm_enabled": bool(settings.OWM_API_KEY)})


@require_GET
def search(request):
    q = request.GET.get("q", "").strip()[:80]
    if len(q) < 2:
        return JsonResponse({"results": []})
    key = "geo:" + q.lower().replace(" ", "_")
    results = cache.get(key)
    if results is None:
        try:
            results = providers.search_locations(q)
        except providers.ProviderError:
            return _fail("Search is unavailable", 502)
        cache.set(key, results, 3600)
    return JsonResponse({"results": results})


@require_GET
def reverse(request):
    c = _coords(request)
    if not c:
        return _fail("Invalid coordinates", 400)
    place = providers.reverse_geocode(*c) or {"name": "My location", "region": "", "country": ""}
    return JsonResponse({**place, "lat": c[0], "lon": c[1]})


@require_GET
def forecast(request):
    p = _params(request)
    if not p:
        return _fail("Invalid parameters", 400)
    (lat, lon), temp, wind = p
    key = f"wx:{lat}:{lon}:{temp}:{wind}"
    data = cache.get(key)
    if data is None:
        try:
            data = providers.fetch_forecast(lat, lon, temp, wind)
        except providers.ProviderError:
            return _fail("Weather provider unavailable", 502)
        cache.set(key, data, settings.WEATHER_CACHE_SECONDS)
    return JsonResponse(data)


@require_GET
def analytics_api(request):
    p = _params(request)
    if not p:
        return _fail("Invalid parameters", 400)
    (lat, lon), temp, wind = p
    key = f"an:{lat}:{lon}:{temp}:{wind}"
    report = cache.get(key)
    if report is None:
        try:
            raw = providers.fetch_history(lat, lon, temp, wind)
        except providers.ProviderError:
            return _fail("Weather provider unavailable", 502)
        try:
            air = providers.fetch_air(lat, lon)
        except providers.ProviderError:
            air = None  # air quality is optional; never blocks the dashboard
        report = analytics.build_report(raw, air, temp, wind)
        cache.set(key, report, 1800)
    return JsonResponse(report)


@require_GET
def tile(request, layer, z, x, y):
    """Proxy OpenWeatherMap tiles so the API key never reaches the browser."""
    if not settings.OWM_API_KEY or layer not in TILE_LAYERS or not (0 <= z <= 12):
        raise Http404
    key = f"tile:{layer}:{z}:{x}:{y}"
    body = cache.get(key)
    if body is None:
        try:
            body = providers.fetch_tile(layer, z, x, y)
        except providers.ProviderError:
            return HttpResponse(status=502)
        cache.set(key, body, 600)
    resp = HttpResponse(body, content_type="image/png")
    resp["Cache-Control"] = "public, max-age=600"
    return resp
