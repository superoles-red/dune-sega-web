#!/usr/bin/env python3
"""Keep the entire Options composition; cover baked labels with native glass.

This is an honest original-piece UI composition, NOT recovery of hidden art.
No image rows are removed, no face crop, recolour, paint or new raster pattern.
"""
from pathlib import Path
import hashlib,json,shutil
from extract_shop_ui import ROOT,png
from extract_screen_assets import read_png,image_crop
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 out=ROOT/'data/options-native-full';out.mkdir(parents=True,exist_ok=True);src=ROOT/'.local/screen-options-raw/pause-options';indices=src.with_suffix('.window.indices').read_bytes();palette=src.with_suffix('.palette.rgb').read_bytes();rgb=b''.join(palette[(n&63)*3:(n&63)*3+3]for n in indices);assert len(rgb)==320*224*3
 early=ROOT/'.local/options-prelabels-proof/prelabels-window.indices';assert early.read_bytes()==indices,'Original pre-label loader already contains these exact baked words'
 kit=ROOT/'data/shop-layout-kit';km=json.loads((kit/'manifest.json').read_text());module=km['modules']['cash-window-clean'];parts={k:read_png(kit/km['parts'][v]['path'])for k,v in module['pieces'].items()}
 labels=[('OPTIONS',[128,16,56,8]),('MUSIC IS',[32,40,64,8]),('SOUNDS ARE',[32,56,80,8]),('RADAR IS',[32,72,64,8]),('MUSIC TEST',[32,88,80,8]),('SOUND TEST',[32,104,80,8]),('ENTER PASSWORD',[32,136,112,8]),('PRESS START TO EXIT',[72,192,168,8])]
 overlay=bytearray(320*224*4);after=bytearray(rgb);regions=[];changed=set()
 for text,(x,y,w,h)in labels:
  rect=[x-8,y-2,w+16,12];dx,dy,dw,dh=rect
  for yy in range(12):
   for xx in range(dw):
    key='left'if xx<8 else'right'if xx>=dw-8 else'middle';sw,sh,ch,p=parts[key];sx=xx if key=='left'else xx-(dw-8)if key=='right'else 0;pixel=p[(yy*sw+sx)*4:(yy*sw+sx+1)*4];at=(dy+yy)*320+dx+xx;overlay[at*4:at*4+4]=pixel
    if pixel[3]:after[at*3:at*3+3]=pixel[:3];changed.add(at)
  assert image_crop(after,320,[x,y,w,h])==bytes(w*h*3),'Every old letter and its baked shadow is inside opaque native black glass'
  regions.append({'label':text,'nativeLabelRect':[x,y,w,h],'panelRect':rect,'module':'cash-window-clean','contentRect':[x,y,w,h],'nativePieces':module['pieces'],'scope':'Only this old label is occluded; source art elsewhere is unchanged.'})
 assert all(after[i*3:i*3+3]==rgb[i*3:i*3+3]for i in range(320*224)if i not in changed)
 files={}
 for name,pixels,ch in [('options-native-full-source',rgb,3),('options-native-full-decor',after,3),('options-native-full-label-panels',overlay,4)]:
  rel=name+'.png';png(out/rel,320,224,pixels,ch);files[name]={'path':rel,'width':320,'height':224,'channels':ch,'transparent':ch==4,'sha256':sha((out/rel).read_bytes()),'pixelSha256':sha(pixels),'sourceRect':[0,0,320,224],'sourceLayer':'Original Options WINDOW','composition':'Original320×224 geometry unchanged; only declared old label regions use original native glass.'}
 # Review the exact before/after at native dimensions, separated by native black.
 preview=bytearray(648*224*3)
 for yy in range(224):preview[yy*648*3:yy*648*3+960]=rgb[yy*960:(yy+1)*960];preview[yy*648*3+984:yy*648*3+1944]=after[yy*960:(yy+1)*960]
 png(out/'before-after-native.png',648,224,preview,3)
 proof=json.loads((ROOT/'.local/options-prelabels-proof/proof.json').read_text());m={'version':1,'nativeSize':[320,224],'source':json.loads((ROOT/'docs/source-identity.json').read_text()),'sourceRgbSha256':sha(rgb),'sourceIndexSha256':sha(indices),'preDynamicLabelCheckpoint':proof,'parts':files,'labelPanels':regions,'policy':'Preserve the complete helmet, shoulder launcher, terrain and native320×224 geometry. No skipped rows, cropping, inpainting, recolour or generated patterns. Native glass covers unrecoverable baked words; it is not claimed hidden image reconstruction. Each glass panel repeats only the native1px horizontal strip between exact8px caps.','integration':'Use options-native-full-decor as the full opaque background, or options-native-full-source plus options-native-full-label-panels at the same transform. New MUSIC/SOUND controls may replace their corresponding panels. Keep the artwork and panels at one common transform.','localSearchScope':['Only the supplied USA ROM is present in the local Sega source directory.','Local source/resources and exported scene catalogue contain no separate clean PNG or master illustration.','All15 scene-descriptor VRAM captures were searched, including unused tile patterns and H/V flips;20228 unique nonwhite candidates.','With known letter and shadow positions excluded,22 damaged picture tiles still have no exact clean match among those inspected candidates. No unique hidden-art recovery is claimed.']};(out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
 # Small explicit additions; leave the root package builder to the parent.
 canonical=ROOT/'data/screen-assets';sm=json.loads((canonical/'manifest.json').read_text())
 for key,part in files.items():
  rel='art/'+part['path'];item={**part,'path':rel,'sourceManifest':'data/options-native-full/manifest.json'};sm['parts'][key]=item
  for folder in [canonical,ROOT/'web/ui-assets/screen-assets']:
   target=folder/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(out/part['path'],target)
 sm['optionsFullNativeComposition']={'manifest':'data/options-native-full/manifest.json','background':'options-native-full-decor','original':'options-native-full-source','panels':'options-native-full-label-panels','labelPanels':regions,'scope':m['policy']};sm['pngCount']=len(list(canonical.rglob('*.png')));sm['pngBytes']=sum(p.stat().st_size for p in canonical.rglob('*.png'))
 for path in [canonical/'manifest.json',ROOT/'web/ui-assets/screen-assets/manifest.json']:path.write_text(json.dumps(sm,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'nativeSize':[320,224],'panels':len(regions),'preservedOutsidePixels':320*224-len(changed),'pngBytes':sum((out/p['path']).stat().st_size for p in files.values()),'preview':str(out/'before-after-native.png')}))
if __name__=='__main__':main()
