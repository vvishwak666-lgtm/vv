// New Zealand public holidays (dates the day is actually observed, i.e. after
// Mondayisation of Waitangi Day / ANZAC Day and the weekend New Year / Christmas rules).
// "Auckland Anniversary" is regional (Auckland / Northland); remove it for other regions.
// Covers 2026-2028. Add a new year here each December.
const NZ_HOLIDAYS = {
  // 2026
  "2026-01-01": "New Year's Day",
  "2026-01-02": "Day after New Year's Day",
  "2026-01-26": "Auckland Anniversary",
  "2026-02-06": "Waitangi Day",
  "2026-04-03": "Good Friday",
  "2026-04-06": "Easter Monday",
  "2026-04-27": "ANZAC Day (observed)",
  "2026-06-01": "King's Birthday",
  "2026-07-10": "Matariki",
  "2026-10-26": "Labour Day",
  "2026-12-25": "Christmas Day",
  "2026-12-28": "Boxing Day (observed)",
  // 2027
  "2027-01-01": "New Year's Day",
  "2027-01-04": "Day after New Year's Day (observed)",
  "2027-02-01": "Auckland Anniversary",
  "2027-02-08": "Waitangi Day (observed)",
  "2027-03-26": "Good Friday",
  "2027-03-29": "Easter Monday",
  "2027-04-26": "ANZAC Day (observed)",
  "2027-06-07": "King's Birthday",
  "2027-06-25": "Matariki",
  "2027-10-25": "Labour Day",
  "2027-12-27": "Christmas Day (observed)",
  "2027-12-28": "Boxing Day (observed)",
  // 2028
  "2028-01-03": "New Year's Day (observed)",
  "2028-01-04": "Day after New Year's Day (observed)",
  "2028-01-31": "Auckland Anniversary",
  "2028-02-07": "Waitangi Day (observed)",
  "2028-04-14": "Good Friday",
  "2028-04-17": "Easter Monday",
  "2028-04-25": "ANZAC Day",
  "2028-06-05": "King's Birthday",
  "2028-07-14": "Matariki",
  "2028-10-23": "Labour Day",
  "2028-12-25": "Christmas Day",
  "2028-12-26": "Boxing Day",
};
export function holidayName(iso){ return NZ_HOLIDAYS[iso] || ""; }
export function isPublicHoliday(iso){ return !!NZ_HOLIDAYS[iso]; }

// Public-holiday pay: hours worked on a public holiday are paid at least time and a half,
// and the worker earns an alternative holiday (Holidays Act 2003) when the day is one they
// would otherwise have worked. PH_MULT is the total multiplier (1.5 = base + 0.5 premium).
export const PH_MULT = 1.5;
function nextDay(iso){ const d=new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }
// Fraction (0..1) of a shift span "HHMM-HHMM" that falls on a public holiday. The shift starts on `dateISO`;
// if the finish is earlier than the start it ends the next calendar day (midnight-to-midnight split).
export function phShare(dateISO, range){
  const m = String(range||"").match(/(\d{2})(\d{2})\s*-\s*(\d{2})(\d{2})/);
  if(!m || !dateISO) return 0;
  const s = +m[1]*60 + +m[2];
  let e = +m[3]*60 + +m[4];
  if(e <= s) e += 1440;
  const total = e - s;
  if(total <= 0) return 0;
  const day0 = Math.min(e,1440) - s;
  const day1 = Math.max(0, e - 1440);
  const ph0 = isPublicHoliday(dateISO) ? day0 : 0;
  const ph1 = isPublicHoliday(nextDay(dateISO)) ? day1 : 0;
  return (ph0 + ph1) / total;
}

// ---- date helpers + holiday lookups shared by the dashboard countdown and the Leave Optimiser ----
// With no argument: today's date in New Zealand (same as the app's todayISO), whatever the phone's timezone.
// With a Date argument: that Date's own local calendar day.
export function localISO(d){
  if(!d){
    const parts = new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const g = t => parts.find(p => p.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function addIso(iso, n){ const d=new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function diffDays(a, b){ return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000); }
// First public holiday on or after `fromISO`, or null when the table has run out.
export function nextHoliday(fromISO){
  const dates = Object.keys(NZ_HOLIDAYS).sort();
  const d = dates.find(x => x >= fromISO);
  return d ? { date: d, name: NZ_HOLIDAYS[d] } : null;
}

// All public holidays as [{date,name}] sorted by date (used by Ask your roster to understand "Christmas", "Labour Day"...).
export function listHolidays(){
  return Object.keys(NZ_HOLIDAYS).sort().map(d => ({ date: d, name: NZ_HOLIDAYS[d] }));
}
