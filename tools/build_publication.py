#!/usr/bin/env python3
"""Build an audited, deterministic static site. This command never publishes it."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVED_ROOT = {'qa.mjs', 'qa-modern.mjs', 'tutorial-training.mjs', 'results-ui.mjs'}
RUNTIME_DIRS = ('engine', 'ui-assets', 'input-feedback', 'licenses')
ROOT_ASSETS = ('index.html', 'CREDITS.txt', 'frontend.state.bin', 'demo-harkonnen.state.bin')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()


def safe_relative(value):
    p = PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or '\\' in value:
        raise ValueError('Unsafe publication path: ' + value)
    return p


def collect(root=ROOT):
    """An allowlist prevents local CPU fixtures, ROM copies and QA pages leaking."""
    web = root / 'web'
    source = {}
    def add(path, name=None):
        if path.is_symlink() or not path.is_file():
            raise ValueError('Missing or symlink publication input: ' + str(path))
        name = name or path.relative_to(web).as_posix()
        safe_relative(name)
        source[name] = path
    for name in ROOT_ASSETS:
        add(web / name)
    # New ordinary host modules are included automatically; research entry points
    # and the archived interactive training implementation are deliberately absent.
    for p in sorted(web.iterdir()):
        if p.suffix in ('.js', '.mjs', '.css') and p.name not in ARCHIVED_ROOT:
            add(p)
    for folder in RUNTIME_DIRS:
        for p in sorted((web / folder).rglob('*')):
            if p.is_file() and p.name != '.DS_Store':
                add(p)
    # The production building layout imports this small pure geometry module;
    # the standalone prototype page and its duplicate asset library do not ship.
    add(web / 'base-prototype/layout.mjs')
    tutorial = web / 'tutorial-assets/manifest.json'
    add(tutorial)
    manifest = json.loads(tutorial.read_text())
    for asset in manifest['assets'].values():
        rel = safe_relative(asset['path'])
        add(tutorial.parent.joinpath(*rel.parts))
    # The runtime manifest contains only the two requested locales, bitmap
    # geometry and source hashes. Local paths/raw extraction stay in data/.
    for name in ('manifest.json', 'en.json', 'ru.json'):
        p = web / 'language-assets' / name
        if p.is_file():
            add(p)
    for folder in ('fonts', 'commands', 'tutorial'):
        for p in sorted((web / 'language-assets' / folder).rglob('*')):
            if p.is_file() and p.suffix in ('.png', '.woff2', '.json'):
                add(p)
    if (web / 'language-assets/manifest.json').is_file():
        add(web / 'language-assets/manifest.json')
    for p in sorted(web.glob('locale-*.json')):
        add(p)
    for name in ('THIRD_PARTY_NOTICES.md', 'LICENSE-ReArrakis.md'):
        add(root / name, 'licenses/' + name)
    build = json.loads((root / 'docs/wasm-build.json').read_text())
    for name, key in [('engine/dune_web.wasm', 'sha256'), ('engine/dune_web.js', 'loaderSha256')]:
        if sha(source[name].read_bytes()) != build[key]:
            raise ValueError('Engine differs from docs/wasm-build.json: ' + name)
    for name, expected in build.get('adapterSha256', {}).items():
        if sha((root / 'tools' / name).read_bytes()) != expected:
            raise ValueError('Native adapter changed since the recorded WASM build: ' + name)
    payload = {name: p.read_bytes() for name, p in source.items()}
    # Freeze consistent bytes even while an agent may still be preparing a new
    # candidate. A later final build remains mandatory before deployment.
    for name, p in source.items():
        if p.read_bytes() != payload[name]:
            raise ValueError('Publication input changed while reading: ' + name)
    payload['.nojekyll'] = b''
    payload['licenses/README.txt'] = (
        'Original game program, artwork and sound retain their original copyright.\n'
        'The MIT engine license does not license those game assets.\n'
        'See CREDITS.txt, ReArrakis-MIT.txt, LICENSE-ReArrakis.md,\n'
        'THIRD_PARTY_NOTICES.md, YMFM-BSD-3-Clause.txt and Emscripten-LICENSE.txt.\n'
    ).encode()
    validate_payload(payload)
    return payload, build


def validate_payload(payload):
    for name in payload:
        safe_relative(name)
        if any(x in PurePosixPath(name).parts for x in ('.git', '.local', 'qa-fixtures', 'asset-library')) or (name.startswith('base-prototype/') and name != 'base-prototype/layout.mjs'):
            raise ValueError('Private/research output in site: ' + name)
        if name.endswith(('.gen', '.rom', '.cpu.bin')):
            raise ValueError('Standalone ROM/CPU copy in site: ' + name)
    required = set(ROOT_ASSETS) | {'engine/dune_web.js', 'engine/dune_web.wasm',
        'licenses/YMFM-BSD-3-Clause.txt', 'licenses/Emscripten-LICENSE.txt'}
    if missing := required - payload.keys():
        raise ValueError('Missing publication files: ' + ', '.join(sorted(missing)))
    # Literal ES imports and HTML/CSS references must resolve under a project
    # subpath. Optional developer-only ?qa imports are excluded intentionally.
    refs = [r'''(?:from\s*|import\s*\()\s*['"](\./[^'"]+)['"]''',
            r'''fetch\(\s*['"](\./[^'"]+)['"]''',
            r'''(?:src|href)=["']([^"'#]+)["']''',
            r'''url\(\s*["']?(\./[^\s)'"?]+)''',
            r'''new URL\(\s*['"](\./[^'"]+)['"]''']
    for name, data in payload.items():
        if not name.endswith(('.js', '.mjs', '.css', '.html')) or name.startswith('engine/'):
            continue
        text = data.decode()
        if re.search(r'''(?:src|href)=["']/|fetch\(['"]/|new URL\(['"]/''', text):
            raise ValueError('Origin-absolute runtime asset URL: ' + name)
        for pattern in refs:
            for match in re.finditer(pattern, text):
                rel = match[1].split('?')[0]
                if rel.startswith(('https:', 'data:', '#')):
                    continue
                target = (PurePosixPath(name).parent / rel).as_posix()
                if target in ARCHIVED_ROOT or target == 'training.state.bin':
                    continue  # unreachable archived guide/optional local QA route
                if target not in payload and not (rel.endswith('/') and any(p.startswith(target.rstrip('/') + '/') for p in payload)):
                    raise ValueError(f'Unpackaged runtime reference in {name}: {rel}')
    loader = payload['engine/dune_web.js']
    if b'SharedArrayBuffer' in loader or b'PThread' in loader:
        raise ValueError('Threaded WASM requires a separate Pages header review')


def build_site(output, root=ROOT, revision=None):
    payload, build = collect(root)
    files = {name: {'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(payload.items())}
    identity = sha(encode(files))
    release = {'version': 1, 'buildId': identity, 'files': files,
               'engine': {'sha256': build['sha256'], 'loaderSha256': build['loaderSha256']},
               'qaIncluded': False, 'demo': 'demo-harkonnen.state.bin', 'languages': ['en', 'ru']}
    if revision:
        release['sourceRevision'] = revision
    output = output.resolve()
    # This tool may replace only an output it previously created, never web/ or
    # an arbitrary populated directory (particularly the shared source tree).
    if output == root.resolve() or root.resolve().is_relative_to(output) or output == (root / 'web').resolve():
        raise ValueError('Unsafe output directory: ' + str(output))
    if output.exists() and any(output.iterdir()) and not (output / 'release.json').is_file():
        raise ValueError('Refusing to replace an unmanaged output: ' + str(output))
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.dune-site-', dir=output.parent))
    try:
        for name, data in payload.items():
            dest = staging / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        (staging / 'release.json').write_bytes(encode(release))
        if output.exists():
            shutil.rmtree(output)
        staging.rename(output)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return release


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, default=ROOT / '.local/publication/site')
    p.add_argument('--revision')
    args = p.parse_args()
    release = build_site(args.output, revision=args.revision)
    print(json.dumps({'output': str(args.output.resolve()), 'buildId': release['buildId'],
                      'files': len(release['files']), 'bytes': sum(x['bytes'] for x in release['files'].values())}))


if __name__ == '__main__':
    main()
