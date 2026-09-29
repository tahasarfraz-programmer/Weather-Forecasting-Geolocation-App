/* Analytics dashboard (Chart.js), weather map (Leaflet) and saved-locations dashboard. */
let VIZ = [], MAP = null;
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const shortDate = t => new Date(t + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
const aqiColor = v => v <= 50 ? '#3fbf7f' : v <= 100 ? '#f2c94c' : v <= 150 ? '#f2994a' : v <= 200 ? '#eb5757' : v <= 300 ? '#9b51e0' : '#7b1e3a';

function destroyViz() { VIZ.forEach(c => c.destroy()); VIZ = []; if (MAP) { MAP.remove(); MAP = null; } }
function mk(id, cfg) { VIZ.push(new Chart(document.getElementById(id), cfg)); }

// ---------------- Analytics ----------------
function analyticsView() {
  return `<div id="an"><div class="sk" style="height:130px;margin-bottom:16px"></div><div class="sk" style="height:320px"></div></div>`;
}

async function initAnalytics() {
  const el = $('#an'), at = cur;
  if (!window.Chart) { el.innerHTML = errUI(['Charts could not load.', 'Chart.js is loaded from a CDN. Check your internet connection.'], 'Try again', 'retryan'); return; }
  try {
    const a = await jf(`/api/analytics/?lat=${cur.lat}&lon=${cur.lon}&temp=${S.temp}&wind=${S.wind}`);
    if (route !== 'analytics' || cur !== at) return;
    el.innerHTML = anHTML(a);
    drawCharts(a);
  } catch (e) {
    if (route === 'analytics') el.innerHTML = errUI(['Analytics are temporarily unavailable.', 'The weather provider did not respond. Try again in a moment.'], 'Try again', 'retryan');
  }
}

function anHTML(a) {
  const k = a.kpis, u = a.unit, f = (v, s = '') => v == null ? 'N/A' : v + s;
  const sign = v => v == null ? 'N/A' : (v > 0 ? '+' : '') + v;
  const kpi = (l, v, sub) => `<div class="kpi"><span class="muted">${l}</span><b>${v}</b><small class="muted">${sub}</small></div>`;
  return `<section class="card" aria-label="Key indicators"><h2>Overview · last ${a.n_past} days · ${esc(locLabel(cur))}</h2><div class="kpis">
${kpi('Mean temperature', f(k.mean, u), 'σ ' + f(k.std, u))}
${kpi('Today vs average', sign(k.anomaly) + (k.anomaly == null ? '' : u), 'departure from mean')}
${kpi('Trend', sign(k.trend) + (k.trend == null ? '' : u + '/day'), 'linear regression')}
${kpi('Precipitation', f(k.precip, ' mm'), k.rain_days + ' rainy days')}
${kpi('Peak wind', f(k.max_wind, ' ' + a.wind_unit), 'daily max')}
${kpi('Air quality', k.aqi == null ? 'N/A' : k.aqi, esc(k.aqi_label))}</div>
<h2 style="margin-top:22px">Insights</h2><ul class="ins">${a.insights.map(i => `<li>${esc(i)}</li>`).join('') || '<li class="muted">Not enough data for insights.</li>'}</ul></section>
<section class="card"><h2>Temperature · past ${a.n_past} days and 7-day forecast (dashed)</h2><div class="cv tall"><canvas id="c1" role="img" aria-label="Daily maximum, minimum and 7-day average temperature"></canvas></div></section>
<div class="grid"><section class="card"><h2>Precipitation</h2><div class="cv"><canvas id="c2" role="img" aria-label="Daily and cumulative precipitation"></canvas></div></section>
<section class="card"><h2>Wind rose · share of hours by direction</h2><div class="cv"><canvas id="c3" role="img" aria-label="Wind direction frequency"></canvas></div></section></div>
<div class="grid"><section class="card"><h2>Temperature vs humidity${a.scatter.r == null ? '' : ' · r = ' + a.scatter.r}</h2><div class="cv"><canvas id="c4" role="img" aria-label="Scatter of temperature against relative humidity"></canvas></div></section>
<section class="card"><h2>Air quality · next 72 hours (US AQI)</h2>${a.air ? '<div class="cv"><canvas id="c5" role="img" aria-label="Air quality index forecast"></canvas></div>' : '<p class="muted">Air quality data is not available for this location.</p>'}</section></div>
<p class="muted" style="font-size:12px">Historical values are model reanalysis from Open-Meteo, not station observations.</p>`;
}

function drawCharts(a) {
  Chart.defaults.color = cssv('--muted'); Chart.defaults.borderColor = cssv('--line');
  Chart.defaults.font.family = 'Manrope,Inter,system-ui,sans-serif'; Chart.defaults.maintainAspectRatio = false;
  const d = a.daily, labels = d.time.map(shortDate), np = a.n_past, acc = cssv('--cool'), warm = cssv('--warm');
  const fc = { borderDash: ctx => ctx.p0DataIndex >= np - 1 ? [6, 4] : undefined };
  const line = { pointRadius: 0, pointHoverRadius: 5, tension: .35, borderWidth: 2.5, segment: fc };
  mk('c1', { type: 'line', data: { labels, datasets: [
    { ...line, label: 'Max ' + a.unit, data: d.tmax, borderColor: warm },
    { ...line, label: 'Min ' + a.unit, data: d.tmin, borderColor: acc, fill: '-1', backgroundColor: acc + '22' },
    { ...line, label: '7-day average', data: d.ma7, borderColor: cssv('--text2'), borderWidth: 1.5 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } } } } });
  mk('c2', { data: { labels, datasets: [
    { type: 'bar', label: 'Daily mm', data: d.precip, backgroundColor: acc + 'aa', borderRadius: 4, yAxisID: 'y' },
    { type: 'line', label: 'Cumulative mm', data: d.cum_precip, borderColor: warm, pointRadius: 0, tension: .3, yAxisID: 'y1' }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: { beginAtZero: true }, y1: { position: 'right', beginAtZero: true, grid: { display: false } } } } });
  const wr = a.windrose;
  mk('c3', { type: 'polarArea', data: { labels: wr.labels, datasets: [{ data: wr.share, backgroundColor: wr.labels.map((_, i) => `hsla(${210 + i * 12},80%,62%,.6)`) }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.r}% of hours · avg ${wr.avg[c.dataIndex]} ${a.wind_unit}` } } }, scales: { r: { ticks: { display: false }, grid: { color: cssv('--line') } } } } });
  mk('c4', { type: 'scatter', data: { datasets: [{ label: 'Hourly', data: a.scatter.points, backgroundColor: acc + '77', pointRadius: 3 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'Temperature ' + a.unit } }, y: { title: { display: true, text: 'Relative humidity %' }, min: 0, max: 100 } } } });
  if (a.air) {
    const ax = a.air.time.map(t => t.slice(5, 10) + ' ' + t.slice(11, 13) + 'h');
    mk('c5', { type: 'line', data: { labels: ax, datasets: [{ label: 'US AQI', data: a.air.aqi, borderWidth: 2.5, pointRadius: 0, tension: .3, borderColor: acc,
      segment: { borderColor: c => aqiColor(c.p1.parsed.y) }, fill: true, backgroundColor: acc + '18' }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: { beginAtZero: true } } } });
  }
}

document.addEventListener('click', e => { if (e.target.closest('#retryan')) initAnalytics(); });

// ---------------- Weather map ----------------
function mapView() {
  return `<section class="panel"><div class="mapwrap"><div id="lmap" role="application" aria-label="Interactive weather map"></div><button class="ib maploc" id="loc2" aria-label="Use my location" title="Use my location"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg></button></div>
<p id="mapmsg" class="muted" style="margin-top:12px;font-size:14px">Click anywhere on the map to see the weather there. ${WX.owm ? '' : 'Add a free OpenWeatherMap key to <code>.env</code> to unlock cloud, precipitation, temperature, wind and pressure layers.'}</p></section>`;
}

async function initMap() {
  const el = $('#lmap');
  if (!window.L) {
    el.innerHTML = '<div class="err"><p>The map library could not load. Check your internet connection.</p><button class="btn" id="retry">Try again</button></div>';
    return;
  }
  try {
    const center = cur ? [cur.lat, cur.lon] : [25, 30], m = MAP = L.map(el).setView(center, cur ? 8 : 2);
    const paper = document.documentElement.dataset.t === 'paper';
    let errs = 0, fell = false;
    const osm = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const base = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${paper ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`, { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap contributors © CARTO' }).addTo(m);
    base.on('tileload', () => { errs = -999; });
    base.on('tileerror', () => {
      if (++errs < 3 || fell) return;
      fell = true; base.remove();
      L.tileLayer(osm, { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
      $('#mapmsg').textContent = 'Switched to the standard map style because the default tiles did not load.';
    });
    if (cur) {
      const t = data ? Math.round(data.j.current.temperature_2m) + '°' : '';
      L.marker(center, { icon: L.divIcon({ className: '', html: `<div class="pin">${t || '•'}</div>`, iconSize: [60, 46], iconAnchor: [30, 46] }) })
        .addTo(m).bindPopup(esc(locLabel(cur)));
    }
    const fix = () => MAP === m && m.invalidateSize();
    setTimeout(fix, 150); setTimeout(fix, 600); addEventListener('resize', fix);
    m.on('click', ev => setLoc({ name: 'Map point', region: '', country: '', lat: +ev.latlng.lat.toFixed(4), lon: +ev.latlng.lng.toFixed(4) }));

    const overlays = {}, ctl = () => {
      document.querySelectorAll('.leaflet-control-layers').forEach(n => n.remove());
      if (Object.keys(overlays).length) L.control.layers({}, overlays, { collapsed: false, position: 'topleft' }).addTo(m);
    };
    if (WX.owm) {
      [['clouds_new', 'Clouds'], ['precipitation_new', 'Precipitation'], ['temp_new', 'Temperature'], ['wind_new', 'Wind'], ['pressure_new', 'Pressure']]
        .forEach(([k, n]) => overlays[n] = L.tileLayer(`/tiles/${k}/{z}/{x}/{y}.png`, { opacity: .65, attribution: '© OpenWeatherMap' }));
      overlays['Clouds'].addTo(m);
    }
    ctl();
    try {
      const j = await jf('https://api.rainviewer.com/public/weather-maps.json'), fr = j.radar.past.at(-1);
      if (MAP !== m) return;
      overlays['Rain radar'] = L.tileLayer(`${j.host}${fr.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: .7, maxNativeZoom: 7, attribution: 'RainViewer' }).addTo(m);
      ctl();
    } catch (e) { /* radar is optional */ }
  } catch (e) {
    el.innerHTML = '<div class="err"><p>The map could not start on this device.</p><button class="btn" id="retry">Try again</button></div>';
  }
}

// ---------------- Saved-places dashboard ----------------
function enrichSaved() {
  saved.forEach(async (s, i) => {
    const el = document.querySelector(`[data-live="${i}"]`);
    if (!el) return;
    try {
      const { j } = await getWeather(s), c = j.current, [k, lab] = cond(c.weather_code);
      el.classList.remove('muted');
      el.innerHTML = `${wicon(k, c.is_day === 0)}<b>${Math.round(c.temperature_2m)}°</b><span>${esc(lab)}, wind ${Math.round(c.wind_speed_10m)} ${wu()}</span>`;
    } catch (e) { el.textContent = 'Live weather unavailable'; }
  });
}
