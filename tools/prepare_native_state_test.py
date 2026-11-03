#!/usr/bin/env python3
"""Copy the current browser v2 save/load API verbatim for the native hot-load test."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'.local/source/build/dune-web.c').read_text()
a=s.index('#define DUNE_SAVESTATE_MAGIC')
b=s.index('EMSCRIPTEN_KEEPALIVE int dune_load_state_from_buffer(',a)
end=s.index('\n}',b)+2
out=root/'.local/campaign-analysis/native-state-api.inc'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(s[a:end]+'\n')
(out.with_suffix('.json')).write_text(json.dumps({'source':'.local/source/build/dune-web.c','sourceSha256':hashlib.sha256(s.encode()).hexdigest(),'copiedApiSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'scope':'Unchanged current portable v2 save/load API; only SDL host presentation calls are stubbed by native test'},indent=2)+'\n')
print('Copied exact current browser state API to',out)
