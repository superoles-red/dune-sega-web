#!/usr/bin/env python3
"""Export the exact native ordinary BF18 map cursor as a transparent PNG.

No runtime cursor/selection/order state is edited. A native offline CPU copy
builds only its existing cursor sprite; all color/alpha bytes come from it.
"""
import argparse,hashlib,json,subprocess,tempfile
from pathlib import Path
from extract_building_assets import png
ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def atomic(path,data):
    path.parent.mkdir(parents=True,exist_ok=True);temporary=path.with_name(path.name+'.tmp');temporary.write_bytes(data);temporary.replace(path)
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--snapshot',type=Path,required=True)
    ap.add_argument('--native-helper',type=Path,default=ROOT/'.local/extract-input-feedback-native')
    ap.add_argument('--output',type=Path,default=ROOT/'data/input-feedback')
    ap.add_argument('--web-output',type=Path,default=ROOT/'web/input-feedback')
    a=ap.parse_args();identity=json.loads((ROOT/'docs/source-identity.json').read_text());base=ROOT/'.local/source/build/dune-base.c'
    assert sha(base.read_bytes())==identity['generatedSourceSha256']
    snapshot_sha=sha(a.snapshot.read_bytes());a.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='dune-original-cursor-')as directory:
        run=subprocess.run([str(a.native_helper.resolve()),str(a.snapshot.resolve()),directory],capture_output=True,text=True,check=True)
        proof=json.loads((Path(directory)/'reticle-source.json').read_text());raw=(Path(directory)/'order-reticle.rgba').read_bytes()
    width,height=proof['width'],proof['height'];assert len(raw)==width*height*4 and proof['sourceCpuByteIdentical']
    assert sha(a.snapshot.read_bytes())==snapshot_sha
    path=a.output/'order-reticle.png';png(path,width,height,raw,4);png_bytes=path.read_bytes()
    visible=sum(raw[i+3]!=0 for i in range(0,len(raw),4));assert visible==proof['visiblePixels']
    manifest={'version':1,'game':'Dune — The Battle for Arrakis, Sega Genesis USA','id':'ordinary-map-cursor-BF18','path':'order-reticle.png','width':width,'height':height,'channels':4,'pngBytes':len(png_bytes),'sha256':sha(png_bytes),'rgbaSha256':sha(raw),'alpha':'Original sprite nibble0 remains transparent; nonzero black palette pixels remain opaque. No RGB color-key.','colors':'Original active CRAM converted by the same native vdp_channel(normal intensity); no recolor.','displayAnchor':{'x':width/2,'y':height/2},'nativeAnchorInCrop':{'x':proof['nativePosition'][0]-proof['sourceBbox'][0],'y':proof['nativePosition'][1]-proof['sourceBbox'][1]},'animation':'One genuine static ordinary cursor image. The host may display two short confirmation pulses; that overlay must not write native BF18/BF60, selection or game instructions.','source':{'romSha256':identity['romSha256'],'originalGeneratedSourceSha256':identity['generatedSourceSha256'],'snapshotSha256':snapshot_sha,'nativeHelper':'tools/extract_input_feedback_native.c','nativeHelperSha256':sha((ROOT/'tools/extract_input_feedback_native.c').read_bytes()),'exporterSha256':sha(Path(__file__).read_bytes()),'native':proof},'validation':{'sourceCpuWholeStructByteIdentical':True,'sourceSnapshotFileUnchanged':True,'independentBF60Untouched':True,'visiblePixels':visible}}
    encoded=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode();atomic(a.output/'manifest.json',encoded);atomic(a.output/'source-proof.json',(json.dumps(proof,indent=2)+'\n').encode());atomic(a.web_output/'order-reticle.png',png_bytes);atomic(a.web_output/'manifest.json',encoded)
    (a.output/'README.md').write_text('''# Original map cursor feedback image

`order-reticle.png` is the genuine ordinary map cursor held by native BF18.
It is extracted from an original first-mission CPU snapshot on an offline copy:
only that cursor node enters original sprite builder$1088, its SAT output is
rendered by the original VDP sprite/palette code, then cropped to its real bbox.
The original cursor table$60E8C supplies the paired raw pattern bank and mapping.
Its exact256-byte pattern upload to VRAM$F780 is recreated only on the offline
copy, since an early map snapshot may have an empty/pending cursor DMA bank.
Transparent pixels follow native nibble0; retained RGB is not repainted.
The original CPU is checked byte-for-byte, the snapshot file hash is unchanged,
and the independent native BF60 world marker is never edited.

Reproduce from the project root:

```sh
clang -std=c11 -O1 -Wformat tools/extract_input_feedback_native.c -o .local/extract-input-feedback-native -lm
python3 tools/extract_input_feedback.py --snapshot '/path/to/mission-atreides-01.cpu.bin'
```

The PNG and provenance manifest are copied to `web/input-feedback/`. The native
image supplies no gameplay behavior: a host-only double flash is separate from
selection, native order logic, BF18 and BF60. `displayAnchor` centers the feedback
image on a displayed click; `nativeAnchorInCrop` records its original mapping
anchor for reference. No runtime code or original assets are changed.
''')
    print(run.stdout,end='');print(json.dumps({'pass':True,'width':width,'height':height,'pngBytes':len(png_bytes),'visiblePixels':visible,'webPath':str(a.web_output/'order-reticle.png')},ensure_ascii=False))
if __name__=='__main__':main()
