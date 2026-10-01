// VV general-roster helpers. Pure functions only (no React, no network) so they
// can be unit-tested. Shift format matches the existing app: "HHMM-HHMM", where a
// finish earlier than/equal to the start means the next calendar day.

// ---------- Roster-type presets ----------
export const ROSTER_TYPES = [
  {id: "airnz", label: "Air New Zealand", airNz: true},
  {id: "general", label: "Other company / general", airNz: false}
];

export function isAirNz(rosterType){ return (rosterType || "airnz") === "airnz"; }

// ---------- small date/time helpers ----------
const pad2 = n => String(n).padStart(2, "0");

export function isoAddDays(iso, n){
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "0500-1330" -> {startMin, endMin} where endMin may exceed 1440 (next day).
export function parseCompactRange(value){
  const m = String(value || "").replace(/[–—]/g, "-").match(/(\d{2})(\d{2})\s*-\s*(\d{2})(\d{2})/);
  if(!m) return null;
  const [sh, sm, eh, em] = [m[1], m[2], m[3], m[4]].map(Number);
  if(sh > 23 || eh > 23 || sm > 59 || em > 59) return null;
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if(endMin === startMin) return null; // zero-length placeholder like 0000-0000
  if(endMin < startMin) endMin += 1440;
  return {startMin, endMin};
}

// Minutes since 1970-01-01 00:00 for a local calendar date (DST-agnostic wall clock).
function dayIndex(iso){
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// ---------- shift segments for one roster entry ----------
// Mirrors how the app stores a day: amShift/pmShift (two slots) for dual-source
// entries, otherwise a single value in editableValue/canonicalValue/display/time.
export function entrySegments(e){
  if(!e || !e.date) return [];
  if(e.isDayOff) return [];
  const slots = [];
  if(e.amShift !== undefined || e.pmShift !== undefined){
    slots.push(e.amShift ?? "", e.pmShift ?? "");
  }else{
    const one = [e.editableValue, e.canonicalValue, e.display, e.rawCellText, e.time].find(v => parseCompactRange(v));
    if(one) slots.push(one);
  }
  const base = dayIndex(e.date) * 1440;
  const out = [];
  for(const s of slots){
    const r = parseCompactRange(s);
    if(r) out.push({date: e.date, id: e.id, start: base + r.startMin, end: base + r.endMin});
  }
  return out;
}

// ---------- rest / short-turnaround check ----------
// entries: one person's entries. minRestHours: user-set minimum gap between the end of
// one shift and the start of the next. Returns warnings (never blocks anything).
export function findRestWarnings(entries, minRestHours){
  const min = Number(minRestHours);
  if(!Number.isFinite(min) || min <= 0) return [];
  const segs = [];
  for(const e of entries || []) segs.push(...entrySegments(e));
  segs.sort((a, b) => a.start - b.start || a.end - b.end);
  const warnings = [];
  for(let i = 1; i < segs.length; i++){
    const prev = segs[i - 1], cur = segs[i];
    const gapMin = cur.start - prev.end;
    if(gapMin < 0){
      warnings.push({kind: "overlap", fromDate: prev.date, toDate: cur.date, gapHours: gapMin / 60, minRestHours: min});
    }else if(gapMin < min * 60){
      warnings.push({kind: "short", fromDate: prev.date, toDate: cur.date, gapHours: gapMin / 60, minRestHours: min});
    }
  }
  return warnings;
}

export function formatGap(hours){
  const sign = hours < 0 ? "-" : "";
  const total = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return `${sign}${h}h${m ? ` ${m}m` : ""}`;
}

// ---------- calendar export (.ics) ----------
function icsEscape(s){
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function icsFold(line){
  // RFC 5545: lines should be <= 75 octets; fold with CRLF + space.
  const out = [];
  let rest = line;
  while(rest.length > 74){ out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}
function icsLocal(iso, minutesFromMidnight){
  // floating local time anchored to TZID; minutesFromMidnight may exceed 1440.
  const day = minutesFromMidnight >= 1440 ? isoAddDays(iso, Math.floor(minutesFromMidnight / 1440)) : iso;
  const mm = minutesFromMidnight % 1440;
  return `${day.replace(/-/g, "")}T${pad2(Math.floor(mm / 60))}${pad2(mm % 60)}00`;
}

// entries: one person's entries. timeZone: IANA name (e.g. "Pacific/Auckland").
// No VALARM is added on purpose (the in-app alarm feature was removed).
export function buildIcs(entries, {timeZone = "Pacific/Auckland", calendarName = "VV Duty Roster", title = "Work shift", stamp = new Date()} = {}){
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VV Duty Roster//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    `X-WR-TIMEZONE:${timeZone}`
  ];
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  let count = 0;
  for(const e of entries || []){
    if(!e || !e.date || e.isDayOff) continue;
    const slots = (e.amShift !== undefined || e.pmShift !== undefined)
      ? [e.amShift, e.pmShift]
      : [[e.editableValue, e.canonicalValue, e.display, e.rawCellText, e.time].find(v => parseCompactRange(v))];
    slots.forEach((s, idx) => {
      const r = parseCompactRange(s);
      if(!r) return;
      const a = String(s).replace(/[–—]/g, "-").match(/(\d{2})(\d{2})\s*-\s*(\d{2})(\d{2})/);
      lines.push(
        "BEGIN:VEVENT",
        `UID:vv-${e.date}-${idx}-${r.startMin}@vv-duty-roster`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=${timeZone}:${icsLocal(e.date, r.startMin)}`,
        `DTEND;TZID=${timeZone}:${icsLocal(e.date, r.endMin)}`,
        `SUMMARY:${icsEscape(title)} ${a[1]}:${a[2]}-${a[3]}:${a[4]}`,
        "TRANSP:OPAQUE",
        "END:VEVENT"
      );
      count++;
    });
  }
  lines.push("END:VCALENDAR");
  return {text: lines.map(icsFold).join("\r\n") + "\r\n", count};
}

// ---------- name matching ----------
export function normName(name){
  return String(name || "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()\-_/]/g, " ").replace(/\s+/g, " ").trim();
}
function nameTokens(name){ return normName(name).split(" ").filter(Boolean); }

// 1 = same set of tokens (handles "SURNAME, First" vs "First Surname"), 0 = unrelated.
export function nameMatchScore(a, b){
  const ta = nameTokens(a), tb = nameTokens(b);
  if(!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const hit = ta.filter(t => setB.has(t) || tb.some(u => u.length > 3 && t.length > 3 && editDistance(t, u) <= 1)).length;
  const score = hit / Math.max(ta.length, tb.length);
  if(ta.length === tb.length && hit === ta.length) return 1;
  return score;
}
function editDistance(a, b){
  const m = a.length, n = b.length;
  const dp = Array.from({length: m + 1}, (_, i) => [i, ...Array(n).fill(0)]);
  for(let j = 1; j <= n; j++) dp[0][j] = j;
  for(let i = 1; i <= m; i++)
    for(let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

// ---------- general shift-cell parsing ----------
// Accepts "0600-1430", "06:00-14:30", "6am-2:30pm", "6.00 - 14.30". Returns "HHMM-HHMM" or null.
export function parseShiftCellToCompact(text){
  const raw = String(text || "").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const m = raw.match(/(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm|a|p)?\s*(?:-|to|till|until)\s*(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm|a|p)?/);
  if(!m) return null;
  const conv = (h, mi, ap) => {
    let hh = Number(h), mm = Number(mi || 0);
    if(ap){ const pm = ap.startsWith("p"); if(pm && hh < 12) hh += 12; if(!pm && hh === 12) hh = 0; }
    if(hh > 23 || mm > 59) return null;
    return `${pad2(hh)}${pad2(mm)}`;
  };
  const s = conv(m[1], m[2], m[3]);
  // if only the end has am/pm and start does not, inherit sensibly (e.g. "6-2pm" -> 06:00-14:00)
  const e = conv(m[4], m[5], m[6]);
  if(!s || !e) return null;
  return `${s}-${e}`;
}

const OFF_CODES = ["RDO", "OFF", "AL", "ALV", "ALLV", "ALTH", "HACC", "SICK", "SL", "LEAVE", "TRNG", "PH", "X", "-"];
export function classifyCell(text, shiftTypes = {}){
  const t = String(text ?? "").trim();
  if(!t) return {kind: "empty"};
  const compact = parseShiftCellToCompact(t);
  if(compact) return {kind: "shift", compact};
  const key = t.toUpperCase();
  if(shiftTypes[key]) return {kind: "shift", compact: shiftTypes[key], code: key};
  if(OFF_CODES.includes(key)) return {kind: "off", code: key === "-" || key === "X" ? "OFF" : key};
  return {kind: "unknown", text: t.slice(0, 20)};
}

// ---------- spreadsheet header-date parsing ----------
const MONTHS = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12};
export function parseHeaderDate(cell, hintYear){
  if(cell instanceof Date && !isNaN(cell)) return `${cell.getFullYear()}-${pad2(cell.getMonth() + 1)}-${pad2(cell.getDate())}`;
  if(typeof cell === "number" && cell > 40000 && cell < 80000){ // excel serial
    const d = new Date(Math.round((cell - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const s = String(cell ?? "").trim().toLowerCase();
  if(!s) return null;
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2,4}))?/); // d/m[/y] (NZ/UK order)
  if(m){
    const d = Number(m[1]), mo = Number(m[2]);
    let y = m[3] ? Number(m[3]) : hintYear;
    if(y < 100) y += 2000;
    if(d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,4})[a-z]*(?:\s+(\d{4}))?/);
  if(m && MONTHS[m[2]]) return `${m[3] || hintYear}-${pad2(MONTHS[m[2]])}-${pad2(m[1])}`;
  m = s.match(/([a-z]{3,4})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/);
  if(m && MONTHS[m[1]]) return `${m[3] || hintYear}-${pad2(MONTHS[m[1]])}-${pad2(m[2])}`;
  return null;
}

// Find the user's row in a grid (array of arrays) and return only that person's shifts.
// Handles the common layout: names down the left, dates across a header row.
// Returns {status:"ok"|"not_found"|"no_dates"|"ambiguous", shifts, matchedName, candidates}
// `candidates` only ever holds names that closely resemble the user's own name.
export function extractMyRowFromGrid(grid, myName, {hintYear = new Date().getFullYear(), shiftTypes = {}, pickRow = null} = {}){
  if(!Array.isArray(grid) || !grid.length) return {status: "not_found", shifts: []};
  // 1. locate candidate rows
  const hits = [];
  grid.forEach((row, r) => {
    (row || []).forEach((cell, c) => {
      if(typeof cell === "number" || cell instanceof Date) return;
      const txt = String(cell ?? "").trim();
      if(txt.length < 2 || txt.length > 60) return;
      const score = nameMatchScore(myName, txt);
      if(score >= 0.99) hits.push({r, c, score, name: txt});
      else if(score >= 0.67) hits.push({r, c, score, name: txt, weak: true});
    });
  });
  if(!hits.length) return {status: "not_found", shifts: []};
  const strong = hits.filter(h => !h.weak);
  let chosen;
  if(pickRow !== null){ chosen = hits.find(h => h.r === pickRow); }
  else if(strong.length === 1) chosen = strong[0];
  else if(strong.length === 0 && hits.length === 1) chosen = hits[0];
  else if(strong.length > 1){
    // same name appearing in multiple places (e.g. repeated weeks) is fine if they all agree;
    // otherwise ask the user.
    return {status: "ambiguous", shifts: [], candidates: strong.map(h => ({row: h.r, name: h.name}))};
  }else return {status: "ambiguous", shifts: [], candidates: hits.map(h => ({row: h.r, name: h.name}))};
  if(!chosen) return {status: "not_found", shifts: []};

  // 2. find header row above with the most parseable dates
  let best = null;
  for(let r = chosen.r - 1; r >= Math.max(0, chosen.r - 40); r--){
    const row = grid[r] || [];
    const dates = {};
    row.forEach((cell, c) => { const d = parseHeaderDate(cell, hintYear); if(d) dates[c] = d; });
    const n = Object.keys(dates).length;
    if(n >= 5 && (!best || n > best.n)){ best = {r, dates, n}; if(n >= 7) break; }
  }
  if(!best) return {status: "no_dates", shifts: [], matchedName: chosen.name};

  // 3. read ONLY this row
  const row = grid[chosen.r] || [];
  const shifts = [];
  for(const [colStr, date] of Object.entries(best.dates)){
    const cls = classifyCell(row[Number(colStr)], shiftTypes);
    if(cls.kind === "shift") shifts.push({date, start: cls.compact.slice(0, 4), end: cls.compact.slice(5), code: cls.code || ""});
    else if(cls.kind === "off") shifts.push({date, code: cls.code});
  }
  shifts.sort((a, b) => a.date.localeCompare(b.date));
  return {status: shifts.length ? "ok" : "not_found", shifts, matchedName: chosen.name};
}

// ---------- validating what the AI returns (never trust it blindly) ----------
export function sanitizeScanResult(raw, {today} = {}){
  const out = {found: false, ambiguous: false, matchedName: "", candidates: [], shifts: [], notes: ""};
  if(!raw || typeof raw !== "object") return out;
  out.found = !!raw.found;
  out.ambiguous = !!raw.ambiguous;
  out.matchedName = String(raw.matchedName || "").slice(0, 80);
  out.notes = String(raw.notes || "").slice(0, 200);
  if(Array.isArray(raw.candidates)) out.candidates = raw.candidates.slice(0, 5).map(x => String(x?.name ?? x).slice(0, 80)).filter(Boolean);
  const seen = new Set();
  for(const s of Array.isArray(raw.shifts) ? raw.shifts.slice(0, 70) : []){
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(s?.date)) ? s.date : null;
    if(!date || seen.has(date + "|" + (s.start || s.code || ""))) continue;
    const start = /^([01]\d|2[0-3]):?([0-5]\d)$/.exec(String(s.start || ""));
    const end = /^([01]\d|2[0-3]):?([0-5]\d)$/.exec(String(s.end || ""));
    const code = String(s.code || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 10);
    if(start && end) out.shifts.push({date, start: start[1] + start[2], end: end[1] + end[2], code});
    else if(code) out.shifts.push({date, code});
    else continue;
    seen.add(date + "|" + (s.start || s.code || ""));
  }
  out.shifts.sort((a, b) => a.date.localeCompare(b.date));
  if(!out.shifts.length) out.found = false;
  return out;
}

// ---------- UI strings for the new screens (setup, scan, rest, calendar) ----------
// NOTE: translations should be reviewed by native speakers before launch.
export const LANGUAGES = [
  {id: "en", label: "English"},
  {id: "mi", label: "Te Reo Māori"},
  {id: "hi", label: "हिन्दी"},
  {id: "tl", label: "Tagalog"},
  {id: "sm", label: "Gagana Samoa"},
  {id: "to", label: "Lea faka-Tonga"},
  {id: "zh", label: "中文"},
  {id: "pa", label: "ਪੰਜਾਬੀ"}
];

const STR = {
  en: {
    welcome: "Welcome to VV Duty Roster", language: "Language", company: "Company / Roster type",
    exactName: "Your name exactly as on the roster", exactNameHint: "Used to find only your row when you upload a roster.",
    minRest: "Minimum rest between shifts (hours)", save: "Save and continue",
    scanTitle: "Scan roster", scanNotice: "Your roster image is sent securely to an AI service solely to read your shifts. It is not used to train AI models and it is not stored. Only your own row is saved.",
    scanAgree: "I understand and I'm allowed to upload this roster", scanButton: "Read my shifts", scansLeft: "scans left today",
    scanLimit: "You've reached today's scan limit. Try again tomorrow, upload a spreadsheet, or enter shifts manually.",
    scanPaused: "Scanning is paused right now. Please upload a spreadsheet or enter shifts manually.",
    notFound: "We couldn't find that name on the roster. Check the spelling in Settings.", confirm: "Check your shifts, then save", saveShifts: "Save shifts",
    restShort: "Short turnaround", restOverlap: "Shifts overlap", restOnly: "only", restMin: "minimum",
    calendar: "Add to calendar", calendarDownload: "Download calendar file (.ics)", calendarHint: "Opens in Google, Apple or Outlook calendar.",
    noShifts: "No shifts to export yet.",
    shiftCodesHint: "Shift codes on your roster (optional) — e.g. D = 0700-1500",
    addCode: "+ Add code",
    scanFailed: "Scan failed. Please try again, or upload a spreadsheet.",
    scanFailedNet: "Scan failed. Check your connection and try again.",
    signInAgain: "Please sign in again.",
    payCycle: "How often are you paid?",
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly"
  },
  mi: {
    welcome: "Nau mai ki VV Duty Roster", language: "Reo", company: "Kamupene / momo rārangi",
    exactName: "Tō ingoa pēnei i te rārangi", exactNameHint: "Hei kimi anake i tō rārangi ina tukua he rārangi.",
    minRest: "Te okiokinga iti rawa i waenga i ngā wāhanga mahi (hāora)", save: "Tiaki me te haere tonu",
    scanTitle: "Matawai rārangi", scanNotice: "Ka tukuna tō whakaahua rārangi ki tētahi ratonga AI hei pānui i ō wāhanga mahi anake. Kāore e whakamahia hei whakangungu tauira AI, kāore hoki e puritia. Ko tō rārangi anake ka tiakina.",
    scanAgree: "Kei te mārama ahau, ā, e whakaaetia ana ahau ki te tuku i tēnei rārangi", scanButton: "Pānuitia aku wāhanga mahi", scansLeft: "matawai e toe ana i tēnei rā",
    scanLimit: "Kua eke koe ki te tepe matawai o tēnei rā. Whakamātauria āpōpō, tukuna he whārangi tātai, tāuru rānei ā-ringa.",
    scanPaused: "Kua okioki te matawai i tēnei wā. Tukuna he whārangi tātai, tāuru rānei ā-ringa.",
    notFound: "Kāore i kitea tērā ingoa i te rārangi. Tirohia te tuhi i ngā Tautuhinga.", confirm: "Tirohia ō wāhanga mahi, ka tiaki", saveShifts: "Tiaki wāhanga mahi",
    restShort: "Okiokinga poto", restOverlap: "E paheke ana ngā wāhanga mahi", restOnly: "anake", restMin: "iti rawa",
    calendar: "Tāpiri ki te maramataka", calendarDownload: "Tikiake kōnae maramataka (.ics)", calendarHint: "Ka whakatuwhera i Google, Apple, Outlook rānei.",
    noShifts: "Kāore ano he wāhanga mahi hei kaweake.",
    shiftCodesHint: "Ngā tohu wāhanga mahi i tō rārangi (kāore e herea) — hei tauira D = 0700-1500",
    addCode: "+ Tāpiri tohu",
    scanFailed: "I rahua te matawai. Whakamātau anō, tukuna rānei he whārangi tātai.",
    scanFailedNet: "I rahua te matawai. Tirohia tō hononga ka whakamātau anō.",
    signInAgain: "Takiuru anō, tēnā koa.",
    payCycle: "Ia hia te utu mai ki a koe?",
    weekly: "Ia wiki",
    fortnightly: "Ia rua wiki",
    monthly: "Ia marama"
  },
  hi: {
    welcome: "VV Duty Roster में आपका स्वागत है", language: "भाषा", company: "कंपनी / रोस्टर प्रकार",
    exactName: "रोस्टर में लिखा आपका नाम (बिल्कुल वैसा)", exactNameHint: "रोस्टर अपलोड करने पर सिर्फ़ आपकी पंक्ति खोजने के लिए।",
    minRest: "शिफ़्टों के बीच न्यूनतम आराम (घंटे)", save: "सहेजें और आगे बढ़ें",
    scanTitle: "रोस्टर स्कैन करें", scanNotice: "आपके रोस्टर की तस्वीर केवल आपकी शिफ़्टें पढ़ने के लिए एक AI सेवा को सुरक्षित रूप से भेजी जाती है। इसका उपयोग AI मॉडल को प्रशिक्षित करने में नहीं होता और यह सहेजी नहीं जाती। सिर्फ़ आपकी अपनी पंक्ति सहेजी जाती है।",
    scanAgree: "मैं समझता/समझती हूँ और मुझे यह रोस्टर अपलोड करने की अनुमति है", scanButton: "मेरी शिफ़्टें पढ़ें", scansLeft: "आज के स्कैन बचे",
    scanLimit: "आप आज की स्कैन सीमा तक पहुँच गए हैं। कल फिर कोशिश करें, स्प्रेडशीट अपलोड करें या शिफ़्टें हाथ से भरें।",
    scanPaused: "स्कैनिंग अभी रुकी हुई है। कृपया स्प्रेडशीट अपलोड करें या शिफ़्टें हाथ से भरें।",
    notFound: "रोस्टर में यह नाम नहीं मिला। सेटिंग्स में वर्तनी जाँचें।", confirm: "अपनी शिफ़्टें जाँचें, फिर सहेजें", saveShifts: "शिफ़्टें सहेजें",
    restShort: "कम आराम", restOverlap: "शिफ़्टें आपस में टकरा रही हैं", restOnly: "केवल", restMin: "न्यूनतम",
    calendar: "कैलेंडर में जोड़ें", calendarDownload: "कैलेंडर फ़ाइल डाउनलोड करें (.ics)", calendarHint: "Google, Apple या Outlook कैलेंडर में खुलती है।",
    noShifts: "अभी निर्यात करने के लिए कोई शिफ़्ट नहीं है।",
    shiftCodesHint: "आपके रोस्टर के शिफ़्ट कोड (वैकल्पिक) — जैसे D = 0700-1500",
    addCode: "+ कोड जोड़ें",
    scanFailed: "स्कैन विफल रहा। फिर कोशिश करें, या स्प्रेडशीट अपलोड करें।",
    scanFailedNet: "स्कैन विफल रहा। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
    signInAgain: "कृपया फिर से साइन इन करें।",
    payCycle: "आपको वेतन कितने समय पर मिलता है?",
    weekly: "साप्ताहिक",
    fortnightly: "पाक्षिक (हर दो सप्ताह)",
    monthly: "मासिक"
  },
  tl: {
    welcome: "Maligayang pagdating sa VV Duty Roster", language: "Wika", company: "Kumpanya / uri ng roster",
    exactName: "Ang pangalan mo ayon sa roster", exactNameHint: "Ginagamit para hanapin lang ang hanay mo kapag nag-upload ng roster.",
    minRest: "Pinakamababang pahinga sa pagitan ng mga shift (oras)", save: "I-save at magpatuloy",
    scanTitle: "I-scan ang roster", scanNotice: "Ang larawan ng roster mo ay ligtas na ipinapadala sa isang AI service para lang basahin ang mga shift mo. Hindi ito ginagamit sa pagsasanay ng mga AI model at hindi ito iniimbak. Ang sarili mong hanay lang ang sine-save.",
    scanAgree: "Naiintindihan ko at pinapayagan akong i-upload ang roster na ito", scanButton: "Basahin ang mga shift ko", scansLeft: "natitirang scan ngayong araw",
    scanLimit: "Naabot mo na ang limitasyon ng scan ngayong araw. Subukan bukas, mag-upload ng spreadsheet, o manu-manong ilagay ang mga shift.",
    scanPaused: "Naka-pause ang pag-scan ngayon. Mag-upload ng spreadsheet o manu-manong ilagay ang mga shift.",
    notFound: "Hindi nahanap ang pangalang iyon sa roster. Suriin ang spelling sa Settings.", confirm: "Suriin ang mga shift, saka i-save", saveShifts: "I-save ang mga shift",
    restShort: "Maikling pahinga", restOverlap: "Nagpapatong ang mga shift", restOnly: "lang", restMin: "minimum",
    calendar: "Idagdag sa kalendaryo", calendarDownload: "I-download ang calendar file (.ics)", calendarHint: "Bubukas sa Google, Apple o Outlook calendar.",
    noShifts: "Wala pang shift na mae-export.",
    shiftCodesHint: "Mga shift code sa roster mo (opsyonal) — hal. D = 0700-1500",
    addCode: "+ Magdagdag ng code",
    scanFailed: "Nabigo ang pag-scan. Subukang muli, o mag-upload ng spreadsheet.",
    scanFailedNet: "Nabigo ang pag-scan. Suriin ang koneksyon mo at subukang muli.",
    signInAgain: "Mag-sign in muli.",
    payCycle: "Gaano kadalas ka sinasahuran?",
    weekly: "Lingguhan",
    fortnightly: "Kada dalawang linggo",
    monthly: "Buwanan"
  },
  sm: {
    welcome: "Afio mai i le VV Duty Roster", language: "Gagana", company: "Kamupani / ituaiga o le roster",
    exactName: "Lou igoa e pei ona i totonu o le roster", exactNameHint: "E faʻaaoga e saili ai na o lau laina pe a ʻuluina se roster.",
    minRest: "Le malolo aupito itiiti i le va o galuega (itula)", save: "Teu ma faʻaauau",
    scanTitle: "Savalia le roster", scanNotice: "O le ata o lau roster e auina atu saogalemu i se auaunaga AI e faitau ai na o au galuega. E le faʻaaogaina e aʻoaʻo ai faiga AI ma e le teuina. O lau laina e teuina.",
    scanAgree: "Ou te malamalama ma ua faʻatagaina aʻu e ʻuluina lenei roster", scanButton: "Faitau aʻu galuega", scansLeft: "scan o totoe i le asō",
    scanLimit: "Ua oʻo i le tapulaʻa o scan o le asō. Toe taumafai taeao, ʻuluina se spreadsheet, pe tusi lima galuega.",
    scanPaused: "Ua taofia le scan i le taimi nei. ʻUluina se spreadsheet pe tusi lima galuega.",
    notFound: "Ua le maua lena igoa i le roster. Siaki le sipelaga i Settings.", confirm: "Siaki au galuega, ona teu lea", saveShifts: "Teu galuega",
    restShort: "Malolo puupuu", restOverlap: "E tuaʻi galuega", restOnly: "na o", restMin: "aupito itiiti",
    calendar: "Faaopoopo i le kalena", calendarDownload: "Download le faila kalena (.ics)", calendarHint: "E tatalaina i Google, Apple po o Outlook.",
    noShifts: "Leai ni galuega e auina atu."
  },
  to: {
    welcome: "Malo e lelei ki he VV Duty Roster", language: "Lea", company: "Kautaha / founga roster",
    exactName: "Hoʻo hingoa ʻo hangē ko ia ʻi he roster", exactNameHint: "ʻOku ngāue'aki ke ngāue pē ki hoʻo laine ʻi he ʻuluaki roster.",
    minRest: "Ko e mālōlō ʻoku māʻulalo taha ʻi he vahaʻa ʻo e ngāue (houa)", save: "Tauhi pea hokohoko atu",
    scanTitle: "Sikeni e roster", scanNotice: "ʻOku fakahū saiʻia hoʻo ʻīmisi roster ki ha ngāue AI ke lau pē hoʻo ngaahi ngāue. ʻOku ʻikai ngāue'aki ia ke ako'i ʻa e ngaahi sīpinga AI pea ʻikai tauhi. Ko hoʻo laine pē ʻoku tauhi.",
    scanAgree: "ʻOku ou mahino pea kuo faʻatoki au ke fakahū e roster ni", scanButton: "Lau hoku ngaahi ngāue", scansLeft: "sikeni toe he ʻahó ni",
    scanLimit: "Kuo ke aʻu ki he tuʻunga sikeni ʻo e ʻahó ni. Toe feinga ʻapongipongi, fakahū ha spreadsheet pe tohi ʻaki hā nima.",
    scanPaused: "Kuo tuku ʻa e sikeni he taimi ni. Fakahū ha spreadsheet pe tohi ʻaki hā nima.",
    notFound: "Naʻe ʻikai ʻilo e hingoa ko ia ʻi he roster. Sivi e tohi ʻi he Settings.", confirm: "Sivi hoʻo ngaahi ngāue, pea tauhi", saveShifts: "Tauhi ngaahi ngāue",
    restShort: "Mālōlō nounou", restOverlap: "ʻOku feʻaluaki ngaahi ngāue", restOnly: "pē", restMin: "māʻulalo taha",
    calendar: "Fakahū ki he kalenitā", calendarDownload: "Download e faile kalenitā (.ics)", calendarHint: "ʻOku toki ʻi Google, Apple pe Outlook.",
    noShifts: "ʻIkai ha ngāue ke fakahū atu."
  },
  zh: {
    welcome: "欢迎使用 VV Duty Roster", language: "语言", company: "公司 / 排班类型",
    exactName: "您在排班表上的姓名（须完全一致）", exactNameHint: "上传排班表时，仅用于找到您自己的那一行。",
    minRest: "两个班次之间的最短休息时间（小时）", save: "保存并继续",
    scanTitle: "扫描排班表", scanNotice: "您的排班表图片会被安全地发送给 AI 服务，仅用于读取您的班次。它不会被用于训练 AI 模型，也不会被存储。只会保存您本人那一行。",
    scanAgree: "我已了解，并且有权上传此排班表", scanButton: "读取我的班次", scansLeft: "今日剩余扫描次数",
    scanLimit: "您已达到今日扫描上限。请明天再试、上传电子表格，或手动输入班次。",
    scanPaused: "扫描功能暂时暂停。请上传电子表格或手动输入班次。",
    notFound: "在排班表中找不到该姓名。请在设置中检查拼写。", confirm: "请核对班次，然后保存", saveShifts: "保存班次",
    restShort: "休息时间过短", restOverlap: "班次重叠", restOnly: "仅", restMin: "最低",
    calendar: "添加到日历", calendarDownload: "下载日历文件 (.ics)", calendarHint: "可在 Google、Apple 或 Outlook 日历中打开。",
    noShifts: "暂无可导出的班次。",
    shiftCodesHint: "您排班表上的班次代码（可选）——例如 D = 0700-1500",
    addCode: "+ 添加代码",
    scanFailed: "扫描失败。请重试，或上传电子表格。",
    scanFailedNet: "扫描失败。请检查网络连接后重试。",
    signInAgain: "请重新登录。",
    payCycle: "您多久领一次工资？",
    weekly: "每周",
    fortnightly: "每两周",
    monthly: "每月"
  },
  pa: {
    welcome: "VV Duty Roster ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ", language: "ਭਾਸ਼ਾ", company: "ਕੰਪਨੀ / ਰੋਸਟਰ ਦੀ ਕਿਸਮ",
    exactName: "ਰੋਸਟਰ ਵਿੱਚ ਲਿਖਿਆ ਤੁਹਾਡਾ ਨਾਮ (ਬਿਲਕੁਲ ਉਸੇ ਤਰ੍ਹਾਂ)", exactNameHint: "ਰੋਸਟਰ ਅੱਪਲੋਡ ਕਰਨ ਵੇਲੇ ਸਿਰਫ਼ ਤੁਹਾਡੀ ਕਤਾਰ ਲੱਭਣ ਲਈ।",
    minRest: "ਸ਼ਿਫ਼ਟਾਂ ਵਿਚਕਾਰ ਘੱਟੋ-ਘੱਟ ਆਰਾਮ (ਘੰਟੇ)", save: "ਸੰਭਾਲੋ ਅਤੇ ਅੱਗੇ ਵਧੋ",
    scanTitle: "ਰੋਸਟਰ ਸਕੈਨ ਕਰੋ", scanNotice: "ਤੁਹਾਡੇ ਰੋਸਟਰ ਦੀ ਤਸਵੀਰ ਸਿਰਫ਼ ਤੁਹਾਡੀਆਂ ਸ਼ਿਫ਼ਟਾਂ ਪੜ੍ਹਨ ਲਈ ਇੱਕ AI ਸੇਵਾ ਨੂੰ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਭੇਜੀ ਜਾਂਦੀ ਹੈ। ਇਸਨੂੰ AI ਮਾਡਲ ਸਿਖਲਾਈ ਲਈ ਨਹੀਂ ਵਰਤਿਆ ਜਾਂਦਾ ਅਤੇ ਇਹ ਸਟੋਰ ਨਹੀਂ ਹੁੰਦੀ। ਸਿਰਫ਼ ਤੁਹਾਡੀ ਆਪਣੀ ਕਤਾਰ ਸੰਭਾਲੀ ਜਾਂਦੀ ਹੈ।",
    scanAgree: "ਮੈਂ ਸਮਝਦਾ/ਸਮਝਦੀ ਹਾਂ ਅਤੇ ਮੈਨੂੰ ਇਹ ਰੋਸਟਰ ਅੱਪਲੋਡ ਕਰਨ ਦੀ ਇਜਾਜ਼ਤ ਹੈ", scanButton: "ਮੇਰੀਆਂ ਸ਼ਿਫ਼ਟਾਂ ਪੜ੍ਹੋ", scansLeft: "ਅੱਜ ਦੇ ਬਾਕੀ ਸਕੈਨ",
    scanLimit: "ਤੁਸੀਂ ਅੱਜ ਦੀ ਸਕੈਨ ਸੀਮਾ ਤੱਕ ਪਹੁੰਚ ਗਏ ਹੋ। ਕੱਲ੍ਹ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਸਪ੍ਰੈਡਸ਼ੀਟ ਅੱਪਲੋਡ ਕਰੋ ਜਾਂ ਸ਼ਿਫ਼ਟਾਂ ਹੱਥੀਂ ਭਰੋ।",
    scanPaused: "ਸਕੈਨਿੰਗ ਇਸ ਵੇਲੇ ਰੁਕੀ ਹੋਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਸਪ੍ਰੈਡਸ਼ੀਟ ਅੱਪਲੋਡ ਕਰੋ ਜਾਂ ਸ਼ਿਫ਼ਟਾਂ ਹੱਥੀਂ ਭਰੋ।",
    notFound: "ਰੋਸਟਰ ਵਿੱਚ ਇਹ ਨਾਮ ਨਹੀਂ ਮਿਲਿਆ। ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਸਪੈਲਿੰਗ ਜਾਂਚੋ।", confirm: "ਆਪਣੀਆਂ ਸ਼ਿਫ਼ਟਾਂ ਜਾਂਚੋ, ਫਿਰ ਸੰਭਾਲੋ", saveShifts: "ਸ਼ਿਫ਼ਟਾਂ ਸੰਭਾਲੋ",
    restShort: "ਘੱਟ ਆਰਾਮ", restOverlap: "ਸ਼ਿਫ਼ਟਾਂ ਆਪਸ ਵਿੱਚ ਟਕਰਾ ਰਹੀਆਂ ਹਨ", restOnly: "ਸਿਰਫ਼", restMin: "ਘੱਟੋ-ਘੱਟ",
    calendar: "ਕੈਲੰਡਰ ਵਿੱਚ ਜੋੜੋ", calendarDownload: "ਕੈਲੰਡਰ ਫ਼ਾਈਲ ਡਾਊਨਲੋਡ ਕਰੋ (.ics)", calendarHint: "Google, Apple ਜਾਂ Outlook ਕੈਲੰਡਰ ਵਿੱਚ ਖੁੱਲ੍ਹਦੀ ਹੈ।",
    noShifts: "ਅਜੇ ਨਿਰਯਾਤ ਕਰਨ ਲਈ ਕੋਈ ਸ਼ਿਫ਼ਟ ਨਹੀਂ।",
    shiftCodesHint: "ਤੁਹਾਡੇ ਰੋਸਟਰ ਦੇ ਸ਼ਿਫ਼ਟ ਕੋਡ (ਵਿਕਲਪਿਕ) — ਜਿਵੇਂ D = 0700-1500",
    addCode: "+ ਕੋਡ ਜੋੜੋ",
    scanFailed: "ਸਕੈਨ ਅਸਫਲ ਰਿਹਾ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਸਪ੍ਰੈਡਸ਼ੀਟ ਅੱਪਲੋਡ ਕਰੋ।",
    scanFailedNet: "ਸਕੈਨ ਅਸਫਲ ਰਿਹਾ। ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    signInAgain: "ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।",
    payCycle: "ਤੁਹਾਨੂੰ ਤਨਖ਼ਾਹ ਕਿੰਨੇ ਸਮੇਂ ਬਾਅਦ ਮਿਲਦੀ ਹੈ?",
    weekly: "ਹਫ਼ਤਾਵਾਰੀ",
    fortnightly: "ਪੰਦਰਵਾੜਾ",
    monthly: "ਮਹੀਨਾਵਾਰ"
  }
};

export function t(lang, key){
  return (STR[lang] && STR[lang][key]) || STR.en[key] || key;
}
