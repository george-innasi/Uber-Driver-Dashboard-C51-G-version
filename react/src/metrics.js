/* =====================================================================
   Shared metric definitions: the single source of truth for every rate,
   threshold, move estimate, "your usual" baseline and safety check.
   Pure functions only. engine.js and App.jsx import from here; nothing
   else may restate a threshold or re-derive one of these formulas.
   ===================================================================== */

const HOUR = 3600000, DAY = 86400000;

/* ---- Account standing thresholds (one constant per metric) ----
   goal: the "On track" line and the Gold standard where one exists.
   mid:  the "Almost there" band. Beyond mid is "Focus". */
export const THRESHOLDS = {
  acceptance:   { goal: 0.70, mid: 0.65, higherIsBetter: true,  label: '70%+',       need: 'at least 70%' },
  cancellation: { goal: 0.04, mid: 0.06, higherIsBetter: false, label: '4% or less', need: 'at most 4%' },
  rating:       { goal: 4.90, mid: 4.85, higherIsBetter: true,  label: '4.90+',      need: 'at least 4.90' },
  tripOffers:   { goal: 0.92, mid: 0.85, higherIsBetter: true,  label: '92%+',       need: 'at least 92%' },
};

/* ---- Shift, rest and wellbeing rules ---- */
export const RULES = {
  longDay: 5,        // hours online this shift
  lateStart: 22,     // 10 PM
  lateEnd: 5,        // 5 AM
  lateMinHours: 3,   // hours in before the late-night flag applies
  last24: 9,         // hours online in the last 24
  noRestDays: 6,     // days in a row without a rest day
  horizon: 2,        // hours a move estimate looks ahead
  oppRatio: 1.15,    // a move must beat staying by 15%...
  oppMinGain: 8,     // ...and by at least $8 over the horizon
  maxDrive: 20,      // minutes; the radius for every "nearby" option
  maxShift: 10,      // hard limit, hours online since last rest
  nearLimit: 8,      // hours since last rest that turn the hours bar amber
  restHrs: 7,        // rest required after the hard limit
  minRateHours: 0.5, // a shift's $/hr is shown once it has this much online time
};

/* ---- Two distinct live signals (never call one by the other's name) ---- */
export const SIGNALS = {
  demandAboveGap: 0.12, // "Demand above normal": live demand at least 12 points over normal for this hour
  surgeOnAbove: 1.0,    // "Surge pricing on": fare multiplier above 1.0x
};
export const demandAboveNormal = (live, normal) => live - normal >= SIGNALS.demandAboveGap - 1e-9;
export const surgePricingOn = (mult) => mult > SIGNALS.surgeOnAbove + 1e-9;

/* ---- Rates: every displayed rate comes from its numerator and denominator ---- */
export function rate(num, den) { return den > 0 ? num / den : 0; }
export function rateView(num, den) {
  const v = rate(num, den);
  return { num, den, value: v, pctText: den > 0 ? Math.round(v * 100) + '%' : '–' };
}

/* rounding used before comparing against a threshold, so the badge matches the number shown */
const shown = (key, v) => (key === 'rating' ? Math.round(v * 100) / 100 : Math.round(v * 100) / 100);
export function meets(key, v) {
  const t = THRESHOLDS[key], x = shown(key, v);
  return t.higherIsBetter ? x >= t.goal : x <= t.goal;
}
export function tierOf(key, v) {
  const t = THRESHOLDS[key], x = shown(key, v);
  if (t.higherIsBetter) return x >= t.goal ? 'good' : x >= t.mid ? 'mid' : 'bad';
  return x <= t.goal ? 'good' : x <= t.mid ? 'mid' : 'bad';
}

/* ---- Move estimate: drive time is always unpaid ----
   rateAt(zone, clockHour) -> expected $/online hr in that zone at that hour.
   Staying earns from `startH` for `horizonH`. Moving earns nothing during the
   drive, then earns at the destination for the rest of the same horizon. */
export function moveEstimate({ rateAt, from, to, startH, horizonH, driveMins, steps = 8 }) {
  const earnOver = (z, a, b) => {
    if (b <= a) return 0;
    let s = 0;
    for (let i = 0; i < steps; i++) s += rateAt(z, a + ((b - a) * (i + 0.5)) / steps);
    return (s / steps) * (b - a);
  };
  const driveH = driveMins / 60, endH = startH + horizonH;
  const stay = earnOver(from, startH, endH);
  const move = earnOver(to, startH + driveH, endH);
  const gain = move - stay;
  return {
    from, to, driveMins, horizonH, stay, move, gain,
    stayPerHr: stay / horizonH,
    movePerHr: move / horizonH,          // $/hr over the whole horizon, drive included as unpaid
    gainPerHr: gain / horizonH,          // "+$X/hr after the drive"
    qualifies: gain >= RULES.oppMinGain && move >= stay * RULES.oppRatio,
  };
}

/* ---- Your usual $/hr ----
   Definition: the median of your weekly $/hr in the same day-part over the
   last 8 weeks (8 rolling 7-day windows before the reference time), counting
   only weeks with at least 1 hour online in that day-part. A shift that spans
   several day-parts is compared with the hour-weighted blend of those usuals. */
export const DAY_PARTS = [
  { id: 'morning', label: 'Morning', a: 5, b: 11 },
  { id: 'midday', label: 'Midday', a: 11, b: 16 },
  { id: 'evening', label: 'Evening', a: 16, b: 22 },
  { id: 'late', label: 'Late night', a: 22, b: 29 },
];
export function dayPartOf(clockH) {
  const h = clockH < 5 ? clockH + 24 : clockH;
  return DAY_PARTS.find((p) => h >= p.a && h < p.b).id;
}
const hourOfMs = (ms) => { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60; };
export function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const earnOf = (r) => r.fare + r.tips;

export function usualForDayPart(recs, refMs, part, weeks = 8) {
  const vals = [];
  for (let k = 0; k < weeks; k++) {
    const e = refMs - k * 7 * DAY, s = e - 7 * DAY;
    let earn = 0, online = 0;
    for (const r of recs) {
      if (r.s < s || r.s >= e || dayPartOf(hourOfMs(r.s)) !== part) continue;
      earn += earnOf(r); online += r.dur;
    }
    if (online >= 1) vals.push(earn / online);
  }
  return { value: median(vals), weeks: vals.length };
}
export function usualAllHours(recs, refMs, weeks = 8) {
  const vals = [];
  for (let k = 0; k < weeks; k++) {
    const e = refMs - k * 7 * DAY, s = e - 7 * DAY;
    let earn = 0, online = 0;
    for (const r of recs) if (r.s >= s && r.s < e) { earn += earnOf(r); online += r.dur; }
    if (online >= 1) vals.push(earn / online);
  }
  return median(vals);
}
/* hour weights by day-part for a set of records (a shift), or a single day-part */
export function dayPartWeights(recs) {
  const w = {};
  recs.forEach((r) => { const p = dayPartOf(hourOfMs(r.s)); w[p] = (w[p] || 0) + r.dur; });
  const t = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  Object.keys(w).forEach((k) => { w[k] /= t; });
  return w;
}
export function usualEpoh(recs, refMs, weights) {
  let v = 0, used = 0;
  for (const [part, wt] of Object.entries(weights)) {
    const u = usualForDayPart(recs, refMs, part);
    if (u.weeks) { v += u.value * wt; used += wt; }
  }
  return used > 0 ? v / used : usualAllHours(recs, refMs);
}

/* ---- Safety check: every wellbeing warning, now or projected onto an offer ----
   state: { shiftH, clockH, last24H, daysInRow }
   slot (optional): { startH, endH, driveMins } in clock hours (may exceed 24).
   For a slot, hours are projected to the end of the slot, assuming the driver
   stays online from now until then. */
export function safetyCheck(state, slot) {
  const R = RULES;
  const isLate = (h) => { const x = ((h % 24) + 24) % 24; return x >= R.lateStart || x < R.lateEnd; };
  let shiftH = state.shiftH, endClock = state.clockH, last24 = state.last24H, lateHit;
  if (slot) {
    const add = Math.max(0, slot.endH - state.clockH);
    shiftH = state.shiftH + add; last24 = state.last24H + add; endClock = slot.endH;
    // late-night: any part of the slot after 10 PM, with 3+ hours in at that point
    const lateFrom = Math.max(slot.startH, R.lateStart);
    const hoursAtLate = state.shiftH + Math.max(0, lateFrom - state.clockH);
    lateHit = slot.endH > R.lateStart && hoursAtLate >= R.lateMinHours;
  } else {
    lateHit = isLate(state.clockH) && state.shiftH >= R.lateMinHours;
  }
  const checks = [
    { key: 'hardLimit', label: `${R.maxShift} hrs online: forced offline`, hours: shiftH, hit: shiftH >= R.maxShift - 1e-6, blocking: true },
    { key: 'longShift', label: `On for ${R.longDay}+ hours this shift`, hours: shiftH, hit: shiftH >= R.longDay },
    { key: 'lateNight', label: `Past ${R.lateStart - 12} PM, ${R.lateMinHours}+ hours in`, hours: shiftH, hit: !!lateHit },
    { key: 'last24', label: `${R.last24}+ hours in the last 24`, hours: last24, hit: last24 >= R.last24 },
    { key: 'daysInRow', label: `${R.noRestDays}+ days without a rest day`, days: state.daysInRow, hit: state.daysInRow >= R.noRestDays },
  ];
  const blocked = checks.some((c) => c.hit && c.blocking);
  const caution = checks.some((c) => c.hit && !c.blocking);
  return { checks, shiftH, endClock, last24, status: blocked ? 'limit' : caution ? 'caution' : 'clear' };
}

export const _internals = { HOUR, DAY };
