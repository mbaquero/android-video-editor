// Drives the web build of the app in each language and saves raw 1080x2112 screenshots.
// usage: node capture.mjs <workdir> <repo> [lang ...]
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

import { LOCALES } from './content.mjs';

const [, , WORK, REPO, ...only] = process.argv;
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const MEDIA = (f) => `${WORK}/media/${f}`;

function loadStrings(lang) {
  const src = readFileSync(`${REPO}/src/i18n/locales/${lang}.ts`, 'utf8');
  const out = {};
  for (const m of src.matchAll(/^\s*'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),\s*$/gm)) {
    out[m[1]] = (m[2] ?? m[3]).replace(/\\(.)/g, '$1');
  }
  return out;
}

const CSS = `
  video { width: 100% !important; height: 100% !important; object-fit: contain; }
  ::-webkit-scrollbar { display: none; }
`;

async function run(browser, lang) {
  const t = loadStrings(lang);
  const tr = (key, params = {}) => t[key].replace(/\{(\w+)\}/g, (_, k) => String(params[k]));
  const c = LOCALES[lang];
  const ctx = await browser.newContext({ locale: lang, viewport: { width: 360, height: 704 }, deviceScaleFactor: 3 });
  await ctx.addInitScript((css) => {
    const rtl = /^ar/.test(navigator.language);
    document.addEventListener('DOMContentLoaded', () => {
      if (rtl) document.documentElement.dir = 'rtl';
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      if (!rtl) return;
      // react-native-web gives every Text dir="auto"; on Android all text follows the layout direction.
      const fix = (root) => root.querySelectorAll?.('[dir="auto"]').forEach((el) => el.removeAttribute('dir'));
      fix(document);
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.getAttribute('dir') === 'auto' && n.removeAttribute('dir'), fix(n))))).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['dir'] });
    });
  }, CSS);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => !/play\(\) request was interrupted/.test(e.message) && console.log(lang, 'pageerror', e.message));
  const out = `${WORK}/raw/${lang}`;
  mkdirSync(out, { recursive: true });

  const button = (label, nth = 0) => p.getByRole('button').filter({ has: p.getByText(label, { exact: true }) }).nth(nth);
  const tab = (key) => p.getByRole('tab').filter({ has: p.getByText(tr(key), { exact: true }) });
  const scrub = async (fraction) => {
    const bb = await p.locator('[role=slider]').first().boundingBox();
    // The web slider maps clicks left-to-right even in RTL, so the same fraction gives the same time.
    await p.mouse.click(bb.x + bb.width * fraction, bb.y + bb.height / 2);
    await p.waitForTimeout(900);
  };
  const selectClip = async (n) => {
    await p.locator(`[aria-label="${tr('timeline.clip', { n })}"]`).click();
    await p.waitForTimeout(1200);
  };
  const panelTop = async () => {
    await p.evaluate(() => document.querySelectorAll('[class*="r-150rngu"], div').forEach((d) => d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY !== 'visible' && (d.scrollTop = 0)));
  };
  const shot = async (name) => {
    await p.mouse.move(0, 0);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/${name}.png` });
  };

  await p.goto('http://localhost:8765/');
  const newProject = button(tr('home.newProject'));
  await newProject.waitFor();
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), newProject.click()]);
  await fc.setFiles(['sunset.mp4', 'sea.mp4', 'mountains.jpg', 'city.mp4'].map(MEDIA));
  await tab('tool.edit').waitFor();
  await p.waitForTimeout(3000);

  // 1. Trim
  await scrub(0.5);
  await shot('01-edit');

  // 2. Titles
  await tab('tool.text').click();
  await scrub(0.3);
  await button(tr('text.addAtPlayhead')).click();
  const titleInput = p.getByPlaceholder(tr('text.placeholder'), { exact: true });
  await titleInput.fill(c.title);
  await titleInput.blur();
  await scrub(0.42);
  await shot('02-text');

  // 3. Captions from a pasted script
  await tab('tool.captions').click();
  await p.getByPlaceholder(tr('text.scriptPlaceholder'), { exact: true }).fill(c.script);
  await button(tr('text.fromScript')).click();
  await p.waitForTimeout(500);
  await panelTop();
  await scrub(0.45);
  await shot('03-captions');

  // 4. Speed ramp on the sea clip
  await selectClip(2);
  await tab('tool.speed').click();
  await button(tr('ramp.hero')).click();
  await scrub(0.45);
  await shot('04-speed');

  // 5. Cinematic filter on the city clip
  await selectClip(4);
  await tab('tool.filters').click();
  await button(tr('preset.cinematic')).click();
  await scrub(0.5);
  await shot('05-filters');

  // 6. Background music
  await tab('tool.audio').click();
  const [ac] = await Promise.all([p.waitForEvent('filechooser'), button(tr('audio.music')).click()]);
  await ac.setFiles(MEDIA('summer-breeze.mp3'));
  await p.waitForTimeout(1500);
  await panelTop();
  await shot('06-audio');

  // 7. Transitions between all clips
  await selectClip(1);
  await tab('tool.transitions').click();
  await button(tr('transition.fade'), 1).click();
  await button(tr('transition.applyAll')).click();
  await panelTop();
  await scrub(0.55);
  await shot('07-transitions');

  // 8. Aspect ratio
  await tab('tool.format').click();
  await button(tr('aspect.9:16')).click();
  await scrub(0.6);
  await shot('08-format');

  await ctx.close();
}

const browser = await chromium.launch({ executablePath: exe });
for (const lang of only.length ? only : Object.keys(LOCALES)) {
  process.stdout.write(`${lang} `);
  await run(browser, lang);
}
await browser.close();
console.log('done');
