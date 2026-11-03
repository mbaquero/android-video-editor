# Store screenshot tools

Regenerates the localized phone screenshots in `../screenshots/<play-locale>/` (1080×1920 PNG, 8 per language). The scripts drive the app's **web build** in headless Chromium, using each language's real UI strings from `src/i18n/locales/`, then frame each raw shot with a translated headline.

## Files

| File | What it does |
| --- | --- |
| `make_media.py` | Draws the sample clips (sunset, sea, mountain photo, city at night) and a music track. Original artwork. |
| `patch_web_rtl.py` | Makes the web export mirror right-to-left for Arabic, like the Android app does. |
| `capture.mjs` | Opens the editor in each language, builds the sample project and saves raw 1080×2112 shots. |
| `compose.mjs` | Frames the raw shots: gradient background, headline, subtitle and phone bezel. |
| `content.mjs` | Per-language headlines and subtitles, the sample title and caption script, and the Play locale for each folder. |

## Running

Needs Python 3 with Pillow, ffmpeg, and a Playwright Chromium build. Work in a scratch folder outside the repo:

```bash
R=$(pwd) W=/tmp/store-shots && mkdir -p $W && cp store-listing/screenshot-tools/* $W/
(cd $W && npm init -y >/dev/null && npm i playwright-core)   # set the Chromium path at the top of capture.mjs / compose.mjs
python3 $W/make_media.py $W/media
npx expo export -p web --output-dir $W/web && python3 $W/patch_web_rtl.py $W/web
(cd $W/web && python3 -m http.server 8765 &)
(cd $W && node capture.mjs $W $R && node compose.mjs $W $R/store-listing/screenshots)
```

Pass language codes (`en es fr pt ru id zh hi bn ar`) after the paths to redo only some languages.

## Known limits

- The web preview doesn't render filter colours, so the Filters shot shows the controls, not a graded image. The same is true in the app until you tap Preview.
- Fonts come from the browser: Inter (Google Fonts) for headlines, Noto Sans for Arabic, Devanagari, Bengali and Chinese.
