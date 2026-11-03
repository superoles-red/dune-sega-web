#!/usr/bin/env python3
"""Append the separately verified original Starport chrome to screen assets."""
from pathlib import Path
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1]
def main():
 src=ROOT/'data/starport-ui';dst=ROOT/'data/screen-assets';m=json.loads((src/'manifest.json').read_text());target=json.loads((dst/'manifest.json').read_text())
 for key,part in m['parts'].items():
  assert key.startswith('starport-');p=src/part['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==part['sha256']
  out=dst/part['path'];out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,out);target['parts'][key]=part
 for key,module in m['modules'].items():assert key.startswith('starport-');target['modules'][key]=module
 target['starportNativeChrome']={'manifestSource':'data/starport-ui/manifest.json','manifestSha256':hashlib.sha256((src/'manifest.json').read_bytes()).hexdigest(),'source':m['source'],'policy':m['policy']}
 target['pngCount']=len(list(dst.rglob('*.png')));target['pngBytes']=sum(p.stat().st_size for p in dst.rglob('*.png'));(dst/'manifest.json').write_text(json.dumps(target,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'starportParts':len(m['parts']),'modules':len(m['modules'])}))
if __name__=='__main__':main()
