/* Renders the built index.html in Chromium and screenshots every tab and
   driving mode for each scenario. Usage: node scripts/screens.mjs [outDir] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const out = process.argv[2] || 'screens';
mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.resolve('index.html')).href;
const SCEN = [['login', 'Wed'], ['gold', 'Fri'], ['rest', 'Sun']];
const TABS = ['Home', 'Earnings', 'Opportunities', 'Menu'];

export async function openApp(browser, width = 1200) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('nav[aria-label="Primary"]');
  return { page, errors };
}
export async function pickScenario(page, i) {
  await page.locator('[aria-labelledby="moments-h"] button').nth(i).click();
  await page.waitForTimeout(150);
}
export async function pickTab(page, name) {
  await page.locator('nav[aria-label="Primary"] button', { hasText: name }).evaluate((el) => el.click());
  await page.waitForTimeout(150);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser);
  const { page: mob, errors: mErr } = await openApp(browser, 420); /* phone width: the app scrolls with the page */
  await mob.addStyleTag({ content: 'nav[aria-label="Primary"],.pointer-events-none{display:none!important}' });
  errors.push(...mErr);
  for (let i = 0; i < SCEN.length; i++) {
    const [id, day] = SCEN[i];
    await pickScenario(page, i); await pickScenario(mob, i);
    for (const t of TABS) {
      await pickTab(page, t); await pickTab(mob, t);
      await page.screenshot({ path: `${out}/${day}-${t}.png`, fullPage: false });
      await mob.locator('main').screenshot({ path: `${out}/${day}-${t}-full.png` });
    }
    const fab = page.locator('button', { hasText: 'Simulate driving' });
    if (await fab.count()) {
      await pickTab(page, 'Home');
      await fab.click(); await page.waitForTimeout(150);
      await page.screenshot({ path: `${out}/${day}-Driving.png` });
      await page.locator('button', { hasText: 'Stop' }).click();
    } else {
      console.log(`${day}: no driving mode (cool-down)`);
    }
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors');
  await browser.close();
}
