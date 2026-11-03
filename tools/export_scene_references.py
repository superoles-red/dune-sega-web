#!/usr/bin/env python3
"""Full native320x224 review frames, without changing shipping presentation."""
from pathlib import Path
import hashlib,json
from extract_shop_ui import ROOT,png
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
 output=ROOT/'data/scene-references';output.mkdir(parents=True,exist_ok=True)
 cases={
 'main':'.local/frontend-fixture/frontend',
 'pause':'.local/screen-options-raw/pause-options',
 'house-confirm':'.local/campaign-scenes/house-confirm',
 'briefing':'.local/campaign-scenes/campaign-briefing',
 'victory-movie':'.local/campaign-scenes/house1-mission01-victory-movie',
 'defeat-movie':'.local/campaign-scenes/house1-mission01-defeat-movie',
 'victory-debrief':'.local/campaign-scenes/house1-mission01-victory',
 'defeat-debrief':'.local/campaign-scenes/house1-mission01-defeat',
 'victory-results':'.local/campaign-scenes/house1-mission01-victory-results',
 'defeat-results':'.local/campaign-scenes/house1-mission01-defeat-results',
 'final-results':'.local/campaign-scenes/house1-mission09-victory-results',
 'ending':'.local/campaign-scenes/house1-ending',
 'credits':'.local/campaign-scenes/house1-credits',
 }
 manifest={'version':1,'purpose':'Complete actual native source references, not replacement animation loops','source':json.loads((ROOT/'docs/source-identity.json').read_text()),'frames':{}}
 for key,stem in cases.items():
  raw=ROOT/(stem+'.rgb');rgb=raw.read_bytes();assert len(rgb)==320*224*3
  file=output/(key+'.png');png(file,320,224,rgb,3)
  meta=ROOT/(stem+'.json');metadata=json.loads(meta.read_text())if meta.exists()else json.loads((raw.parent/'report.json').read_text())
  manifest['frames'][key]={'path':file.name,'width':320,'height':224,'sourceRaw':str(raw.relative_to(ROOT)),'sourceRgbSha256':digest(rgb),'pngSha256':digest(file.read_bytes()),'metadata':metadata,'recommendedCompleteLiveRect':[0,0,320,224],'scope':'A single actual complete original frame. Native live video remains authoritative; controlled outcome fixtures are not user-earned wins.'}
 (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'frames':len(cases),'output':str(output)}))
if __name__=='__main__':main()
