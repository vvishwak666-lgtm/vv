// GET /api/flights-all?direction=departures|arrivals&airline=QF
//
// Flights at Auckland (AKL) for ONE airline other than Air New Zealand. This is a new file:
// your existing /api/flights endpoint is not changed and still serves Air New Zealand.
//
// Returns exactly the same shape and wording as /api/flights:
//   {flights: [{flightNumber, route, scheduledTime, estimatedTime, status, gate, direction, bagClaim?}]}
//
// Env var (already in your Vercel project): AVIATIONSTACK_API_KEY
//
// Each call uses ONE AviationStack request. Responses are cached at Vercel's edge for
// 2 minutes, so many users opening the same airline share one request.

const AIRLINES = new Set(["NZ", "EK", "CZ", "SB"]);
const AIRPORT = "AKL";
const WINDOW_BACK_MS = 2 * 3600 * 1000;
const WINDOW_FORWARD_MS = 8 * 3600 * 1000;

function tzOffsetMs(utcMs, tz){
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(new Date(utcMs));
  const g = t => Number(parts.find(p => p.type === t).value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - utcMs;
}

// AviationStack writes airport LOCAL time but labels it "+00:00". Re-read it as local time
// in the airport's own time zone and return a true UTC ISO string.
export function localToISO(str, tz){
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(str || ""));
  if(!m) return null;
  const [Y, Mo, D, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] || "0"].map(Number);
  const wanted = Date.UTC(Y, Mo - 1, D, h, mi, s);
  if(!tz || tz === "UTC") return new Date(wanted).toISOString();
  let guess = wanted;
  try{
    for(let i = 0; i < 3; i++) guess = wanted - tzOffsetMs(guess, tz);
  }catch{
    return null; // unknown time zone name
  }
  return new Date(guess).toISOString();
}

// Same wording as api/flights.js so every airline reads the same in the app.
export function mapStatus(flightStatus, direction){
  switch(flightStatus){
    case "scheduled": return "On time";
    case "active": return direction === "arrivals" ? "In air" : "Boarding";
    case "landed": return "Landed";
    case "cancelled": return "Cancelled";
    case "incident": return "Delayed";
    case "diverted": return "Delayed";
    default: return flightStatus ? flightStatus[0].toUpperCase() + flightStatus.slice(1) : "Unknown";
  }
}

// aviationstack labels airport LOCAL time as "+00:00". api/flights.js strips that suffix so the
// browser reads it as local time; do exactly the same here so all airlines match.
export function stripFakeUtcOffset(iso){
  if(!iso) return iso;
  return iso.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, "");
}

export function toFlight(f, direction){
  const dep = direction === "departures";
  const leg = dep ? f.departure : f.arrival;
  const other = dep ? f.arrival : f.departure;
  if(!leg) return null;
  const scheduledTime = stripFakeUtcOffset(leg.scheduled || null);
  if(!scheduledTime) return null;
  const flightNumber = (f.flight && (f.flight.iata || f.flight.icao)) || "";
  if(!flightNumber) return null;
  const row = {
    flightNumber,
    route: (other && (other.iata || other.icao)) || "—",
    scheduledTime,
    estimatedTime: stripFakeUtcOffset(leg.estimated || leg.actual || leg.scheduled || null),
    status: mapStatus(f.flight_status, direction),
    gate: leg.gate || null,
    direction
  };
  if(!dep && leg.baggage) row.bagClaim = String(leg.baggage);
  // true UTC instant, used only to keep flights inside the time window (not sent to the app)
  return {row, instant: localToISO(leg.scheduled, leg.timezone)};
}

async function callUpstream(params){
  const qs = new URLSearchParams(params).toString();
  let last;
  // HTTPS first (paid plans); AviationStack's free plan only allows HTTP.
  for(const scheme of ["https", "http"]){
    try{
      const r = await fetch(`${scheme}://api.aviationstack.com/v1/flights?${qs}`);
      const j = await r.json();
      if(j && Array.isArray(j.data)) return j.data;
      last = j && j.error;
    }catch(e){ last = e; }
  }
  throw new Error(typeof last === "object" && last && last.message ? last.message : "upstream");
}

export default async function handler(req, res){
  if(req.method !== "GET") return res.status(405).json({error: "Method not allowed."});
  const direction = req.query && req.query.direction === "arrivals" ? "arrivals" : "departures";
  const airline = String((req.query && req.query.airline) || "").toUpperCase();
  if(!AIRLINES.has(airline)) return res.status(400).json({error: "Unknown airline."});
  const key = process.env.AVIATIONSTACK_API_KEY;
  if(!key) return res.status(500).json({error: "Flight data isn't set up."});

  let data;
  try{
    data = await callUpstream({
      access_key: key,
      airline_iata: airline,
      [direction === "departures" ? "dep_iata" : "arr_iata"]: AIRPORT,
      limit: "100"
    });
  }catch{
    return res.status(502).json({error: "Couldn't load flight status."});
  }

  const now = Date.now();
  const seen = new Set();
  const flights = [];
  for(const f of data){
    if(f.flight && f.flight.codeshared) continue; // the operating airline's own entry is enough
    const r = toFlight(f, direction);
    if(!r) continue;
    const t = r.instant ? Date.parse(r.instant) : NaN;
    if(!(t >= now - WINDOW_BACK_MS && t <= now + WINDOW_FORWARD_MS)) continue;
    const k = r.row.flightNumber + "|" + r.row.scheduledTime;
    if(seen.has(k)) continue;
    seen.add(k);
    flights.push({row: r.row, t});
  }
  flights.sort((a, b) => a.t - b.t);

  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  return res.status(200).json({flights: flights.map(x => x.row), fetchedAt: new Date().toISOString()});
}
