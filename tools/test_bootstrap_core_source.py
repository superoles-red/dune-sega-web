#!/usr/bin/env python3
"""Exercise public source verification and no-overwrite bootstrapping."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import bootstrap_core_source as bootstrap


class BootstrapCoreSourceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        source = self.root / 'vendor/rearrakis'
        data = {'build/dune-base.c': b'baseline\n', 'genesis_recompiler/audio.h': b'header\n'}
        records = {}
        for name, content in data.items():
            path = source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            records[name] = {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
        digest = records['build/dune-base.c']['sha256']
        (source / 'source-manifest.json').write_text(json.dumps({
            'generatedSourceSha256': digest, 'files': records}))
        (self.root / 'docs').mkdir()
        (self.root / 'docs/source-identity.json').write_text(json.dumps({'generatedSourceSha256': digest}))
        self.patch = patch.object(bootstrap, 'ROOT', self.root)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def test_check_is_read_only_then_bootstrap_is_idempotent(self):
        self.assertEqual(bootstrap.prepare(True)['files'], 2)
        self.assertFalse((self.root / '.local').exists())
        bootstrap.prepare()
        self.assertEqual((self.root / '.local/source/build/dune-base.c').read_bytes(), b'baseline\n')
        self.assertEqual(bootstrap.prepare()['files'], 2)

    def test_tampered_public_input_fails_before_creating_local_files(self):
        (self.root / 'vendor/rearrakis/genesis_recompiler/audio.h').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'Pinned native source changed'):
            bootstrap.prepare()
        self.assertFalse((self.root / '.local').exists())

    def test_existing_local_changes_are_preserved_without_partial_copy(self):
        local = self.root / '.local/source/genesis_recompiler/audio.h'
        local.parent.mkdir(parents=True)
        local.write_bytes(b'user change')
        with self.assertRaisesRegex(ValueError, 'Local native input differs'):
            bootstrap.prepare()
        self.assertEqual(local.read_bytes(), b'user change')
        self.assertFalse((self.root / '.local/source/build/dune-base.c').exists())

    def test_unsafe_manifest_path_is_rejected(self):
        path = self.root / 'vendor/rearrakis/source-manifest.json'
        manifest = json.loads(path.read_text())
        manifest['files']['../outside.c'] = {'bytes': 0, 'sha256': ''}
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Unsafe source path'):
            bootstrap.prepare()
        self.assertFalse((self.root / '.local').exists())


if __name__ == '__main__':
    unittest.main()
