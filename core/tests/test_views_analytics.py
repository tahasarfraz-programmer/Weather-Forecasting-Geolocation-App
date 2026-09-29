from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.urls import reverse

from core import providers
from core.tests.test_analytics import ReportTests


class AnalyticsApiTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_analytics_ok_and_air_optional(self):
        raw = ReportTests().raw()
        with mock.patch.object(providers, "fetch_history", return_value=raw), \
             mock.patch.object(providers, "fetch_air", side_effect=providers.ProviderError("x")):
            r = self.client.get(reverse("analytics"), {"lat": 29.4, "lon": 71.7})
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()["air"])

    def test_analytics_bad_params(self):
        self.assertEqual(self.client.get(reverse("analytics"), {"lat": 1}).status_code, 400)

    @override_settings(OWM_API_KEY="")
    def test_tiles_disabled_without_key(self):
        self.assertEqual(self.client.get("/tiles/clouds_new/3/1/1.png").status_code, 404)

    @override_settings(OWM_API_KEY="k")
    def test_tiles_reject_unknown_layer(self):
        self.assertEqual(self.client.get("/tiles/evil/3/1/1.png").status_code, 404)
