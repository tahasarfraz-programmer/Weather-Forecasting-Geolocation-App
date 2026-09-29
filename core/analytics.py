"""Pure statistics for the analytics dashboard. No Django imports."""
import math
from statistics import mean, pstdev

PAST_DAYS = 30
FORECAST_DAYS = 7
DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def clean(xs):
    return [x for x in xs if _num(x)]


def summarize(xs):
    v = clean(xs)
    return {"mean": mean(v), "min": min(v), "max": max(v), "std": pstdev(v)} if v else None


def slope(xs):
    """Least-squares slope per index step."""
    pts = [(i, x) for i, x in enumerate(xs) if _num(x)]
    if len(pts) < 3:
        return None
    mx = sum(p[0] for p in pts) / len(pts)
    my = sum(p[1] for p in pts) / len(pts)
    den = sum((p[0] - mx) ** 2 for p in pts)
    return sum((p[0] - mx) * (p[1] - my) for p in pts) / den if den else None


def pearson(xs, ys):
    pts = [(x, y) for x, y in zip(xs, ys) if _num(x) and _num(y)]
    if len(pts) < 5:
        return None
    mx = sum(p[0] for p in pts) / len(pts)
    my = sum(p[1] for p in pts) / len(pts)
    sx = math.sqrt(sum((p[0] - mx) ** 2 for p in pts))
    sy = math.sqrt(sum((p[1] - my) ** 2 for p in pts))
    if sx == 0 or sy == 0:
        return None
    return sum((p[0] - mx) * (p[1] - my) for p in pts) / (sx * sy)


def moving_average(xs, w=7):
    out = []
    for i in range(len(xs)):
        win = clean(xs[max(0, i - w + 1): i + 1])
        out.append(round(mean(win), 1) if win else None)
    return out


def wind_rose(speeds, directions):
    counts, sums = [0] * 8, [0.0] * 8
    for s, d in zip(speeds, directions):
        if _num(s) and _num(d):
            b = int(((d % 360) + 22.5) // 45) % 8
            counts[b] += 1
            sums[b] += s
    total = sum(counts) or 1
    return {"labels": DIRS,
            "share": [round(100 * c / total, 1) for c in counts],
            "avg": [round(sums[i] / counts[i], 1) if counts[i] else 0 for i in range(8)]}


def aqi_label(v):
    if not _num(v):
        return "Not available"
    for limit, name in ((50, "Good"), (100, "Moderate"), (150, "Unhealthy for sensitive groups"),
                        (200, "Unhealthy"), (300, "Very unhealthy")):
        if v <= limit:
            return name
    return "Hazardous"


def describe_corr(r):
    a = abs(r)
    strength = ("negligible" if a < .2 else "weak" if a < .4 else "moderate" if a < .6
                else "strong" if a < .8 else "very strong")
    return strength + (" negative" if r < 0 else " positive") if a >= .2 else strength


def _r1(v):
    return round(v, 1) if _num(v) else None


def build_report(raw, air, temp_unit="celsius", wind_unit="kmh"):
    d, h = raw["daily"], raw["hourly"]
    times = d.get("time", [])
    n_past = max(len(times) - FORECAST_DAYS, 0)
    unit = "°F" if temp_unit == "fahrenheit" else "°C"
    wu = {"kmh": "km/h", "mph": "mph", "ms": "m/s"}[wind_unit]
    tmean = d.get("temperature_2m_mean", [])
    precip = d.get("precipitation_sum", [])
    wind = d.get("wind_speed_10m_max", [])
    past_t = tmean[:n_past]
    st = summarize(past_t)
    sl = slope(past_t)
    today = tmean[n_past] if len(tmean) > n_past else None
    anomaly = today - st["mean"] if st and _num(today) else None
    past_p = clean(precip[:n_past])
    rain_days = sum(1 for p in past_p if p >= 1)
    cum, run = [], 0.0
    for p in precip[:n_past]:
        run += p if _num(p) else 0
        cum.append(round(run, 1))

    ph = n_past * 24  # hourly analysis limited to complete past days
    ht, hu = h.get("temperature_2m", [])[:ph], h.get("relative_humidity_2m", [])[:ph]
    r = pearson(ht, hu)
    rose = wind_rose(h.get("wind_speed_10m", [])[:ph], h.get("wind_direction_10m", [])[:ph])
    scatter = [{"x": _r1(t), "y": u} for t, u in list(zip(ht, hu))[::3] if _num(t) and _num(u)]

    now_air = (air or {}).get("current") or {}
    aqi = now_air.get("us_aqi")
    report_air = None
    if air and isinstance(air.get("hourly"), dict) and air["hourly"].get("time"):
        ah = air["hourly"]
        report_air = {"time": ah["time"], "aqi": ah.get("us_aqi", []), "pm25": ah.get("pm2_5", []),
                      "pm10": ah.get("pm10", []), "label": aqi_label(aqi)}

    insights = []
    if sl is not None:
        if abs(sl) < 0.05:
            insights.append("Temperatures have been steady over the last %d days." % n_past)
        else:
            insights.append("Temperatures have been %s by about %.2f%s per day over the last %d days."
                            % ("rising" if sl > 0 else "falling", abs(sl), unit, n_past))
    if anomaly is not None:
        insights.append("Today's average is %.1f%s %s than the %d-day mean."
                        % (abs(anomaly), unit, "warmer" if anomaly >= 0 else "cooler", n_past))
    if past_p:
        insights.append("%d rainy days (≥1 mm) with %.1f mm in total over the last %d days."
                        % (rain_days, sum(past_p), n_past))
    if r is not None:
        insights.append("Temperature and humidity show a %s relationship (r = %.2f)." % (describe_corr(r), r))
    if _num(aqi):
        insights.append("Current US AQI is %d (%s)." % (aqi, aqi_label(aqi)))

    return {
        "unit": unit, "wind_unit": wu, "n_past": n_past,
        "kpis": {"mean": _r1(st["mean"]) if st else None, "anomaly": _r1(anomaly),
                 "trend": round(sl, 2) if sl is not None else None,
                 "precip": round(sum(past_p), 1), "rain_days": rain_days,
                 "max_wind": _r1(max(clean(wind[:n_past]), default=None)),
                 "aqi": aqi if _num(aqi) else None, "aqi_label": aqi_label(aqi),
                 "std": _r1(st["std"]) if st else None},
        "insights": insights,
        "daily": {"time": times, "tmax": d.get("temperature_2m_max", []), "tmin": d.get("temperature_2m_min", []),
                  "tmean": tmean, "ma7": moving_average(tmean), "precip": precip, "cum_precip": cum,
                  "wind": wind},
        "windrose": rose, "scatter": {"points": scatter, "r": _r1(r) if r is None else round(r, 2)},
        "air": report_air,
    }
