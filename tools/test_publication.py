#!/usr/bin/env python3
"""Publication integrity, exclusion, deployment MIME and project-subpath checks."""
import functools
import http.server
import json
from pathlib import Path
import stat
import tempfile
import threading
import unittest
import urllib.error

from build_publication import ROOT, build_site, collect, validate_payload
from verify_publication import verify
from export_publication_repository import export


class PublicationTests(unittest.TestCase):
    def test_private_fixtures_never_ship_but_current_demo_does(self):
        payload, _ = collect()
        self.assertIn('demo-harkonnen.state.bin', payload)
        self.assertIn('frontend.state.bin', payload)
        self.assertIn('native-audio-worklet.js', payload)
        for name in ('demo.state.bin', 'training.state.bin', 'tutorial-training.mjs', 'qa-modern.mjs', 'asset-library/index.html', 'base-prototype/index.html'):
            self.assertNotIn(name, payload)
        self.assertEqual(set(n for n in payload if n.startswith('language-assets/') and n.count('/') == 1 and n.endswith('.json')), {'language-assets/en.json', 'language-assets/ru.json', 'language-assets/manifest.json'})
        self.assertFalse(any('preview' in n for n in payload if n.startswith('language-assets/')))
        self.assertEqual(len([n for n in payload if n.startswith('tutorial-assets/')]), 2)
        for name in ('qa-fixtures/leak.bin', '.local/secret', 'extra.gen'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate_payload({**payload, name: b'not public'})

    def test_build_is_reproducible_and_detects_tampering(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = Path(tmp) / 'a'
            b = Path(tmp) / 'b'
            ra, rb = build_site(a), build_site(b)
            self.assertEqual(ra, rb)
            self.assertEqual(verify(str(a))['buildId'], ra['buildId'])
            (a / 'frontend.state.bin').write_bytes(b'corrupt')
            with self.assertRaises(ValueError):
                verify(str(a))

    def test_plain_static_subpath_works_without_isolation_headers(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp) / 'dune-sega-web'
            release = build_site(site)
            class Handler(http.server.SimpleHTTPRequestHandler):
                def log_message(self, *_):
                    pass
            server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=tmp))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                result = verify(f'http://127.0.0.1:{server.server_port}/dune-sega-web/')
                self.assertEqual(result['filesVerified'], len(release['files']))
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    def test_output_must_not_overwrite_source_or_unmanaged_files(self):
        for destination in (ROOT, ROOT / 'web', ROOT.parent):
            with self.subTest(path=str(destination)), self.assertRaises(ValueError):
                build_site(destination)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            (target / 'precious.txt').write_text('preserve')
            with self.assertRaises(ValueError):
                build_site(target)
            self.assertEqual((target / 'precious.txt').read_text(), 'preserve')

    def test_remote_hidden_control_404_is_explicit_but_missing_game_asset_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            release = build_site(Path(tmp) / 'dune-sega-web')
            class Handler(http.server.SimpleHTTPRequestHandler):
                denied = {'/dune-sega-web/.nojekyll'}
                def log_message(self, *_):
                    pass
                def do_GET(self):
                    if self.path in self.denied:
                        self.send_error(404)
                    else:
                        super().do_GET()
            server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=tmp))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_port}/dune-sega-web/'
            try:
                result = verify(base)
                self.assertEqual(result['filesVerified'], len(release['files']) - 1)
                self.assertEqual(result['unservedControls'], [{'path': '.nojekyll', 'httpStatus': 404, 'artifactHashVerified': False}])
                Handler.denied.add('/dune-sega-web/frontend.state.bin')
                with self.assertRaises(urllib.error.HTTPError) as failed:
                    verify(base)
                self.assertEqual(failed.exception.code, 404)
                self.assertTrue(failed.exception.url.endswith('/frontend.state.bin'))
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    def test_source_export_preserves_executable_script_and_own_git_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'source'
            export(target)
            original = ROOT / 'tools/build.sh'
            exported = target / 'tools/build.sh'
            self.assertTrue(stat.S_IMODE(original.stat().st_mode) & 0o111)
            self.assertEqual(stat.S_IMODE(exported.stat().st_mode), stat.S_IMODE(original.stat().st_mode))
            self.assertEqual(exported.read_bytes(), original.read_bytes())
            self.assertEqual((target / 'web/demo.state.bin').read_bytes(), (ROOT / 'web/demo.state.bin').read_bytes())
            self.assertFalse((target / 'web/training.state.bin').exists())
            # The public build from a clean source export must be byte-for-byte
            # identical, including canonical metadata files named by manifests.
            original_site, _ = collect(ROOT)
            exported_site, _ = collect(target)
            self.assertEqual(exported_site, original_site)
            # An update must preserve the isolated repository's own metadata.
            (target / '.git').mkdir()
            sentinel = target / '.git/config'
            sentinel.write_text('preserve own repository metadata\n')
            export(target)
            self.assertEqual(sentinel.read_text(), 'preserve own repository metadata\n')
            self.assertEqual(stat.S_IMODE(exported.stat().st_mode), stat.S_IMODE(original.stat().st_mode))


if __name__ == '__main__':
    unittest.main()
