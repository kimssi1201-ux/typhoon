const MARINE_ENDPOINT = "https://marine-api.open-meteo.com/v1/marine";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const lat = bounded(requestUrl.searchParams.get("lat"), 35.1587, 30, 40);
  const lon = bounded(requestUrl.searchParams.get("lon"), 129.1604, 120, 135);
  const upstreamUrl = new URL(MARINE_ENDPOINT);
  upstreamUrl.searchParams.set("latitude", lat);
  upstreamUrl.searchParams.set("longitude", lon);
  upstreamUrl.searchParams.set("current", "wave_height,wave_direction,wave_period,sea_surface_temperature,wind_wave_height");
  upstreamUrl.searchParams.set("hourly", "wave_height,wave_direction,wave_period,sea_surface_temperature,wind_wave_height");
  upstreamUrl.searchParams.set("forecast_days", "2");
  upstreamUrl.searchParams.set("timezone", "Asia/Seoul");
  try {
    const response = await fetch(upstreamUrl, { headers: { accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || data.error || !data.current) return json({ ok: false, message: data.reason || "해양 자료를 받을 수 없습니다." }, 502);
    return json({ ok: true, source: "Open-Meteo Marine", coordinates: { lat, lon }, current: data.current, hourly: data.hourly || {}, units: data.current_units || {}, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, message: "해양 자료 연결에 실패했습니다.", detail: error.message }, 502);
  }
}
