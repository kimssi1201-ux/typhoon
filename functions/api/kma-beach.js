const KMA_BEACH_ENDPOINT = "https://apis.data.go.kr/1360000/BeachInfoservice";
const FORECAST_ISSUE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
    }
  });
}

function getItems(data) {
  const items = data?.response?.body?.items?.item || data?.response?.body?.items || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function kstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function previousDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function latestForecastBase(date = new Date()) {
  const current = kstParts(date);
  const latestHour = FORECAST_ISSUE_HOURS.filter((hour) => hour <= current.hour).pop();
  const baseDate = latestHour === undefined ? previousDate(current.year, current.month, current.day) : current;
  return {
    baseDate: `${baseDate.year}${pad(baseDate.month)}${pad(baseDate.day)}`,
    baseTime: `${pad(latestHour === undefined ? 23 : latestHour)}00`
  };
}

async function callKma(path, params, serviceKey) {
  const upstreamUrl = new URL(`${KMA_BEACH_ENDPOINT}/${path}`);
  upstreamUrl.searchParams.set("serviceKey", serviceKey);
  upstreamUrl.searchParams.set("pageNo", "1");
  upstreamUrl.searchParams.set("numOfRows", "100");
  upstreamUrl.searchParams.set("dataType", "JSON");
  Object.entries(params).forEach(([key, value]) => upstreamUrl.searchParams.set(key, String(value)));

  const response = await fetch(upstreamUrl, { headers: { accept: "application/json" } });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("기상청 응답을 읽지 못했습니다.");
  }
  const header = data?.response?.header || {};
  if (!response.ok) throw new Error(`기상청 자료 조회에 실패했습니다. (${response.status})`);
  if (header.resultCode === "03") return { items: [], resultCode: header.resultCode, resultMsg: header.resultMsg };
  if (header.resultCode !== "00") throw new Error(header.resultMsg || "기상청 자료 조회에 실패했습니다.");
  return { items: getItems(data), resultCode: header.resultCode, resultMsg: header.resultMsg };
}

function groupForecast(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = `${item.fcstDate || ""}${item.fcstTime || ""}`;
    if (!key) return;
    const row = grouped.get(key) || {
      time: key,
      date: item.fcstDate || "",
      hour: item.fcstTime || "",
      baseDate: item.baseDate || "",
      baseTime: item.baseTime || ""
    };
    row[item.category] = item.fcstValue;
    grouped.set(key, row);
  });
  return [...grouped.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export async function onRequestGet({ request, env }) {
  const serviceKey = env.KMA_BEACH_API_KEY;
  if (!serviceKey) return json({ ok: false, configured: false, message: "기상청 해수욕장 서비스 키가 아직 설정되지 않았습니다." }, 503);

  const requestUrl = new URL(request.url);
  const beachNum = Number(requestUrl.searchParams.get("beachNum"));
  if (!Number.isInteger(beachNum) || beachNum < 1 || beachNum > 1000) {
    return json({ ok: false, message: "해변 번호를 확인할 수 없습니다." }, 400);
  }

  const now = new Date();
  const current = kstParts(now);
  const date = `${current.year}${pad(current.month)}${pad(current.day)}`;
  const searchTime = `${date}${pad(current.hour)}${pad(current.minute)}`;
  const forecastBase = latestForecastBase(now);
  const requests = [
    ["wave", callKma("getWhBuoyBeach", { searchTime, beach_num: beachNum }, serviceKey)],
    ["waterTemperature", callKma("getTwBuoyBeach", { searchTime, beach_num: beachNum }, serviceKey)],
    ["tide", callKma("getTideInfoBeach", { Base_date: date, beach_num: beachNum }, serviceKey)],
    ["sun", callKma("getSunInfoBeach", { Base_date: date, beach_num: beachNum }, serviceKey)],
    ["forecast", callKma("getUltraSrtFcstBeach", { ...forecastBase, beach_num: beachNum }, serviceKey)]
  ];
  const results = await Promise.allSettled(requests.map(([, promise]) => promise));
  const data = Object.fromEntries(requests.map(([name], index) => [name, results[index].status === "fulfilled" ? results[index].value : { items: [], error: results[index].reason?.message || "자료 없음" }]));
  const wave = data.wave.items[0] || null;
  const waterTemperature = data.waterTemperature.items[0] || null;
  const tide = data.tide.items[0] || null;
  const sun = data.sun.items[0] || null;
  const forecastItems = groupForecast(data.forecast.items);
  if (!wave && !waterTemperature && !tide && !sun && !forecastItems.length) {
    return json({ ok: false, message: "선택한 해변의 기상청 자료가 아직 없습니다.", beachNum }, 502);
  }

  return json({
    ok: true,
    source: "기상청 전국 해수욕장 날씨 조회서비스",
    beachNum,
    current: {
      time: wave?.tm || waterTemperature?.tm || null,
      wave_height: numberOrNull(wave?.wh),
      sea_surface_temperature: numberOrNull(waterTemperature?.tw)
    },
    official: {
      wave: wave ? { time: wave.tm || null, height: numberOrNull(wave.wh) } : null,
      waterTemperature: waterTemperature ? { time: waterTemperature.tm || null, temperature: numberOrNull(waterTemperature.tw) } : null,
      tide: tide ? { station: tide.tiStnld || null, time: tide.tiTime || null, type: tide.tiType || null, level: tide.tilevel || null } : null,
      sun: sun ? { sunrise: sun.sunrise || null, sunset: sun.sunset || null } : null,
      forecast: {
        baseDate: forecastBase.baseDate,
        baseTime: forecastBase.baseTime,
        items: forecastItems
      }
    },
    fetchedAt: now.toISOString()
  });
}
