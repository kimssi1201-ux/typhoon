const GDACS_EVENTS_ENDPOINT = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBool(value) {
  return String(value || "").toLowerCase() === "true";
}

function alertRank(alertLevel) {
  const value = String(alertLevel || "").toLowerCase();
  if (value === "red") return 3;
  if (value === "orange") return 2;
  if (value === "green") return 1;
  return 0;
}

function parseEvent(feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const lon = asNumber(coordinates[0]);
  const lat = asNumber(coordinates[1]);
  const severity = properties.severitydata || {};
  const affectedCountries = Array.isArray(properties.affectedcountries)
    ? properties.affectedcountries.map((country) => country.countryname || country.iso3).filter(Boolean)
    : [];

  return {
    id: String(properties.eventid || ""),
    episodeId: String(properties.episodeid || ""),
    eventType: properties.eventtype || "TC",
    name: properties.eventname || properties.name || "Unnamed cyclone",
    title: properties.name || properties.description || "Tropical Cyclone",
    description: properties.htmldescription || properties.description || "",
    alertLevel: properties.alertlevel || "Unknown",
    alertScore: asNumber(properties.alertscore),
    isCurrent: asBool(properties.iscurrent),
    country: properties.country || affectedCountries.join(", "),
    affectedCountries,
    fromDate: properties.fromdate || null,
    toDate: properties.todate || null,
    modifiedAt: properties.datemodified || null,
    source: properties.source || "GDACS",
    sourceId: properties.sourceid || "",
    severityKmh: asNumber(severity.severity),
    severityText: severity.severitytext || "",
    severityUnit: severity.severityunit || "km/h",
    lat,
    lon,
    reportUrl: properties.url?.report || null,
    detailsUrl: properties.url?.details || null,
    geometryUrl: properties.url?.geometry || null,
  };
}

function sortEvents(events) {
  return events.sort((a, b) => {
    const currentDiff = Number(b.isCurrent) - Number(a.isCurrent);
    if (currentDiff) return currentDiff;
    const alertDiff = alertRank(b.alertLevel) - alertRank(a.alertLevel);
    if (alertDiff) return alertDiff;
    return String(b.modifiedAt || b.toDate || "").localeCompare(String(a.modifiedAt || a.toDate || ""));
  });
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const days = Math.min(Math.max(Number(requestUrl.searchParams.get("days") || 30), 1), 90);
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const gdacsUrl = new URL(GDACS_EVENTS_ENDPOINT);
  gdacsUrl.searchParams.set("eventlist", "TC");
  gdacsUrl.searchParams.set("fromdate", toIsoDate(from));
  gdacsUrl.searchParams.set("todate", toIsoDate(to));
  gdacsUrl.searchParams.set("alertlevel", "green;orange;red");
  gdacsUrl.searchParams.set("pagesize", "100");

  const response = await fetch(gdacsUrl.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "TyphoonRouteKorea/1.0"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    return Response.json({
      ok: false,
      source: "GDACS",
      status: response.status,
      message: "GDACS 전세계 열대저기압 자료 조회에 실패했습니다.",
      body: text.slice(0, 500)
    }, { status: response.status });
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return Response.json({
      ok: false,
      source: "GDACS",
      message: "GDACS 응답을 JSON으로 해석하지 못했습니다.",
      body: text.slice(0, 500)
    }, { status: 502 });
  }

  const events = sortEvents((payload.features || [])
    .map(parseEvent)
    .filter((event) => event.id && Number.isFinite(event.lat) && Number.isFinite(event.lon)));
  const active = events.filter((event) => event.isCurrent);
  const recent = events.filter((event) => !event.isCurrent);

  return Response.json({
    ok: true,
    source: "Global Disaster Alert and Coordination System, GDACS",
    requested: {
      days,
      fromdate: toIsoDate(from),
      todate: toIsoDate(to),
      eventlist: "TC"
    },
    count: events.length,
    activeCount: active.length,
    recentCount: recent.length,
    events,
    active,
    recent,
    updatedAt: new Date().toISOString()
  });
}
