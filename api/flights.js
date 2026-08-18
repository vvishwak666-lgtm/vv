// Vercel Serverless Function — proxies aviationstack's /flights endpoint,
// filtered to Air New Zealand (NZ) flights at Auckland (AKL).
//
// Kept server-side (not called directly from the browser) so the
// AVIATIONSTACK_API_KEY never appears in client-side code — the free plan
// only allows 100 requests/month, and an exposed key could be burned
// through by anyone poking around in dev tools.
//
// Usage: GET /api/flights?direction=departures  (or ?direction=arrivals)

export default async function handler(req, res) {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing AVIATIONSTACK_API_KEY environment variable" });
    return;
  }

  const direction = req.query.direction === "arrivals" ? "arrivals" : "departures";
  // aviationstack's /flights endpoint uses dep_iata/arr_iata depending on direction.
  const airportParam = direction === "departures" ? "dep_iata" : "arr_iata";

  const url = new URL("http://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set(airportParam, "AKL");
  url.searchParams.set("airline_iata", "NZ");
  url.searchParams.set("limit", "100");

  try {
    const upstream = await fetch(url.toString());
    const data = await upstream.json();

    if (data.error) {
      // aviationstack returns errors as 200 OK with an "error" object —
      // surface that clearly rather than pretending it succeeded.
      res.status(502).json({ error: data.error.message || "aviationstack API error" });
      return;
    }

    // Normalise to the shape the frontend expects (see mockFlights() in
    // main.tsx for the exact contract): flightNumber, route, scheduledTime,
    // estimatedTime, status, gate, direction.
    const flights = (data.data || []).map(f => {
      const leg = direction === "departures" ? f.departure : f.arrival;
      const otherLeg = direction === "departures" ? f.arrival : f.departure;
      const scheduled = leg?.scheduled || null;
      const estimated = leg?.estimated || leg?.actual || scheduled;
      return {
        flightNumber: f.flight?.iata || f.flight?.icao || "—",
        route: otherLeg?.iata || otherLeg?.icao || "—",
        scheduledTime: scheduled,
        estimatedTime: estimated,
        status: humanizeStatus(f.flight_status),
        gate: leg?.gate || null,
        direction
      };
    }).filter(f => f.scheduledTime); // drop entries with no usable time

    res.status(200).json({ flights, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to reach aviationstack" });
  }
}

function humanizeStatus(status) {
  switch (status) {
    case "scheduled": return "On time";
    case "active": return "Boarding";
    case "landed": return "Landed";
    case "cancelled": return "Cancelled";
    case "incident": return "Delayed";
    case "diverted": return "Delayed";
    default: return status ? status[0].toUpperCase() + status.slice(1) : "Unknown";
  }
}
