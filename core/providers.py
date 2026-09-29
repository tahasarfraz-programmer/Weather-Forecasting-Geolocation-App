"""Provider adapter: the only module that knows Open-Meteo's URLs and raw shapes."""
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from .analytics import FORECAST_DAYS, PAST_DAYS

TIMEOUT = 10

CURRENT = ("temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,"
           "cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m")
HOURLY = ("temperature_2m,precipitation_probability,weather_code,wind_speed_10m,"
          "visibility,uv_index,dew_point_2m")
DAILY = ("weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,sunrise,"
         "sunset,precipitation_probability_max,wind_speed_10m_max,uv_index_max")


class ProviderError(Exception):
    pass


def _get(base, params):
    url = f"{base}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Weatherly/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise ProviderError(str(exc)) from exc


def search_locations(query, count=6):
    data = _get(settings.OPEN_METEO_GEOCODING_URL, {"name": query, "count": count, "language": "en"})
    out = []
    for r in data.get("results") or []:
        if isinstance(r.get("latitude"), (int, float)) and isinstance(r.get("longitude"), (int, float)):
            out.append({"name": r.get("name", ""), "region": r.get("admin1", ""),
                        "country": r.get("country", ""), "lat": r["latitude"], "lon": r["longitude"]})
    return out


def fetch_forecast(lat, lon, temp_unit, wind_unit):
    data = _get(settings.OPEN_METEO_FORECAST_URL, {
        "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_days": 7,
        "temperature_unit": temp_unit, "wind_speed_unit": wind_unit,
        "current": CURRENT, "hourly": HOURLY, "daily": DAILY,
    })
    if not all(isinstance(data.get(k), dict) for k in ("current", "hourly", "daily")):
        raise ProviderError("Malformed forecast response")
    return data


def fetch_history(lat, lon, temp_unit, wind_unit):
    data = _get(settings.OPEN_METEO_FORECAST_URL, {
        "latitude": lat, "longitude": lon, "timezone": "auto",
        "past_days": PAST_DAYS, "forecast_days": FORECAST_DAYS,
        "temperature_unit": temp_unit, "wind_speed_unit": wind_unit,
        "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max",
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
    })
    if not all(isinstance(data.get(k), dict) for k in ("daily", "hourly")):
        raise ProviderError("Malformed history response")
    return data


def fetch_air(lat, lon):
    data = _get(settings.OPEN_METEO_AIR_URL, {
        "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_days": 3,
        "current": "us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide",
        "hourly": "us_aqi,pm2_5,pm10",
    })
    if not isinstance(data.get("hourly"), dict):
        raise ProviderError("Malformed air-quality response")
    return data


def reverse_geocode(lat, lon):
    """Uses the free OpenWeatherMap geocoding endpoint when a key is configured."""
    if not settings.OWM_API_KEY:
        return None
    try:
        rows = _get("https://api.openweathermap.org/geo/1.0/reverse",
                    {"lat": lat, "lon": lon, "limit": 1, "appid": settings.OWM_API_KEY})
    except ProviderError:
        return None
    if isinstance(rows, list) and rows and rows[0].get("name"):
        return {"name": rows[0]["name"], "region": rows[0].get("state", ""), "country": rows[0].get("country", "")}
    return None


def fetch_tile(layer, z, x, y):
    url = f"https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid={settings.OWM_API_KEY}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Weatherly/1.0"}),
                                    timeout=TIMEOUT) as r:
            return r.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ProviderError("tile fetch failed") from exc
