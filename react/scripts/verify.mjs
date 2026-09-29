/* Verification: for each scenario, prints the metrics shown on every tab and
   asserts the PM-review invariants. Engine checks run in Node; screen checks
   run against the built index.html in Chromium.
   Usage: npm run build && node scripts/verify.mjs [reportFile] */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import * as E from '../src/engine.js';
import * as M from '../src/metrics.js';
import { openApp, pickScenario, pickTab } from './screens.mjs';

const report = [];
const log = (s = '') => { report.push(s); console.log(s); };
const fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); };
const DAY = E.DAY, DAYS = ['Wed', 'Fri', 'Sun'];

/* ---------- engine-level checks ---------- */
function recomputeZoneLever(snap) {
  /* independent recomputation from raw seeded records, last 4 weeks */
  const recs = snap.recs.filter((r) => r.s >= snap.now - 28 * DAY);
  const hrs = recs.reduce((t, r) => t + r.dur, 0);
  const groups = {};
  recs.forEach((r) => {
    const d = new Date(r.s).getDay(), wk = d === 0 || d === 6 ? 'weekend' : 'weekday', k = `${r.zone}|${wk}`;
    const g = (groups[k] = groups[k] || { earn: 0, online: 0, shifts: new Set() });
    g.earn += r.fare + r.tips; g.online += r.dur; g.shifts.add(r.shift);
  });
  let best = null;
  for (const wk of ['weekday', 'weekend']) for (const f of E.ZONES) for (const t of E.ZONES) {
    if (f.id === t.id || E.travel(f.id, t.id) > M.RULES.maxDrive) continue;
    const A = groups[`${f.id}|${wk}`], B = groups[`${t.id}|${wk}`];
    if (!A || !B || A.online < E.MIN_ZONE_H || B.online < E.MIN_ZONE_H) continue;
    const a = A.earn / A.online, b = B.earn / B.online, H = A.online / A.shifts.size, d = E.travel(f.id, t.id) / 60;
    const zoneGain = (b * (H - d) - a * H) / H;          // drive unpaid, once per block
    if (zoneGain <= 0) continue;
    const g = (zoneGain * A.online) / hrs;
    if (!best || g > best.g) best = { g, wk, from: f.id, to: t.id, zoneGain, a, b, hA: A.online, hB: B.online };
  }
  return best && best.g >= 0.25 ? best : null;
}

/* ---------- screen helpers ---------- */
const mainText = (page) => page.locator('main').innerText();
async function rateNodes(page) {
  return page.$$eval('[data-num][data-den][data-shown]', (els) => els.map((e) => ({ m: e.dataset.metric, num: +e.dataset.num, den: +e.dataset.den, shown: e.dataset.shown })));
}
function checkRates(nodes, where) {
  let bad = 0;
  nodes.forEach((n) => {
    if (!n.den || n.shown === '–') return;
    const want = (100 * n.num) / n.den, got = parseFloat(n.shown);
    if (Math.abs(want - got) > 0.5 + 1e-9) { bad++; log(`    mismatch ${where} ${n.m}: ${n.num}/${n.den}=${want.toFixed(1)}% shown ${n.shown}`); }
  });
  return bad;
}
const numbersIn = (text) => text.split('\n').map((l) => l.trim()).filter((l) => /\d/.test(l));

const browser = await chromium.launch();
const { page, errors } = await openApp(browser, 420);
await page.addStyleTag({ content: 'nav[aria-label="Primary"],.pointer-events-none{display:none!important}' });

for (let i = 0; i < E.MOMENTS.length; i++) {
  const m = E.MOMENTS[i], snap = E.snapshot(m), dec = E.decide(snap, {}), day = DAYS[i];
  log(`\n==================== ${day}: ${m.id} (state: ${dec.state}) ====================`);
  await pickScenario(page, i);
  const liveSurge = E.ZONES.filter((z) => M.surgePricingOn(E.surgeAt(z.id, snap.now)));
  log(`Surge multipliers now: ${E.ZONES.map((z) => `${z.name} ${E.surgeAt(z.id, snap.now).toFixed(2)}x`).join(', ')}`);

  /* ---- print every metric shown on each tab ---- */
  const texts = {};
  for (const t of ['Home', 'Earnings', 'Opportunities', 'Menu']) {
    await pickTab(page, t);
    texts[t] = await mainText(page);
    log(`\n--- ${t} ---`);
    numbersIn(texts[t]).forEach((l) => log(`  ${l}`));
  }
  const fab = page.locator('button', { hasText: 'Simulate driving' });
  let drivingText = null;
  if (await fab.count()) {
    await pickTab(page, 'Home');
    await fab.evaluate((el) => el.click()); await page.waitForTimeout(100);
    drivingText = await mainText(page);
    log('\n--- Driving mode ---');
    numbersIn(drivingText).forEach((l) => log(`  ${l}`));
    await page.locator('button', { hasText: 'Stop' }).evaluate((el) => el.click());
  } else log('\n--- Driving mode --- (not available)');

  log(`\nChecks, ${day}:`);

  /* 1. every displayed percentage equals numerator/denominator (all standing periods, Earnings periods) */
  await pickTab(page, 'Home');
  let bad = 0, n = 0;
  for (const w of ['Past day', '1 week', 'Past month', 'This quarter']) {
    await page.locator('[aria-label="Standing period"] button', { hasText: w }).evaluate((el) => el.click());
    await page.waitForTimeout(50);
    const nodes = await rateNodes(page); n += nodes.length; bad += checkRates(nodes, `Home/${w}`);
  }
  await pickTab(page, 'Earnings');
  for (const p of (dec.state === 'cool' ? ['Today'] : ['Today', 'Week', 'Month', 'Quarter', 'Year'])) {
    if (dec.state !== 'cool') await page.locator('[aria-label="Period"] button', { hasText: p }).evaluate((el) => el.click());
    await page.waitForTimeout(50);
    const nodes = await rateNodes(page); n += nodes.length; bad += checkRates(nodes, `Earnings/${p}`);
  }
  const G = E.goldElig(snap);
  G.rows.filter((r) => r.den != null).forEach((r) => { n++; if (Math.abs(parseFloat(r.you) - (100 * r.num) / r.den) > 0.5) { bad++; log(`    mismatch Gold ${r.k}`); } });
  check(bad === 0 && n > 0, `every displayed rate equals numerator/denominator within 0.5 pt (${n} rates checked)`);
  ['day', 'week', 'month', 'quarter'].forEach((w) => {
    const a = E.standingWindow(snap, w).a;
    if (a.accepted !== a.trips + a.cancels) fails.push(`trips != accepted - cancels (${w})`);
  });
  const am = E.standingWindow(snap, 'month').a;
  check(['day', 'week', 'month', 'quarter'].every((w) => { const a = E.standingWindow(snap, w).a; return a.accepted === a.trips + a.cancels; }),
    `completed trips = accepted - cancelled in every period (month: ${am.accepted} - ${am.cancels} = ${am.trips})`);

  /* 2. shift breakdown parts add up to the gap vs usual */
  const opts = await page.$$eval('#shift-pick option', (os) => os.map((o) => o.value));
  let splitBad = 0, splits = 0;
  for (const v of opts) {
    await page.selectOption('#shift-pick', v); await page.waitForTimeout(30);
    const all = await page.$$eval('[data-split]', (els) => els.map((e) => JSON.parse(e.dataset.split)));
    all.forEach((S) => { splits++; const sum = S.parts.reduce((t, x) => t + x, 0); if (Math.abs(sum - S.gap) > 0.05) splitBad++; });
  }
  check(splits > 0 && splitBad === 0, `shift breakdown parts add up to the gap vs usual within $0.05 (${splits} shifts)`);

  /* 3. thresholds match across screens */
  await pickTab(page, 'Home');
  const shownTh = await page.$$eval('[data-threshold]', (els) => els.map((e) => [e.dataset.threshold, e.textContent]));
  const thOk = shownTh.every(([k, v]) => M.THRESHOLDS[k].label === v);
  const allText = Object.values(texts).join('\n') + (drivingText || '');
  const acceptGoals = [...allText.matchAll(/(\d+)%\+/g)].map((x) => x[1]);
  const goalOk = acceptGoals.every((g) => ['70', '92'].includes(g));
  const needOk = G.rows.every((r) => r.need === M.THRESHOLDS[r.key].need);
  const menuOk = texts.Menu.includes(M.THRESHOLDS.acceptance.need) || dec.state === 'cool';
  check(thOk && goalOk && needOk && menuOk, `thresholds match across screens (Home goals ${shownTh.map((x) => x.join('=')).join(', ')}; Gold standard ${G.rows.map((r) => r.need).join(', ')})`);

  /* 4. no "surging" label when the surge multiplier is 1.0x */
  const surgingWord = /surging/i.test(allText);
  const surgeOnClaim = /Surge pricing is on|Surge pricing \d/.test(texts.Home + texts.Opportunities);
  check(!surgingWord && (liveSurge.length > 0 || !surgeOnClaim), `no "surging" label and no surge-pricing-on claim while every multiplier is ${liveSurge.length ? 'not ' : ''}1.0x`);

  /* 5. Sunday: no live surge or earning prompt anywhere */
  if (dec.state === 'cool') {
    const prompts = [/Go online(?! is locked)/, /Head to/, /after the drive/, /Surge pricing now/, /Demand near you/, /Accept slot/, /Simulate driving/, /Gold offer/];
    const found = prompts.filter((re) => re.test(allText.replace(/Go online is locked/g, '')));
    const todayLocked = texts.Opportunities.includes("You're not eligible to see options for today");
    const afterRest = /best window after your rest/i.test(texts.Home);
    check(found.length === 0 && todayLocked && afterRest && drivingText === null,
      `cool-down: no live surge, earning prompt or driving mode; today's options hidden; best window after rest shown${found.length ? ` (found: ${found.join(' ')})` : ''}`);
  }

  /* 6. Waterfront vs Downtown recommendation matches Alex's seeded 4-week history */
  const want = recomputeZoneLever(snap), got = E.maximizeLevers(snap).list.find((l) => l.key === 'zone');
  if (want) log(`  Recomputed from raw history: ${want.wk}, ${E.Z[want.to].name} $${want.b.toFixed(2)}/hr over ${want.hB.toFixed(1)}h vs ${E.Z[want.from].name} $${want.a.toFixed(2)}/hr over ${want.hA.toFixed(1)}h -> +$${want.zoneGain.toFixed(2)}/hr after the drive`);
  const leverOk = want && got && got.from === want.from && got.to === want.to && Math.abs(got.zoneGain - want.zoneGain) < 0.01;
  let domOk = true;
  if (dec.state !== 'cool') {
    await pickTab(page, 'Earnings');
    const dom = await page.$$eval('[data-lever="zone"]', (els) => els.map((e) => ({ from: e.dataset.from, to: e.dataset.to, g: +e.dataset.zoneGain })));
    domOk = dom.length === 1 && dom[0].from === want.from && dom[0].to === want.to && Math.abs(dom[0].g - want.zoneGain) < 0.01;
  }
  if (m.id !== 'gold') check(leverOk && domOk && want.from === 'dt' && want.to === 'wf', `"Waterfront vs Downtown" matches Alex's seeded 4-week history`);
  else check(leverOk && domOk, `zone lever matches this history (${want ? `${E.Z[want.to].name} vs ${E.Z[want.from].name}` : 'none'})`);

  /* extra: driving mode reads the scenario */
  const V = E.drivingView(snap, dec);
  if (V) check(drivingText && drivingText.includes(V.action.title) && (!V.action.mins || drivingText.includes(`${V.action.mins} min`)), `driving mode shows this scenario's action: ${V.action.title}${V.action.mins ? ` · ${V.action.mins} min from ${E.Z[V.from].name}` : ''}`);
}

check(errors.length === 0, `no console errors (${errors.length})`);
await browser.close();
log(`\n${fails.length ? `FAILED: ${fails.length}\n - ${fails.join('\n - ')}` : 'ALL CHECKS PASSED'}`);
if (process.argv[2]) writeFileSync(process.argv[2], report.join('\n'));
process.exitCode = fails.length ? 1 : 0;
