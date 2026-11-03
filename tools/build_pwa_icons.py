#!/usr/bin/env python3
"""Reproduce small PWA icons using only original extracted title-screen pixels."""
import hashlib
import json
from pathlib import Path

from extract_screen_assets import read_png
from extract_shop_ui import png

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'web/ui-assets/screen-assets/art/title-complete-without-choices.png'


def build():
    source = ROOT / SOURCE
    width, height, channels, pixels = read_png(source)
    assert (width, height, channels) == (320, 224, 3)
    # Square black letterbox; no repainting, smoothing or fabricated artwork.
    side = width
    square = bytearray(side * side * channels)
    offset = (side - height) // 2
    for y in range(height):
        square[(y + offset) * side * channels:(y + offset + 1) * side * channels] = pixels[y * width * channels:(y + 1) * width * channels]
    target = ROOT / 'web/icons'
    target.mkdir(exist_ok=True)
    files = {}
    for size in (180, 192, 512):
        data = bytearray(size * size * channels)
        for y in range(size):
            sy = y * side // size
            for x in range(size):
                sx = x * side // size
                start = (sy * side + sx) * channels
                dest = (y * size + x) * channels
                data[dest:dest + channels] = square[start:start + channels]
        path = target / f'dune-{size}.png'
        png(path, size, size, data, channels)
        files[path.name] = {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    proof = {'source': SOURCE, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
             'method': 'Original complete title image; centered black square; nearest-neighbor resize; no new drawn pixels', 'files': files}
    (target / 'provenance.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    return proof


if __name__ == '__main__':
    print(json.dumps(build()))
