#!/usr/bin/env python3
"""Review-only reconstruction from clean original Options tiles, never AI art.

Only baked glyph and measured1px black-shadow pixels may change. Uncovered
picture pixels and the full320×224 composition are byte-for-byte preserved.
Hidden artwork is unknown: these pixels are explicitly native-piece guesses.
"""
from pathlib import Path
import hashlib,json,math,shutil
from extract_shop_ui import ROOT,png
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 out=ROOT/'data/options-native-reconstruction';out.mkdir(parents=True,exist_ok=True);src=ROOT/'.local/screen-options-raw/pause-options';idx=bytes(n&15 for n in src.with_suffix('.window.indices').read_bytes());pal=src.with_suffix('.palette.rgb').read_bytes();fullindices=src.with_suffix('.window.indices').read_bytes();lane=(fullindices[0]&63)//16;colors=[tuple(pal[(lane*16+i)*3:(lane*16+i+1)*3])for i in range(16)];rgb=b''.join(bytes(colors[n])for n in idx)
 boxes=[[128,16,56,8],[32,40,64,8],[32,56,80,8],[32,72,64,8],[32,88,80,8],[32,104,80,8],[32,136,112,8],[72,192,168,8]];letters={at for at,n in enumerate(idx)if n in(8,13)};mask=set(letters)
 assert all(any(x<=at%320<x+w and y<=at//320<y+h for x,y,w,h in boxes)for at in letters)
 for at in letters:
  x,y=at%320,at//320
  for dx,dy in[(1,0),(0,1),(1,1)]:
   xx,yy=x+dx,y+dy
   if xx<320 and yy<224 and idx[yy*320+xx]==9:mask.add(yy*320+xx)
 for yy in range(16,24):
  for xx in range(128,184):
   if idx[yy*320+xx]==9:mask.add(yy*320+xx)
 affected=sorted({(at%320//8*8,at//320//8*8)for at in mask},key=lambda p:(p[1],p[0]));clean=[];unique=set()
 for y in range(0,224,8):
  for x in range(0,320,8):
   if any((y+yy)*320+x+xx in mask for yy in range(8)for xx in range(8)):continue
   tile=bytes(idx[(y+yy)*320+x+xx]for yy in range(8)for xx in range(8))
   if 8 in tile or 13 in tile:continue
   for flip in range(4):
    piece=bytes(tile[(7-yy if flip&2 else yy)*8+(7-xx if flip&1 else xx)]for yy in range(8)for xx in range(8))
    if piece in unique:continue
    unique.add(piece);clean.append((x,y,flip,piece))
 distances=[[sum((colors[a][q]-colors[b][q])**2 for q in range(3))/1000 for b in range(16)]for a in range(16)];current=bytearray(idx);recipes=[]
 # Context matching does not fabricate colors or tile pixels. Each concealed
 # pixel is copied from the recorded source tile (possibly H/V flipped).
 for x,y in affected:
  missing=[i for i in range(64)if(y+i//8)*320+x+i%8 in mask];known=[i for i in range(64)if i not in missing];target=[idx[(y+i//8)*320+x+i%8]for i in range(64)];weights=[3 if any(abs(i//8-j//8)+abs(i%8-j%8)==1 for j in missing)else 1 for i in known];best=None
  for sx,sy,flip,piece in clean:
   score=sum(distances[target[i]][piece[i]]*weight for i,weight in zip(known,weights));score+=math.hypot(sx-x,sy-y)*.025
   # The untouched perimeter connects copied hidden pixels to the surrounding
   # real silhouette, favouring local colors over unrelated complete objects.
   for i in missing:
    px,py=x+i%8,y+i//8
    for dx,dy in[(0,-1),(-1,0),(1,0),(0,1)]:
     xx,yy=px+dx,py+dy
     if 0<=xx<320 and 0<=yy<224 and yy*320+xx not in mask:score+=distances[idx[yy*320+xx]][piece[i]]*.2
   if best is None or score<best[0]:best=(score,sx,sy,flip,piece)
  score,sx,sy,flip,piece=best
  if y==16 and 128<=x<184:
   sx,sy,flip=272,8,0;piece=bytes(idx[(sy+yy)*320+sx+xx]for yy in range(8)for xx in range(8));assert set(piece)=={2};score=0
  for i in missing:current[(y+i//8)*320+x+i%8]=piece[i]
  recipes.append({'destinationTile':[x,y,8,8],'sourceTile':[sx,sy,8,8],'flipX':bool(flip&1),'flipY':bool(flip&2),'replacedLocalPixels':missing,'contextScore':round(score,4),'knownPixels':len(known)})
 result=b''.join(bytes(colors[n])for n in current);assert all(result[at*3:at*3+3]==rgb[at*3:at*3+3]for at in range(320*224)if at not in mask);assert set(tuple(result[i:i+3])for i in range(0,len(result),3))<=set(colors)
 png(out/'options-native-piece-reconstruction.png',320,224,result,3);png(out/'options-native-source.png',320,224,rgb,3);overlay=bytearray(320*224*4)
 for at in mask:overlay[at*4:at*4+4]=result[at*3:at*3+3]+b'\xff'
 png(out/'glyph-pixel-patches.png',320,224,overlay,4);review=bytearray(648*224*3)
 for yy in range(224):review[yy*1944:yy*1944+960]=rgb[yy*960:(yy+1)*960];review[yy*1944+984:yy*1944+1944]=result[yy*960:(yy+1)*960]
 png(out/'before-after-native.png',648,224,review,3)
 m={'version':1,'status':'Native-piece reconstruction; not recovered original hidden artwork','nativeSize':[320,224],'source':json.loads((ROOT/'docs/source-identity.json').read_text()),'sourceRgbSha256':sha(rgb),'resultRgbSha256':sha(result),'mask':'Original white WINDOW font nibble8 and cyan START nibbleD plus actual black-shadow nibble9 at right/down/diagonal1px offsets from those glyph pixels. The single additional OPTIONS-shadow pixel is included because this label has a proven uniform native-gold backdrop. Only this flat-sky label uses exact native flat-gold source[272,8,8,8]; no rectangular picture erasure.','whiteGlyphPixels':sum(n==8 for n in idx),'cyanStartPixels':sum(n==13 for n in idx),'glyphPixels':len(letters),'replacementPixels':len(mask),'preservedPixels':320*224-len(mask),'cleanCandidateTiles':len(clean),'recipes':recipes,'policy':'Every changed RGB pixel is copied from an explicitly recorded clean tile in this same original Options bitmap, with declared optional H/V flips. Geometry, dimensions, all uncovered pixels and palette are preserved. Candidate selection is a context heuristic, not a claim of authentic concealed pixels. No AI image, painting, interpolation or new color.'};(out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');
 # Explicit new main asset; keep source/mapping separate and honest.
 canonical=ROOT/'data/screen-assets';sm=json.loads((canonical/'manifest.json').read_text())
 for key,filename,ch,pixels in [('options-native-full-restored','options-native-piece-reconstruction.png',3,result),('options-native-pixel-patches','glyph-pixel-patches.png',4,overlay)]:
  rel='art/'+key+'.png';item={'path':rel,'width':320,'height':224,'channels':ch,'transparent':ch==4,'sha256':sha((out/filename).read_bytes()),'pixelSha256':sha(pixels),'sourceRect':[0,0,320,224],'sourceManifest':'data/options-native-reconstruction/manifest.json','scope':m['status'],'policy':m['policy']};sm['parts'][key]=item
  for folder in [canonical,ROOT/'web/ui-assets/screen-assets']:
   target=folder/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(out/filename,target)
 sm['optionsFullNativeComposition'].update({'background':'options-native-full-restored','reconstructionManifest':'data/options-native-reconstruction/manifest.json','reconstructionPolicy':m['policy'],'status':m['status']});sm['pngCount']=len(list(canonical.rglob('*.png')));sm['pngBytes']=sum(p.stat().st_size for p in canonical.rglob('*.png'))
 for path in [canonical/'manifest.json',ROOT/'web/ui-assets/screen-assets/manifest.json']:path.write_text(json.dumps(sm,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:m[k]for k in ['replacementPixels','preservedPixels','cleanCandidateTiles']}))
if __name__=='__main__':main()
