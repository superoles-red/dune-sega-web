#!/usr/bin/env python3
"""Verify public pinned native sources and prepare the existing local build layout."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def prepare(check_only=False):
    source = ROOT / 'vendor/rearrakis'
    manifest = json.loads((source / 'source-manifest.json').read_text())
    identity = json.loads((ROOT / 'docs/source-identity.json').read_text())
    if manifest['generatedSourceSha256'] != identity['generatedSourceSha256']:
        raise ValueError('Native source manifest does not match the recorded game identity')
    checked = []
    for name, record in manifest['files'].items():
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe source path: ' + name)
        path = source / relative
        if path.is_symlink() or not path.is_file():
            raise ValueError('Missing or linked source: ' + name)
        data = path.read_bytes()
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError('Pinned native source changed: ' + name)
        checked.append((relative, path, record))
    baseline = manifest['files']['build/dune-base.c']
    if baseline['sha256'] != identity['generatedSourceSha256']:
        raise ValueError('The generated baseline does not match its recorded hash')
    if not check_only:
        target = ROOT / '.local/source'
        # Check every existing input before creating any files. Local changes
        # are never overwritten by a bootstrap operation.
        for relative, _, record in checked:
            path = target / relative
            if path.exists() and (path.is_symlink() or not path.is_file() or
                    hashlib.sha256(path.read_bytes()).hexdigest() != record['sha256']):
                raise ValueError('Local native input differs; preserve it before bootstrapping: ' + str(path))
        for relative, path, _ in checked:
            out = target / relative
            if not out.exists():
                out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, out)
    return {'files': len(checked), 'bytes': sum(r['bytes'] for _, _, r in checked),
            'generatedSourceSha256': baseline['sha256'], 'checkOnly': check_only}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify only; do not populate .local/source')
    args = parser.parse_args()
    print(json.dumps(prepare(args.check), sort_keys=True))
