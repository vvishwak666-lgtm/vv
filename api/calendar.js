// GET /api/calendar?s=2026-10-05:0500-1230,2026-10-06:0500-0900:1300-1700&tz=Pacific/Auckland&t=Work%20shift
//
// Returns a calendar file (.ics) for the shifts listed in the link. Opening this link on a phone
// makes the phone offer to add the events (iPhone: use it as webcal://… to get "Subscribe",
// or https://… to get "Add to Calendar").
//
// The link carries ONLY dates and shift times that the person already chose to send; nothing is
// looked up and nothing is stored. The input is validated strictly and the response is plain
// calendar text, never HTML.

import {buildIcs} from "../src/vvGeneral.js";

const MAX_PARAM_CHARS = 20000;
const MAX_ENTRIES = 300;

export default function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  if(req.method !== "GET" && req.method !== "HEAD") return res.status(405).send("Method not allowed");
  const q = req.query || {};
  const raw = String(q.s || "");
  if(!raw || raw.length > MAX_PARAM_CHARS) return res.status(400).send("Missing or too long.");

  const entries = [];
  for(const part of raw.split(",").slice(0, MAX_ENTRIES)){
    const m = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{4})(?::(\d{4}-\d{4}))?$/.exec(part.trim());
    if(!m) continue;
    entries.push({id: m[1], date: m[1], amShift: m[2], pmShift: m[3] || "0000-0000"});
  }
  if(!entries.length) return res.status(400).send("No valid shifts.");

  let tz = String(q.tz || "Pacific/Auckland");
  try{ new Intl.DateTimeFormat("en-US", {timeZone: tz}); }catch{ tz = "Pacific/Auckland"; }
  const title = String(q.t || "Work shift").replace(/[^\p{L}\p{N} .,'-]/gu, "").trim().slice(0, 40) || "Work shift";

  const {text, count} = buildIcs(entries, {timeZone: tz, title});
  if(!count) return res.status(400).send("No valid shifts.");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="vv-roster.ics"');
  return res.status(200).send(req.method === "HEAD" ? "" : text);
}
