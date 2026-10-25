# Simple Video Editor (Android)

An Expo / React Native app for everyday video edits. All rendering happens on-device with
Google's [Media3 Transformer](https://developer.android.com/media/media3/transformer) through a
local Expo module (`modules/video-engine`), using hardware encoders. No FFmpeg.

## Features

| Tool | What it does |
| --- | --- |
| Edit | Trim start/end, split at the playhead, duplicate, reorder, delete, clip volume/mute, noise reduction |
| Merge | Any number of videos and photos in one timeline (photos get an adjustable duration) |
| Speed | 0.1x–8x constant speed, plus ramps (Montage, Hero, Bullet, Flash in/out); audio follows |
| Text | Titles with position, size, colour, background box, and fade / slide / pop / typewriter animations |
| Captions | Timed subtitle lines, `.srt` / `.vtt` import, script → evenly timed captions, "apply style to all" |
| Audio | Background music (loop, fade in/out), sound effects and voiceover recording at the playhead, volume, de-noise |
| Filters | 10 presets plus brightness, contrast, saturation, warmth, vignette; apply to all clips |
| Transitions | Fade to black, white flash, wipe, slide, zoom, circle reveal; intro/outro |
| Green screen | Chroma key (green/blue) with strength + edge softness, replaced by a colour or photo |
| Format | Original, 9:16, 1:1, 4:5, 16:9; fit (bars) or fill (crop); 720p / 1080p |

Plus undo/redo, a quick 480p rendered preview, save to gallery and share.

## Run it

Requires Node, the Android SDK and a **JDK 17** (a JRE alone is not enough — `javac` must exist):

```sh
sudo apt install openjdk-17-jdk-headless   # if `javac -version` fails
npm install
npm run android        # prebuilds android/, builds and installs a dev build on a device/emulator
```

To build an installable APK: `npm run prebuild && cd android && ./gradlew assembleRelease`
(output: `android/app/build/outputs/apk/release/app-release.apk`, signed with the debug key).

The `android/` folder is generated (Continuous Native Generation) — configure native behaviour in
`app.json`, never edit `android/` by hand.

## How it works

- `src/state` — project model (clips, texts, audio tracks, format) in a reducer with undo history.
- `src/lib/timeline.ts` — duration math and conversion to the engine's JSON format. Clip times are
  in each source's timeline; text and audio times are in the output timeline.
- `modules/video-engine/android` — Kotlin:
  - `CompositionFactory` builds a Media3 `Composition`: one audio+video sequence of clips plus one
    audio-only sequence per music/voiceover/SFX track.
  - `ClipLookEffect` is a single GLSL pass per clip for colour grading, vignette, chroma key and
    transitions.
  - `AnimatedTextOverlay` draws text/captions as bitmap overlays with time-based animation.
  - `AudioFxProcessor` handles volume, fades and de-noise (high-pass + downward expander).
- Media3 is pinned to the same version as `expo-video` (see `modules/video-engine/android/build.gradle`).

## Limitations

- The in-editor preview shows trim, speed, volume, framing and text placement live; filters,
  transitions and chroma key are only visible in the rendered preview / export.
- Transitions are "through" effects (each clip fades/wipes out and the next in) rather than
  overlapping cross-dissolves, so they don't change the video length.
- No AI auto-captions yet: captions come from manual entry, `.srt`/`.vtt` files or a pasted script.
