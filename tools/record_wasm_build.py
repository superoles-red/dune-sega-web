#!/usr/bin/env python3
"""Record the actual local engine and adapter identities after a successful build."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


wasm = ROOT / 'web/engine/dune_web.wasm'
js = ROOT / 'web/engine/dune_web.js'
# Exercise actual minified EM_JS ABI before recording a successful build. A
# malformed pointer parameter can compile C yet fail only at the first audio
# callback, so source/syntax checks alone are insufficient.
audio_check = subprocess.run(
    ['node', str(ROOT / 'tools/verify_audio_loader.mjs'), str(js)],
    capture_output=True, text=True,
)
if audio_check.returncode:
    raise SystemExit(audio_check.stderr or 'Generated native audio bridge failed')
audio_loader_proof = json.loads(audio_check.stdout)
exports = sorted(set(re.findall(r'\b_dune_[a-zA-Z0-9_]+', js.read_text())))
data = {
    'date': datetime.now(timezone.utc).date().isoformat(),
    'sdk': 'Emscripten 3.1.74',
    'wasmBytes': wasm.stat().st_size,
    'sha256': sha(wasm),
    'loaderSha256': sha(js),
    'noGroupExports': not any('group' in name for name in exports),
    'audioLoaderBridgeProof': audio_loader_proof,
    'webExports': [name[1:] for name in exports if name.startswith('_dune_web_')],
    'saveExports': [name[1:] for name in exports if not name.startswith('_dune_web_')],
    'adapterSha256': {
        path.name: sha(path)
        for path in sorted((ROOT / 'tools').glob('em_web_*.h'))
    },
}
(ROOT / 'docs/wasm-build.json').write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps({key: data[key] for key in ('wasmBytes', 'sha256', 'noGroupExports')}))
