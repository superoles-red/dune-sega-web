#!/usr/bin/env python3
"""Export original Sega cursor5 without editing the runtime or ordinary cursor."""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,sys
from extract_shop_ui import ROOT,png
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source',type=Path,default=ROOT.parent/'dune-web/data/evidence/mission-atreides-01.cpu.bin');a=ap.parse_args()
 identity=json.loads((ROOT/'docs/source-identity.json').read_text());assert sha(ROOT/'.local/source/build/dune-base.c')==identity['generatedSourceSha256']
 source_hash=sha(a.source);evidence=ROOT/'.local/target-feedback';evidence.mkdir(parents=True,exist_ok=True);native=ROOT/'tools/extract_target_feedback_native.c';exe=ROOT/'.local/extract-target-feedback'
 subprocess.run(['clang','-std=c11','-O1',str(native),'-o',str(exe),'-lm'],check=True)
 subprocess.run([str(exe),str(a.source),str(evidence)],check=True);assert sha(a.source)==source_hash
 proof=json.loads((evidence/'source-proof.json').read_text());raw=(evidence/'attack-reticle.rgba').read_bytes();w,h=proof['width'],proof['height'];assert len(raw)==w*h*4 and sum(raw[i]==255 for i in range(3,len(raw),4))==proof['visiblePixels']
 out=ROOT/'data/target-feedback';web=ROOT/'web/input-feedback';out.mkdir(parents=True,exist_ok=True);web.mkdir(parents=True,exist_ok=True);file=out/'attack-reticle.png';png(file,w,h,raw,4)
 m={'version':1,'id':'native-map-target-cursor-5','path':'attack-reticle.png','width':w,'height':h,'channels':4,'sha256':sha(file),'rgbaSha256':hashlib.sha256(raw).hexdigest(),'displayAnchor':{'x':w/2,'y':h/2},'nativeAnchorInCrop':{'x':160-proof['sourceBbox'][0],'y':112-proof['sourceBbox'][1]},'alpha':'Original VDP sprite nibble0 transparent; nonzero black remains opaque. No RGB key or recolour.','source':{'identity':identity,'cpuSha256':source_hash,'nativeExtractor':'tools/extract_target_feedback_native.c','nativeExtractorSha256':sha(native),'proof':proof},'meaning':'Original cursor5, selected by original armed-Palace and selected-unit A handlers. Host action classification must still come from the original committed order; this PNG never creates or changes an order.'}
 (out/'attack-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');shutil.copyfile(evidence/'source-proof.json',out/'source-proof.json');shutil.copyfile(file,web/file.name);shutil.copyfile(out/'attack-manifest.json',web/'attack-manifest.json');print(json.dumps({'path':str(web/file.name),'width':w,'height':h,'bytes':file.stat().st_size}))
if __name__=='__main__':main()
