/* WCAG AA colour-contrast check (axe-core) on every tab and driving mode, all scenarios. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { openApp, pickScenario, pickTab } from './screens.mjs';

const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const { page } = await openApp(browser, 420);
await page.addScriptTag({ content: axe });
const seen = new Map();
async function run(where) {
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document.body, { runOnly: ['color-contrast'] });
    return res.violations.flatMap((v) => v.nodes.map((n) => ({ t: n.target.join(' '), html: n.html.slice(0, 90), msg: (n.any[0] && n.any[0].message) || '' })));
  });
  r.forEach((x) => { const k = x.html + x.msg.split('.')[0]; if (!seen.has(k)) seen.set(k, { ...x, where }); });
}
const days = ['Wed', 'Fri', 'Sun'];
for (let i = 0; i < 3; i++) {
  await pickScenario(page, i);
  for (const t of ['Home', 'Earnings', 'Opportunities', 'Menu']) { await pickTab(page, t); await run(`${days[i]} ${t}`); }
  const fab = page.locator('button', { hasText: 'Simulate driving' });
  if (await fab.count()) { await fab.click(); await page.waitForTimeout(100); await run(`${days[i]} Driving`); await page.locator('button', { hasText: 'Stop' }).click(); }
}
for (const v of seen.values()) console.log(`${v.where} | ${v.html}\n   ${v.msg}`);
console.log(`${seen.size} contrast issue(s)`);
await browser.close();
process.exitCode = seen.size ? 1 : 0;
