<<<<<<< HEAD
# Weatherly
### Weather intelligence, beautifully designed.

A Django weather and geolocation app: live forecasts, global search, weather-reactive
hero, hourly/7-day views, saved locations, unit and theme settings.

## Design
The sky is the interface: the whole page background is a live sky that follows the real weather and
time of day (clear, dusk, night, cloud, rain, storm, snow, fog), with the sun or moon placed on its
daily arc. Navigation is a floating dock, places and commands live in a command palette (Ctrl/Cmd+K),
and the hourly forecast is one scrubbable curve. Themes: Live sky, Midnight, Paper (light).
Fonts (Bricolage Grotesque, Figtree) load from Google Fonts; system fonts are the fallback.

## Features
- **Dashboard** – live conditions, weather-reactive hero, 24 h chart, 7-day range bars, sun cycle.
- **Analytics** – 30-day history + forecast: temperature band with 7-day average, mean/σ/anomaly,
  linear trend, cumulative precipitation, wind rose, temperature-vs-humidity correlation, 72 h air
  quality, plain-language insights. Statistics are computed in Python (`core/analytics.py`, unit-tested).
- **Weather map** – Leaflet + OpenStreetMap, live rain radar (RainViewer, no key), optional
  OpenWeatherMap layers (clouds, precipitation, temperature, wind, pressure), click-to-pick location.
- **Locations dashboard** – saved places with live temperature, rename, reorder.
- Search (Ctrl/Cmd+K), geolocation, light/dark/system themes, units, reduced motion, stale-data badge.

## API keys
| Service | Key | Used for |
|---|---|---|
| Open-Meteo | none | forecast, history, air quality, geocoding |
| RainViewer | none | radar overlay |
| OpenWeatherMap (free tier) | optional `OWM_API_KEY` | map layers, GPS place names |

Keys stay on the server: OWM tiles are proxied through `/tiles/...`.

## Architecture
```
Browser (Chart.js, Leaflet)  ->  Django views (validate + cache)  ->  providers.py  ->  Open-Meteo / OWM
                                          └-> analytics.py (pure statistics)
```

## Setup
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: ..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env    # optional: add OWM_API_KEY for extra map layers
python manage.py runserver
```
Open http://127.0.0.1:8000

## Tests
```bash
python manage.py test
```

## Production
Set `DJANGO_DEBUG=0`, a real `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS`, then
`python manage.py collectstatic` and serve with gunicorn (`gunicorn weatherly.wsgi`) behind
a static-file server such as WhiteNoise or nginx.

## Layout
`weatherly/` project settings · `core/` views, provider adapter, tests · `core/templates/` page ·
`core/static/core/` CSS (`weatherly.css`), app (`app.js`), charts and map (`analytics.js`).

## Limitations
Without `OWM_API_KEY`, GPS locations are labelled "My location". Charts and map need internet (Chart.js/Leaflet load from cdnjs). Historical values are model reanalysis, not station data.
Data: Open-Meteo, map: © OpenStreetMap contributors.

## License
MIT
=======
# Weather-Forecasting-Geolocation-App
>>>>>>> a2e8079401820a22ec540afc53312b47f82c73cb
