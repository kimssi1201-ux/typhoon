const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

const CITIES = {
  서울: { lat: 37.5665, lon: 126.978, name: "서울" },
  인천: { lat: 37.4563, lon: 126.7052, name: "인천" },
  대전: { lat: 36.3504, lon: 127.3845, name: "대전" },
  대구: { lat: 35.8714, lon: 128.6014, name: "대구" },
  광주: { lat: 35.1595, lon: 126.8526, name: "광주" },
  부산: { lat: 35.1796, lon: 129.0756, name: "부산" },
  울산: { lat: 35.5384, lon: 129.3114, name: "울산" },
  제주: { lat: 33.4996, lon: 126.5312, name: "제주" }
};

const CURRENT_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m"
].join(",");

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const cityName = requestUrl.searchParams.get("city") || "서울";
  const city = CITIES[cityName] || CITIES.서울;
  const upstreamUrl = new URL(WEATHER_ENDPOINT);
  upstreamUrl.searchParams.set("latitude", city.lat);
  upstreamUrl.searchParams.set("longitude", city.lon);
  upstreamUrl.searchParams.set("current", CURRENT_VARIABLES);
  upstreamUrl.searchParams.set("wind_speed_unit", "ms");
  upstreamUrl.searchParams.set("temperature_unit", "celsius");
  upstreamUrl.searchParams.set("precipitation_unit", "mm");
  upstreamUrl.searchParams.set("timezone", "Asia/Seoul");

  try {
    const response = await fetch(upstreamUrl, {
      headers: { accept: "application/json" }
    });
    const data = await response.json();
    if (!response.ok || data.error || !data.current) {
      return json({ ok: false, message: data.reason || "현재 날씨 자료를 받을 수 없습니다." }, 502);
    }
    return json({
      ok: true,
      city,
      current: data.current,
      units: data.current_units || {},
      source: "Open-Meteo"
    });
  } catch (error) {
    return json({ ok: false, message: "현재 날씨 자료 연결에 실패했습니다.", detail: error.message }, 502);
  }
}
