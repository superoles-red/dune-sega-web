#!/usr/bin/env python3
"""Independent lossless atlas checks; standard library only, no Pillow."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from build_runtime_atlas import ROOT, MANIFESTS, build, verify, sources, sha
from extract_screen_assets import read_png
from extract_shop_ui import png


def decoded_rgba(path):
    width, height, channels, pixels = read_png(path)
    if channels == 3:
        result = bytearray(width * height * 4)
        for index in range(width * height):
            result[index*4:index*4+3] = pixels[index*3:index*3+3]
            result[index*4+3] = 255
        pixels = bytes(result)
    return width, height, pixels


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.web = self.root / 'web'
        for directory in ['ui-assets/shop-layout-kit', 'ui-assets/screen-assets', 'language-assets']:
            shutil.copytree(ROOT / 'web' / directory, self.web / directory)
        for filename in ['runtime-atlas.json', 'runtime-atlas.png']:
            shutil.copy2(ROOT / 'web/ui-assets' / filename, self.web / 'ui-assets' / filename)
        self.manifest_path = self.web / 'ui-assets/runtime-atlas.json'

    def manifest(self):
        return json.loads(self.manifest_path.read_text())

    def write_manifest(self, manifest):
        self.manifest_path.write_text(json.dumps(manifest, sort_keys=True) + '\n')

    def test_all_294_original_crops_are_exact_rgba_with_complete_sources(self):
        result = verify(self.root)
        self.assertEqual(result['imagesVerified'], 294)
        manifest = self.manifest()
        expected = sources(self.root)
        self.assertEqual(set(manifest['assets']), set(expected))
        self.assertEqual(set(manifest['inputs']), set(MANIFESTS))
        width, height, pixels = decoded_rgba(self.web / 'ui-assets/runtime-atlas.png')
        self.assertEqual((width, height), (manifest['width'], manifest['height']))
        self.assertLessEqual(max(width, height), 2048)
        for key, source in expected.items():
            with self.subTest(source=source):
                entry = manifest['assets'][key]
                sw, sh, original = decoded_rgba(self.web / source)
                x, y, w, h = entry['rect']
                crop = bytearray()
                for row in range(y, y+h):
                    crop.extend(pixels[(row*width+x)*4:(row*width+x+w)*4])
                self.assertEqual((w, h), (sw, sh))
                self.assertEqual(bytes(crop), original)
                self.assertEqual(entry['source'], source)
                self.assertEqual(entry['sha256'], sha((self.web/source).read_bytes()))
                self.assertEqual(entry['rgbaSha256'], sha(original))

    def test_build_is_deterministic_and_leaves_every_original_png_unchanged(self):
        originals = {source: (self.web/source).read_bytes() for source in sources(self.root).values()}
        first = build(self.root)
        before = [self.manifest_path.read_bytes(), (self.web/'ui-assets/runtime-atlas.png').read_bytes()]
        self.assertEqual(build(self.root), first)
        self.assertEqual([self.manifest_path.read_bytes(), (self.web/'ui-assets/runtime-atlas.png').read_bytes()], before)
        self.assertEqual({source: (self.web/source).read_bytes() for source in originals}, originals)

    def test_stale_input_catalogue_and_changed_original_source_are_rejected(self):
        source = self.web / MANIFESTS[0]
        original = source.read_bytes()
        source.write_bytes(original + b' ')
        with self.assertRaisesRegex(ValueError, 'metadata changed'):
            verify(self.root)
        source.write_bytes(original)
        path = self.web / next(iter(sources(self.root).values()))
        w, h, pixels = decoded_rgba(path)
        changed = bytearray(pixels)
        changed[0] ^= 1
        png(path, w, h, changed, 4)
        with self.assertRaisesRegex(ValueError, 'source changed'):
            verify(self.root)

    def test_missing_or_extra_catalogue_entries_and_source_path_tampering_fail(self):
        original = self.manifest()
        key = next(iter(original['assets']))
        for mutate in [lambda m: m['assets'].pop(key), lambda m: m['assets'].update({'extra': copy.deepcopy(m['assets'][key])}), lambda m: m['assets'][key].update(source='other.png')]:
            manifest = copy.deepcopy(original)
            mutate(manifest)
            self.write_manifest(manifest)
            with self.assertRaises(ValueError):
                verify(self.root)

    def test_wrong_atlas_path_dimensions_and_crop_bounds_fail(self):
        original = self.manifest()
        key = next(iter(original['assets']))
        for mutate in [lambda m: m.update(path='other.png'), lambda m: m.update(width=m['width']-1), lambda m: m['assets'][key].update(rect=[-1, 0, 1, 1]), lambda m: m['assets'][key].update(rect=[m['width'], 0, 1, 1])]:
            manifest = copy.deepcopy(original)
            mutate(manifest)
            self.write_manifest(manifest)
            with self.assertRaises(ValueError):
                verify(self.root)

    def test_crop_geometry_is_exact_integer_data_matching_the_browser_guard(self):
        original = self.manifest()
        key = next(key for key, entry in original['assets'].items() if entry['rect'][2] == 1)
        for mutate in [lambda r: r.__setitem__(2, True), lambda r: r.__setitem__(0, float(r[0])), lambda r: r.__setitem__(0, '0'), lambda r: r.append(1), lambda r: r.pop()]:
            manifest = copy.deepcopy(original)
            mutate(manifest['assets'][key]['rect'])
            self.write_manifest(manifest)
            with self.subTest(rect=manifest['assets'][key]['rect']), self.assertRaises(ValueError):
                verify(self.root)

    def test_changed_atlas_pixels_fail_even_if_outer_png_hashes_are_recomputed(self):
        manifest = self.manifest()
        path = self.web / 'ui-assets/runtime-atlas.png'
        width, height, pixels = decoded_rgba(path)
        entry = max(manifest['assets'].values(), key=lambda e: e['rect'][2]*e['rect'][3])
        x, y, w, h = entry['rect']
        changed = bytearray(pixels)
        changed[((y+h//2)*width+x+w//2)*4] ^= 1
        png(path, width, height, changed, 4)
        manifest['sha256'] = sha(path.read_bytes())
        manifest['rgbaSha256'] = sha(changed)
        self.write_manifest(manifest)
        with self.assertRaisesRegex(ValueError, 'original pixels differ'):
            verify(self.root)


if __name__ == '__main__':
    unittest.main()
