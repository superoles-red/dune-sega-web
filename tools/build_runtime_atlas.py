#!/usr/bin/env python3
"""Pack the unchanged native PNGs into one lossless, source-bound download.

Standard library only. Original files, colour/alpha values and geometry remain
unchanged. The atlas is a transport optimisation, not new or repainted artwork.
"""
from pathlib import Path
import argparse
import hashlib
import json
from extract_screen_assets import read_png
from extract_shop_ui import png

ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ['ui-assets/shop-layout-kit/manifest.json', 'ui-assets/screen-assets/manifest.json', 'language-assets/manifest.json']

def sha(data):
    return hashlib.sha256(data).hexdigest()

def sources(root=ROOT):
    web = root / 'web'
    found = {}
    for group, folder in [('shop', 'shop-layout-kit'), ('screen', 'screen-assets')]:
        m = json.loads((web / 'ui-assets' / folder / 'manifest.json').read_text())
        paths = {p['path'] for p in m['parts'].values()} | {f['path'] for f in m['fonts'].values() if f.get('path')} | {s['path'] for a in m.get('animations', {}).values() for s in a.get('states', []) if s.get('path')}
        for path in sorted(paths):
            found[group + ':' + path] = 'ui-assets/' + folder + '/' + path
    m = json.loads((web / 'language-assets/manifest.json').read_text())
    for locale in m['languages']:
        f = locale.get('font') or {}
        for path in [f.get('maskPath'), f.get('shadowPath'), *locale.get('commands', {}).values()]:
            if path:
                found['locale:' + path] = 'language-assets/' + path
    return dict(sorted(found.items()))

def rgba(path):
    w, h, ch, pixels = read_png(path)
    if ch == 3:
        pixels = b''.join(pixels[i:i+3] + b'\xff' for i in range(0, len(pixels), 3))
    return w, h, pixels

def build(root=ROOT):
    web = root / 'web'
    images = {key: rgba(web / path) for key, path in sources(root).items()}
    width = 2048
    x = y = row = 0
    positions = {}
    for key in sorted(images, key=lambda k: (-images[k][1], -images[k][0], k)):
        w, h, _ = images[key]
        if w > width:
            raise ValueError('Atlas source is too wide: ' + key)
        if x + w > width:
            x = 0
            y += row
            row = 0
        positions[key] = [x, y, w, h]
        x += w
        row = max(row, h)
    height = y + row
    if height > 2048:
        raise ValueError('Native atlas exceeds the bounded 2048x2048 canvas')
    pixels = bytearray(width * height * 4)
    entries = {}
    for key, path in sources(root).items():
        x, y, w, h = positions[key]
        original = images[key][2]
        for yy in range(h):
            start = ((y+yy)*width+x)*4
            pixels[start:start+w*4] = original[yy*w*4:(yy+1)*w*4]
        entries[key] = {'source': path, 'sha256': sha((web/path).read_bytes()), 'rgbaSha256': sha(original), 'rect': positions[key]}
    target = web / 'ui-assets/runtime-atlas.png'
    png(target, width, height, pixels, 4)
    manifest = {'version': 1, 'path': 'runtime-atlas.png', 'width': width, 'height': height,
                'sha256': sha(target.read_bytes()), 'rgbaSha256': sha(pixels), 'assets': entries,
                'inputs': {path: sha((web/path).read_bytes()) for path in MANIFESTS}}
    (web/'ui-assets/runtime-atlas.json').write_text(json.dumps(manifest, indent=2, sort_keys=True)+'\n')
    return verify(root)

def verify(root=ROOT):
    web = root / 'web'
    m = json.loads((web/'ui-assets/runtime-atlas.json').read_text())
    expected = sources(root)
    if m['version'] != 1 or set(m['assets']) != set(expected) or set(m['inputs']) != set(MANIFESTS):
        raise ValueError('Native atlas manifest is incomplete')
    for path in MANIFESTS:
        if sha((web/path).read_bytes()) != m['inputs'][path]:
            raise ValueError('Native atlas metadata changed: ' + path)
    atlas = web/'ui-assets/runtime-atlas.png'
    if m['path'] != atlas.name or sha(atlas.read_bytes()) != m['sha256']:
        raise ValueError('Native atlas PNG changed')
    width, height, pixels = rgba(atlas)
    if any(type(m.get(k)) is not int for k in ['width','height']) or [width, height] != [m['width'], m['height']] or max(width, height) > 2048 or sha(pixels) != m['rgbaSha256']:
        raise ValueError('Native atlas dimensions or pixels changed')
    for key, path in expected.items():
        entry = m['assets'][key]
        if entry['source'] != path or sha((web/path).read_bytes()) != entry['sha256']:
            raise ValueError('Native atlas source changed: ' + key)
        w, h, original = rgba(web/path)
        rect=entry.get('rect')
        if not isinstance(rect,list) or len(rect)!=4 or any(type(v) is not int for v in rect):
            raise ValueError('Native atlas crop must contain four integers: '+key)
        x, y, aw, ah = rect
        if [aw, ah] != [w, h] or min(x, y) < 0 or x+w > width or y+h > height:
            raise ValueError('Native atlas crop outside image: ' + key)
        crop = b''.join(pixels[((y+yy)*width+x)*4:((y+yy)*width+x+w)*4] for yy in range(h))
        if crop != original or sha(crop) != entry['rgbaSha256']:
            raise ValueError('Native atlas original pixels differ: ' + key)
    return {'imagesVerified': len(expected), 'pngBytes': atlas.stat().st_size, 'width': width, 'height': height,
            'originalPNGBytes': sum((web/path).stat().st_size for path in expected.values())}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    print(json.dumps(verify() if args.check else build()))
