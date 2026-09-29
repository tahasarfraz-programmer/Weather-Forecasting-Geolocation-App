from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase
from django.urls import reverse

from core import providers

FAKE = {"current": {"time": "2026-09-29T12:00"}, "hourly": {}, "daily": {}}


class ApiTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_index_renders(self):
        r = self.client.get(reverse("index"))
        self.assertContains(r, "WEATHERLY")

    def test_forecast_rejects_bad_params(self):
        self.assertEqual(self.client.get(reverse("forecast"), {"lat": "x", "lon": "1"}).status_code, 400)
        self.assertEqual(self.client.get(reverse("forecast"), {"lat": 95, "lon": 1}).status_code, 400)
        self.assertEqual(self.client.get(reverse("forecast"), {"lat": 1, "lon": 1, "temp": "kelvin"}).status_code, 400)

    def test_forecast_is_cached(self):
        with mock.patch.object(providers, "fetch_forecast", return_value=FAKE) as m:
            for _ in range(2):
                self.assertEqual(self.client.get(reverse("forecast"), {"lat": 29.4, "lon": 71.7}).status_code, 200)
            self.assertEqual(m.call_count, 1)

    def test_provider_failure_returns_502(self):
        with mock.patch.object(providers, "fetch_forecast", side_effect=providers.ProviderError("x")):
            self.assertEqual(self.client.get(reverse("forecast"), {"lat": 1, "lon": 1}).status_code, 502)

    def test_search_short_query_is_empty(self):
        self.assertEqual(self.client.get(reverse("search"), {"q": "a"}).json(), {"results": []})
