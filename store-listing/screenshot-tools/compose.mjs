// Frames the raw screenshots: gradient background, localized headline + subtitle, phone bezel.
// usage: node compose.mjs <workdir> <outdir> [lang ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

import { LOCALES, SHOTS } from './content.mjs';

const [, , WORK, OUT, ...only] = process.argv;
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function page(lang, raw, [headline, sub]) {
  const rtl = lang === 'ar';
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;800&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body {
    background:
      radial-gradient(1100px 820px at 0% 0%, rgba(255, 92, 122, 0.95), rgba(255, 92, 122, 0) 70%),
      radial-gradient(900px 1100px at 108% 100%, rgba(123, 77, 255, 0.85), rgba(123, 77, 255, 0) 70%),
      #121219;
    font-family: Inter, 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans CJK SC', 'Noto Sans', sans-serif;
    color: #fff;
  }
  .text { position: absolute; top: 96px; left: 60px; right: 60px; text-align: center; }
  h1 { font-size: 88px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.12; white-space: nowrap; }
  p { margin-top: 20px; font-size: 45px; font-weight: 400; color: rgba(255, 255, 255, 0.86); line-height: 1.3; }
  .phone {
    position: absolute; left: 146px; top: 392px; width: 788px; height: 1640px;
    background: #0E0F13; border-radius: 92px; border: 14px solid #1B1C23;
    box-shadow: 0 0 0 2px #30323C, 0 40px 120px rgba(0, 0, 0, 0.55);
    padding-top: 22px; overflow: hidden;
  }
  .phone img { display: block; width: 100%; border-radius: 0 0 0 0; }
</style></head><body>
  <div class="text"><h1 id="h">${esc(headline)}</h1><p id="s">${esc(sub)}</p></div>
  <div class="phone"><img src="${raw}"></div>
<script>
  // Shrink the headline to one line where possible; wrap only below 66px.
  const h = document.getElementById('h'), s = document.getElementById('s');
  for (let size = 88; h.scrollWidth > 960 && size > 66; size -= 2) h.style.fontSize = size + 'px';
  if (h.scrollWidth > 960) h.style.whiteSpace = 'normal';
  for (let size = 45; s.scrollHeight > 64 && size > 32; size -= 1) s.style.fontSize = size + 'px';
</script></body></html>`;
}

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const lang of only.length ? only : Object.keys(LOCALES)) {
  const c = LOCALES[lang];
  const dir = `${OUT}/${c.play.split(' ')[0]}`;
  mkdirSync(dir, { recursive: true });
  for (const [i, name] of SHOTS.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const html = `${WORK}/frame-${lang}-${n}.html`;
    writeFileSync(html, page(lang, `file://${WORK}/raw/${lang}/${n}-${name}.png`, c.captions[i]));
    await p.goto(`file://${html}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${dir}/phone-${n}-${name}.png` });
  }
  process.stdout.write(`${lang} `);
}
await browser.close();
console.log('done');
