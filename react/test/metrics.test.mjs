import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/metrics.js';

const DAY = 86400000, HOUR = 3600000;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

/* ---- rates from numerator and denominator ---- */
test('rate divides numerator by denominator and is 0 when the denominator is 0', () => {
  near(M.rate(179, 265), 179 / 265);
  assert.equal(M.rate(5, 0), 0);
  assert.equal(M.rateView(179, 265).pctText, '68%');
  assert.equal(M.rateView(0, 0).pctText, '–');
});
test('tiers use the single threshold table', () => {
  assert.equal(M.tierOf('acceptance', 0.70), 'good');
  assert.equal(M.tierOf('acceptance', 0.66), 'mid');
  assert.equal(M.tierOf('acceptance', 0.60), 'bad');
  assert.equal(M.tierOf('cancellation', 0.04), 'good');
  assert.equal(M.tierOf('cancellation', 0.07), 'bad');
  assert.equal(M.tierOf('rating', 4.896), 'good'); // shown as 4.90
  assert.equal(M.meets('tripOffers', 0.91), false);
});

/* ---- move estimates: drive time is unpaid ---- */
test('moving earns nothing while driving, then the destination rate', () => {
  const rateAt = (z) => (z === 'a' ? 20 : 30);
  const e = M.moveEstimate({ rateAt, from: 'a', to: 'b', startH: 15, horizonH: 2, driveMins: 30 });
  near(e.stay, 40);
  near(e.move, 45);          // 1.5 paid hours at $30
  near(e.gainPerHr, 2.5);    // (45 - 40) / 2
  near(e.movePerHr, 22.5);
});
test('a move that looks better per hour can lose once the drive is counted', () => {
  const rateAt = (z) => (z === 'a' ? 25 : 31);
  const e = M.moveEstimate({ rateAt, from: 'a', to: 'b', startH: 15, horizonH: 2, driveMins: 20 });
  assert.ok(e.gainPerHr < 6, 'the naive +$6/hr ignores the drive');
  near(e.gainPerHr, (31 * (2 - 1 / 3) - 50) / 2);
  assert.equal(e.qualifies, false);
});
test('zero drive time reduces to the rate difference', () => {
  const e = M.moveEstimate({ rateAt: (z) => (z === 'a' ? 10 : 14), from: 'a', to: 'b', startH: 0, horizonH: 3, driveMins: 0 });
  near(e.gainPerHr, 4);
});

/* ---- your usual $/hr ---- */
const rec = (ms, h, dur, earn) => { const d = new Date(ms); d.setHours(h, 0, 0, 0); return { s: d.getTime(), dur, fare: earn, tips: 0 }; };
test('usual = median weekly $/hr in the same day-part over the last 8 weeks', () => {
  const ref = new Date(2026, 8, 23, 15, 45).getTime();
  const recs = [];
  const weekly = [18, 20, 22, 30, 10, 21, 19, 25]; // one midday hour per week
  weekly.forEach((v, k) => recs.push(rec(ref - (k * 7 + 1) * DAY, 13, 1, v)));
  recs.push(rec(ref - 2 * DAY, 19, 1, 99));          // evening: ignored for midday
  recs.push(rec(ref - 60 * DAY, 13, 1, 99));         // older than 8 weeks: ignored
  const u = M.usualForDayPart(recs, ref, 'midday');
  assert.equal(u.weeks, 8);
  near(u.value, 20.5);
  near(M.usualEpoh(recs, ref, { midday: 1 }), 20.5);
});
test('weeks with less than 1 hour in the day-part are skipped', () => {
  const ref = new Date(2026, 8, 23, 15, 45).getTime();
  const recs = [rec(ref - DAY, 12, 0.5, 50), rec(ref - 8 * DAY, 12, 1, 20), rec(ref - 15 * DAY, 12, 1, 24)];
  near(M.usualForDayPart(recs, ref, 'midday').value, 22);
});
test('a shift across day-parts uses the hour-weighted blend', () => {
  const ref = new Date(2026, 8, 23, 15, 45).getTime();
  const recs = [];
  for (let k = 0; k < 8; k++) { recs.push(rec(ref - (k * 7 + 1) * DAY, 12, 1, 20)); recs.push(rec(ref - (k * 7 + 1) * DAY, 18, 1, 30)); }
  near(M.usualEpoh(recs, ref, { midday: 0.25, evening: 0.75 }), 27.5);
});
test('day-parts', () => {
  assert.equal(M.dayPartOf(15.75), 'midday');
  assert.equal(M.dayPartOf(18.4), 'evening');
  assert.equal(M.dayPartOf(23), 'late');
  assert.equal(M.dayPartOf(2), 'late');
  assert.equal(M.dayPartOf(6), 'morning');
});

/* ---- safety check: all four early warnings plus the hard limit ---- */
const base = { shiftH: 1, clockH: 15, last24H: 1, daysInRow: 1 };
const hit = (S) => S.checks.filter((c) => c.hit).map((c) => c.key).sort();
test('clear when no warning applies', () => {
  const S = M.safetyCheck(base);
  assert.equal(S.status, 'clear');
  assert.deepEqual(hit(S), []);
});
test('long shift: 5+ hours', () => {
  assert.deepEqual(hit(M.safetyCheck({ ...base, shiftH: 5 })), ['longShift']);
  assert.deepEqual(hit(M.safetyCheck({ ...base, shiftH: 4.9 })), []);
});
test('late night: after 10 PM with 3+ hours in', () => {
  assert.deepEqual(hit(M.safetyCheck({ ...base, clockH: 22.5, shiftH: 3 })), ['lateNight']);
  assert.deepEqual(hit(M.safetyCheck({ ...base, clockH: 22.5, shiftH: 2 })), []);
  assert.deepEqual(hit(M.safetyCheck({ ...base, clockH: 1, shiftH: 3.5 })), ['lateNight']);
  assert.deepEqual(hit(M.safetyCheck({ ...base, clockH: 21, shiftH: 4 })), []);
});
test('9+ hours in the last 24', () => {
  assert.deepEqual(hit(M.safetyCheck({ ...base, last24H: 9 })), ['last24']);
});
test('6+ days in a row', () => {
  assert.deepEqual(hit(M.safetyCheck({ ...base, daysInRow: 6 })), ['daysInRow']);
  assert.deepEqual(hit(M.safetyCheck({ ...base, daysInRow: 5 })), []);
});
test('the 10h hard limit blocks; the four warnings only caution', () => {
  assert.equal(M.safetyCheck({ ...base, shiftH: 10 }).status, 'limit');
  assert.equal(M.safetyCheck({ ...base, shiftH: 6, daysInRow: 7 }).status, 'caution');
});
test('Friday Gold slot 10 PM-12 AM, online since 6:10 PM: caution, late night + long shift', () => {
  const S = M.safetyCheck({ shiftH: 0.25, clockH: 18 + 25 / 60, last24H: 0.25, daysInRow: 1 }, { startH: 22, endH: 24 });
  assert.equal(S.status, 'caution');
  assert.deepEqual(hit(S), ['lateNight', 'longShift']);
  near(S.shiftH, 0.25 + 24 - (18 + 25 / 60));
});
test('an evening slot that ends before 10 PM does not trigger late night', () => {
  const S = M.safetyCheck({ shiftH: 1, clockH: 17, last24H: 1, daysInRow: 1 }, { startH: 19, endH: 21 });
  assert.equal(hit(S).includes('lateNight'), false);
});
test('a slot that would pass 10 hours is a limit', () => {
  assert.equal(M.safetyCheck({ shiftH: 8, clockH: 20, last24H: 8, daysInRow: 1 }, { startH: 22, endH: 24 }).status, 'limit');
});
