"""Generates the sample clips used in the store screenshots (original artwork, no external media)."""
import math
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 720, 1280, 30


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def gradient(stops, w=W, h=H):
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / (h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                d.line([(0, y), (w, y)], fill=lerp(hexc(c0), hexc(c1), (t - p0) / (p1 - p0)))
                break
    return im


def ridge(d, base, amp, freqs, color, phase=0.0):
    pts = [(0, H)]
    for x in range(0, W + 8, 8):
        y = base + sum(a * math.sin(x * f + p + phase) for a, f, p in zip(amp, freqs, (0.3, 1.7, 4.1)))
        pts.append((x, y))
    pts.append((W, H))
    d.polygon(pts, fill=hexc(color))


def glow(im, cx, cy, r, color, alpha):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=hexc(color) + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.35))
    im.paste(layer, (0, 0), layer)


def sunset(t):
    im = gradient([(0, '#F99A5B'), (0.45, '#D9667A'), (0.75, '#8C3F78'), (1, '#3B2050')])
    cy = 560 - 40 * t
    glow(im, 360, cy, 260, '#FFC27A', 90)
    d = ImageDraw.Draw(im)
    for r, a in ((190, '#E98A7E'), (140, '#F2A783')):
        d.ellipse([360 - r, cy - r, 360 + r, cy + r], fill=hexc(a))
    d.ellipse([360 - 95, cy - 95, 360 + 95, cy + 95], fill=hexc('#FFD98A'))
    ridge(d, 800, (40, 25, 12), (0.008, 0.021, 0.05), '#A04A7E', t * 0.4)
    ridge(d, 900, (45, 20, 10), (0.006, 0.017, 0.043), '#7A3470', 1 + t * 0.6)
    ridge(d, 1020, (35, 22, 9), (0.007, 0.019, 0.051), '#5A2660', 2 + t * 0.8)
    ridge(d, 1130, (30, 15, 8), (0.009, 0.023, 0.06), '#3E1C4E', 3 + t)
    return im


def sea(t):
    im = gradient([(0, '#F3E7C6'), (0.5, '#CDE6E3'), (0.52, '#2C9DB5'), (1, '#0B3D63')])
    d = ImageDraw.Draw(im)
    d.ellipse([500, 170, 580, 250], fill=hexc('#FFF4CF'))
    rnd = random.Random(3)
    for i in range(46):
        y = 690 + i * 13 + (i * i) * 0.18
        if y > H:
            break
        x0 = rnd.randrange(-80, 600)
        L = rnd.randrange(80, 260)
        dx = (t * 60 * (1 + i % 3)) % 120
        d.line([(x0 + dx, y), (x0 + dx + L, y)], fill=hexc('#7FD0DE' if i % 2 else '#5AB8CC'), width=3)
    bx, by = 330 + 25 * t, 660 + 6 * math.sin(t * 6)
    d.polygon([(bx - 70, by), (bx + 80, by), (bx + 55, by + 28), (bx - 50, by + 28)], fill=hexc('#2B2340'))
    d.polygon([(bx + 5, by - 6), (bx + 5, by - 170), (bx + 70, by - 6)], fill=hexc('#FFFFFF'))
    d.polygon([(bx - 5, by - 6), (bx - 5, by - 140), (bx - 60, by - 6)], fill=hexc('#FF5C7A'))
    d.line([(bx, by), (bx, by - 175)], fill=hexc('#2B2340'), width=4)
    return im


def city(t):
    im = gradient([(0, '#161338'), (0.6, '#2E2463'), (1, '#3B2C70')])
    d = ImageDraw.Draw(im)
    rnd = random.Random(7)
    for _ in range(160):
        x, y = rnd.randrange(W), rnd.randrange(0, 760)
        tw = 0.5 + 0.5 * math.sin(t * 9 + x)
        c = int(150 + 100 * tw)
        d.point((x, y), fill=(c, c, c + 5 if c < 250 else 255))
        if rnd.random() < 0.15:
            d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(c, c, c))
    glow(im, 540, 260, 90, '#FFF6D8', 70)
    d = ImageDraw.Draw(im)
    d.ellipse([500, 220, 580, 300], fill=hexc('#FFF4D2'))
    rnd = random.Random(11)
    x = -10
    while x < W:
        bw = rnd.randrange(70, 130)
        bh = rnd.randrange(330, 620)
        top = H - bh
        d.rectangle([x, top, x + bw, H], fill=hexc('#121029'))
        for wy in range(top + 18, H - 20, 26):
            for wx in range(x + 12, x + bw - 14, 20):
                on = rnd.random() < 0.55
                flick = math.sin(t * 5 + wx * 0.31 + wy * 0.17) > 0.92
                if on != flick:
                    d.rectangle([wx, wy, wx + 8, wy + 12], fill=hexc('#F5D27A'))
        x += bw + rnd.randrange(4, 16)
    return im


def mountains():
    im = gradient([(0, '#A8C6EC'), (0.55, '#E6EEF7'), (1, '#C9D6E8')])
    d = ImageDraw.Draw(im)
    ridge(d, 640, (110, 45, 18), (0.006, 0.019, 0.05), '#8DA1C4')
    ridge(d, 780, (90, 40, 15), (0.008, 0.021, 0.047), '#6F84AB')
    ridge(d, 930, (70, 30, 12), (0.007, 0.016, 0.055), '#56698F')
    ridge(d, 1080, (50, 25, 10), (0.009, 0.024, 0.061), '#3E4E72')
    return im


def video(name, fn, seconds):
    n = seconds * FPS
    proc = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
         '-i', '-', '-f', 'lavfi', '-i', f'sine=frequency=220:duration={seconds}', '-shortest',
         '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '96k', str(OUT / name)],
        stdin=subprocess.PIPE,
    )
    for i in range(n):
        proc.stdin.write(fn(i / n).tobytes())
    proc.stdin.close()
    proc.wait()


video('sunset.mp4', sunset, 5)
video('sea.mp4', sea, 5)
mountains().save(OUT / 'mountains.jpg', quality=92)
video('city.mp4', city, 5)
subprocess.run(
    ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
     'sine=frequency=261:duration=20,volume=0.3', '-f', 'lavfi', '-i', 'sine=frequency=392:duration=20,volume=0.2',
     '-filter_complex', 'amix=inputs=2', '-c:a', 'libmp3lame', '-b:a', '128k', str(OUT / 'summer-breeze.mp3')],
    check=True,
)
print('ok')
