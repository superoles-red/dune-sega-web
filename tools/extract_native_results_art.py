#!/usr/bin/env python3
"""Append the native mission2/5/8 Results illustration after screen extraction.

Read-only original decode: tools/audit_native_results_art.c. This small addon
does not replace the live statistics framebuffer or any existing source PNG.
"""
from pathlib import Path
import argparse
import hashlib
import json
from extract_shop_ui import ROOT, png, crop
from extract_screen_assets import read_png


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--raw', type=Path, default=ROOT / '.local/outcome-art-audit')
    ap.add_argument('--output', type=Path, default=ROOT / 'data/screen-assets')
    ap.add_argument('--web', action='store_true', help='Mirror only this PNG and the canonical screen manifest')
    a = ap.parse_args()
    identity = json.loads((ROOT / 'docs/source-identity.json').read_text())
    assert sha((ROOT / '.local/source/build/dune-base.c').read_bytes()) == identity['generatedSourceSha256']
    expected_maps = {1: 0xa6290, 2: 0xa659a, 3: 0xa5ee4}
    records = []
    for mission, pointer in expected_maps.items():
        prefix = a.raw / f'stats-mission-{mission}'
        meta = json.loads(prefix.with_suffix('.json').read_text())
        pixels = prefix.with_suffix('.plane-b.rgb').read_bytes()
        assert len(pixels) == 320 * 224 * 3
        assert meta['missionArgument'] == mission and meta['nativeMapPointer'] == pointer
        assert meta['nativeFunction'] == 0x26c68 and meta['nativeMapTable'] == 0x26c5c
        assert meta['readOnlyResultsGetterCpuUnchanged'] is True
        assert meta['textlessOutsideActualGlyphCellsChangedPixels'] == 0
        if mission in (1, 3):
            old = 'results-desert-background' if mission == 1 else 'results-final-tanks-background'
            assert read_png(a.output / 'art' / (old + '.png'))[3] == pixels
            meta['existingCanonicalBackgroundPixelExact'] = True
        records.append({**meta, 'planeBRgbSha256': sha(pixels)})
    # The first native wing pixels are at y99. Include the complete original
    # aircraft and the desert through y223, without cropping its upper wing.
    rect = [0, 96, 320, 128]
    native = (a.raw / 'stats-mission-2.plane-b.rgb').read_bytes()
    assert native[:96 * 320 * 3] == native[:3] * (96 * 320)
    first_ink_y = next(y for y in range(224) if native[y * 320 * 3:(y + 1) * 320 * 3] != native[:3] * 320)
    assert first_ink_y == 99
    pixels = crop(native, rect)
    relative = 'art/results-aircraft-scene.png'
    destination = a.output / relative
    png(destination, 320, 128, pixels)
    part = {
        'path': relative, 'width': 320, 'height': 128, 'channels': 3,
        'transparent': False, 'pixelSha256': sha(pixels), 'sha256': sha(destination.read_bytes()),
        'sourceRect': rect, 'sourceLayer': 'Original native Results plane B',
        'firstNativeNonSkyRow': first_ink_y, 'completeNativeNonSkyArtworkRetained': True,
        'sourceRgbSha256': sha(native), 'sourceRomMapPointer': 0xa659a,
        'nativeFunction': 0x26c68, 'nativeMapTable': 0x26c5c,
        'missionNumbers': [2, 5, 8],
        'sourceScope': 'Controlled offline original-art decode on a copied native Results fixture. Original palette, pattern banks and renderer; no repaint, rescale or colour replacement.',
        'reproduction': 'tools/audit_native_results_art.c then tools/extract_native_results_art.py',
    }
    manifest_path = a.output / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['parts']['results-aircraft-scene'] = part
    manifest['resultsMissionArt'] = {
        'selector': 'Original missionNumber modulo3, independent of victory/defeat',
        'nativeFunction': 0x26c68, 'nativeMapTable': 0x26c5c,
        'byRemainder': {
            '0': {'missions': [3, 6, 9], 'part': 'results-final-tanks-scene', 'nativeMapPointer': 0xa5ee4},
            '1': {'missions': [1, 4, 7], 'part': 'results-soldier-scene', 'nativeMapPointer': 0xa6290},
            '2': {'missions': [2, 5, 8], 'part': 'results-aircraft-scene', 'nativeMapPointer': 0xa659a},
        },
        'presentationScope': 'Static modern completion/password ornament only. Live original Results and outcome movies keep their native framebuffers.',
    }
    manifest['pngCount'] = len(list(a.output.rglob('*.png')))
    manifest['pngBytes'] = sum(p.stat().st_size for p in a.output.rglob('*.png'))
    manifest_path.write_bytes(encode(manifest))
    proof_dir = ROOT / 'data/native-results-art'
    proof_dir.mkdir(exist_ok=True)
    proof = {'version': 1, 'romSha256': identity['romSha256'],
             'generatedSourceSha256': identity['generatedSourceSha256'],
             'auditHelperSha256': sha((ROOT / 'tools/audit_native_results_art.c').read_bytes()),
             'frameGetterHeaderSha256': sha((ROOT / 'tools/em_web_frame.h').read_bytes()),
             'extractorSha256': sha(Path(__file__).read_bytes()),
             'nativeVariants': records, 'exportedPart': part,
             'claims': {'originalInputsUnchanged': True, 'runtimeGameInstructionsChanged': False,
                        'naturallyPlayedAllMissions': False,
                        'readOnlyGetterWholeCpuUnchanged': True,
                        'readOnlyGetterPixelsOutsideActualGlyphCellsUnchanged': True}}
    (proof_dir / 'proof.json').write_bytes(encode(proof))
    if a.web:
        web = ROOT / 'web/ui-assets/screen-assets'
        (web / relative).parent.mkdir(parents=True, exist_ok=True)
        (web / relative).write_bytes(destination.read_bytes())
        (web / 'manifest.json').write_bytes(manifest_path.read_bytes())
    print(json.dumps({'pass': True, 'part': 'results-aircraft-scene', 'size': [320, 128],
                      'bytes': destination.stat().st_size, 'sha256': part['sha256'],
                      'nativeVariantsVerified': 3, 'outsideSourceGlyphChanges': 0,
                      'webMirrored': a.web}))


if __name__ == '__main__':
    main()
