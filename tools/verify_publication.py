#!/usr/bin/env python3
"""Verify a local directory or a deployed static site's bytes, MIME and subpath."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
import urllib.error


def verify(base):
    remote = base.startswith(('https://', 'http://'))
    if remote:
        base = base.rstrip('/') + '/'
    else:
        base = Path(base).resolve()
    def read(name):
        if remote:
            url = base + urllib.parse.quote(name, safe='/')
            with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=30) as r:
                return r.read(), r.headers.get_content_type()
        return (base / name).read_bytes(), None
    release = json.loads(read('release.json')[0])
    unserved_controls = []
    for name, entry in release['files'].items():
        try:
            data, mime = read(name)
        except urllib.error.HTTPError as error:
            # Pages deploys this empty control file but does not expose it as
            # HTTP content. Never extend this exception to gameplay assets.
            if remote and name == '.nojekyll' and error.code == 404 and entry == {'bytes': 0, 'sha256': hashlib.sha256(b'').hexdigest()}:
                unserved_controls.append({'path': name, 'httpStatus': 404, 'artifactHashVerified': False})
                continue
            raise
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Deployed bytes differ: ' + name)
        if mime and name.endswith('.wasm') and mime != 'application/wasm':
            raise ValueError('WASM MIME is ' + mime)
        if mime and name.endswith(('.js', '.mjs')) and mime not in ('application/javascript', 'text/javascript'):
            raise ValueError('JavaScript/AudioWorklet MIME is ' + mime + ': ' + name)
    identity = (json.dumps(release['files'], ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()
    if hashlib.sha256(identity).hexdigest() != release['buildId']:
        raise ValueError('Invalid release buildId')
    return {'base': str(base), 'buildId': release['buildId'], 'filesVerified': len(release['files']) - len(unserved_controls),
            'manifestFiles': len(release['files']), 'unservedControls': unserved_controls,
            'proof': 'HTTP bytes and MIME' if remote else 'local package bytes',
            'physicalIPhoneVerified': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base', help='Directory or complete HTTPS project URL, ending in /')
    print(json.dumps(verify(parser.parse_args().base)))
