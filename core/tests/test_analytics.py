import math
import unittest

from core import analytics as a


class StatsTests(unittest.TestCase):
    def test_slope_and_pearson(self):
        self.assertAlmostEqual(a.slope([1, 2, 3, 4, 5]), 1.0)
        self.assertAlmostEqual(a.pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1.0)
        self.assertAlmostEqual(a.pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1.0)
        self.assertIsNone(a.pearson([1, 1, 1, 1, 1], [1, 2, 3, 4, 5]))

    def test_nulls_are_ignored(self):
        self.assertAlmostEqual(a.slope([1, None, 3, 4]), 1.0, places=1)
        self.assertEqual(a.moving_average([None, None], 3), [None, None])

    def test_wind_rose_bins(self):
        r = a.wind_rose([10, 20, 30, 5], [0, 90, 350, None])
        self.assertEqual(r["labels"][0], "N")
        self.assertAlmostEqual(r["share"][0], 66.7, places=1)
        self.assertEqual(r["avg"][2], 20.0)

    def test_labels(self):
        self.assertEqual(a.aqi_label(42), "Good")
        self.assertEqual(a.aqi_label(160), "Unhealthy")
        self.assertEqual(a.aqi_label(None), "Not available")
        self.assertIn("negative", a.describe_corr(-0.9))


class ReportTests(unittest.TestCase):
    def raw(self):
        n = a.PAST_DAYS + a.FORECAST_DAYS
        days = ["2026-08-%02d" % (i % 28 + 1) for i in range(n)]
        hrs = n * 24
        return {"daily": {"time": days, "temperature_2m_max": [30 + i * .1 for i in range(n)],
                          "temperature_2m_min": [20] * n, "temperature_2m_mean": [25 + i * .2 for i in range(n)],
                          "precipitation_sum": [0, 2.0, None] * (n // 3) + [0] * (n % 3),
                          "wind_speed_10m_max": [12] * n},
                "hourly": {"temperature_2m": [20 + 10 * math.sin(i / 4) for i in range(hrs)],
                           "relative_humidity_2m": [70 - 20 * math.sin(i / 4) for i in range(hrs)],
                           "wind_speed_10m": [10] * hrs, "wind_direction_10m": [(i * 7) % 360 for i in range(hrs)]}}

    def test_full_report(self):
        rep = a.build_report(self.raw(), None, "celsius", "kmh")
        self.assertEqual(rep["n_past"], 30)
        self.assertGreater(rep["kpis"]["trend"], 0)
        self.assertLess(rep["scatter"]["r"], -0.9)
        self.assertIsNone(rep["air"])
        self.assertTrue(rep["insights"])
        self.assertEqual(len(rep["daily"]["cum_precip"]), 30)

    def test_air_and_units(self):
        air = {"current": {"us_aqi": 72}, "hourly": {"time": ["t"], "us_aqi": [72], "pm2_5": [10], "pm10": [20]}}
        rep = a.build_report(self.raw(), air, "fahrenheit", "mph")
        self.assertEqual(rep["unit"], "°F")
        self.assertEqual(rep["air"]["label"], "Moderate")

    def test_empty_data_does_not_crash(self):
        rep = a.build_report({"daily": {}, "hourly": {}}, None)
        self.assertIsNone(rep["kpis"]["mean"])


if __name__ == "__main__":
    unittest.main()
