#!/usr/bin/env python3
"""Export this project to an isolated repository directory; never runs Git/push."""
import argparse
import hashlib
import json
from pathlib import Path
import stat

ROOT = Path(__file__).resolve().parents[1]
MARKER = '.publication-export.json'
TOP_FILES = ('README.md', 'LICENSE-ReArrakis.md', 'THIRD_PARTY_NOTICES.md')
SOURCE_DIRS = ('tools', 'tests', 'docs', 'data', 'web', '.github')
RUNTIME_KITS = {'shop-layout-kit', 'screen-assets', 'campaign', 'unit-assets'}
GITIGNORE = '''.local/
_site/
__pycache__/
*.pyc
.DS_Store
web/qa-fixtures/
'''


def export(destination):
    destination = destination.resolve()
    if destination == ROOT or destination.is_relative_to(ROOT) or ROOT.is_relative_to(destination):
        raise ValueError('Export must be outside the shared project and its ancestors')
    files = {name: (ROOT / name).read_bytes() for name in TOP_FILES}
    for directory in SOURCE_DIRS:
        for path in sorted((ROOT / directory).rglob('*')):
            if not path.is_file():
                continue
            rel = path.relative_to(ROOT)
            if path.is_symlink():
                raise ValueError('Refusing source symlink: ' + str(rel))
            if any(x in rel.parts for x in ('__pycache__', '.git', '.local', 'qa-fixtures')) or path.name == '.DS_Store':
                continue
            canonical_kit = (len(rel.parts) >= 2 and rel.parts[0] == 'data' and rel.parts[1] in RUNTIME_KITS) or (len(rel.parts) >= 3 and rel.parts[:2] == ('web', 'ui-assets') and rel.parts[2] in RUNTIME_KITS)
            if path.suffix in ('.gen', '.rom', '.zip', '.pyc') or path.suffix in ('.log', '.jsonl') and not canonical_kit:
                continue
            if path.suffix == '.bin' and rel.as_posix() not in ('web/frontend.state.bin', 'web/demo-harkonnen.state.bin', 'web/demo.state.bin'):
                continue
            files[rel.as_posix()] = path.read_bytes()
    files['.gitignore'] = GITIGNORE.encode()
    if destination.exists() and any(destination.iterdir()) and not (destination / MARKER).is_file():
        raise ValueError('Refusing to overwrite an unmanaged directory: ' + str(destination))
    old = json.loads((destination / MARKER).read_text()).get('files', {}) if (destination / MARKER).exists() else {}
    # Only files listed in our preceding export are managed; an own .git survives.
    for name in old.keys() - files.keys():
        p = destination / name
        if p.is_file():
            p.unlink()
    destination.mkdir(parents=True, exist_ok=True)
    records = {}
    for name, data in sorted(files.items()):
        p = destination / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        mode = stat.S_IMODE((ROOT / name).stat().st_mode) if name != '.gitignore' else 0o644
        p.chmod(mode)
        records[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'mode': oct(mode)}
    manifest = {'version': 1, 'purpose': 'Isolated source export; no Git or remote mutation performed', 'files': records}
    (destination / MARKER).write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    return {'directory': str(destination), 'files': len(files), 'bytes': sum(len(b) for b in files.values())}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    print(json.dumps(export(parser.parse_args().destination)))
