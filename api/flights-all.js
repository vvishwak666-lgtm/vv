// GET /api/flights-all?direction=departures|arrivals&airline=QF
//
// Flights at Auckland (AKL) for ONE airline other than Air New Zealand. This is a new file:
// your existing /api/flights endpoint is not changed and still serves Air New Zealand.
//
// Returns the same shape the app already reads:
//   {flights: [{flightNumber, route, scheduledTime, estimatedTime, gate, status, bagClaim?}]}
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

export function mapStatus(flightStatus, delayMin){
  switch(String(flightStatus || "").toLowerCase()){
    case "cancelled": return "Cancelled";
    case "diverted": return "Diverted";
    case "incident": return "Incident";
    case "landed": return "Landed";
    case "active": return "In air";
    default: return Number(delayMin) >= 15 ? "Delayed" : "On time";
  }
}

export function toFlight(f, direction){
  const dep = direction === "departures";
  const leg = dep ? f.departure : f.arrival;
  const other = dep ? f.arrival : f.departure;
  if(!leg) return null;
  const scheduledTime = localToISO(leg.scheduled, leg.timezone);
  if(!scheduledTime) return null;
  const number = (f.flight && f.flight.iata) || ((f.airline && f.airline.iata || "") + (f.flight && f.flight.number || ""));
  if(!number) return null;
  const status = mapStatus(f.flight_status === "active" && dep ? "active" : f.flight_status, leg.delay);
  const out = {
    flightNumber: number,
    route: (other && other.iata) || "",
    scheduledTime,
    estimatedTime: localToISO(leg.estimated || leg.scheduled, leg.timezone) || scheduledTime,
    gate: leg.gate || "",
    status: dep && status === "In air" ? "Departed" : status
  };
  if(!dep && leg.baggage) out.bagClaim = String(leg.baggage);
  return out;
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
    const row = toFlight(f, direction);
    if(!row) continue;
    const t = Date.parse(row.scheduledTime);
    if(!(t >= now - WINDOW_BACK_MS && t <= now + WINDOW_FORWARD_MS)) continue;
    const k = row.flightNumber + "|" + row.scheduledTime;
    if(seen.has(k)) continue;
    seen.add(k);
    flights.push(row);
  }
  flights.sort((a, b) => Date.parse(a.scheduledTime) - Date.parse(b.scheduledTime));

  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  return res.status(200).json({flights});
}
