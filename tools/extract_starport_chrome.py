#!/usr/bin/env python3
"""Original Starport chrome from a genuine completed native 320x224 frame."""
from pathlib import Path
import argparse,hashlib,json,sys
from extract_building_assets import png
ROOT=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('rgb',type=Path);ap.add_argument('--output',type=Path,default=ROOT/'data/starport-ui');args=ap.parse_args();raw=args.rgb.read_bytes();assert len(raw)==320*224*3
 out=args.output;parts={};modules={}
 def crop(name,rect,*,alpha=False,clear=None):
  x,y,w,h=rect;p=bytearray()
  for yy in range(h):
   for xx in range(w):
    at=((y+yy)*320+x+xx)*3;rgb=raw[at:at+3];opacity=0 if clear and clear(x+xx,y+yy) else 255;p.extend(rgb+(bytes([opacity]) if alpha else b''))
  path='starport/'+name+'.png';png(out/path,w,h,p,4 if alpha else 3);parts[name]={'path':path,'width':w,'height':h,'sourceRect':rect,'transparent':alpha,'sha256':sha((out/path).read_bytes()),'role':'original-Starport-native-chrome'}
  return name
 crop('starport-body-fill',[136,88,8,8]);crop('starport-monitor-stack',[152,32,112,84]);crop('starport-resource-vent',[272,152,40,64]);
 for name,y in [('resource-dollar',116),('resource-power',148),('resource-armor',180)]:crop('starport-'+name,[156,y,24,24])
 # Native cabin frame only. Original command/icon pixels are a separate layer.
 # Complete native outer shell, not the previously cropped inner bevel. The
 # native viewport is [32,48,96,96], hence its asymmetric20/12/16/20 margins.
 # Eight-pixel repeat profiles preserve the original dither phase. A one-pixel
 # sample falsely turns that grain into a solid stripe at the corner joins.
 x,y,w,h=12,36,132,128;l,t,r,b=20,12,16,20;pieces={}
 boxes={'tl':[x,y,l,t],'tr':[x+w-r,y,r,t],'bl':[x,y+h-b,l,b],'br':[x+w-r,y+h-b,r,b],'top':[40,y,8,t],'bottom':[40,y+h-b,8,b],'left':[x,y+t,l,96],'right':[x+w-r,y+t,r,96]}
 for key,r in boxes.items():pieces[key]=crop('starport-command-cabinet-'+key,r,alpha=True,clear=lambda xx,yy:32<=xx<128 and 48<=yy<144)
 mids={key:crop('starport-command-cabinet-'+key+'-middle',[xx,104,ww,8])for key,xx,ww in [('left',12,20),('right',128,16)]}
 modules['starport-command-cabinet']={'kind':'native-banded-nine-slice','nativeRect':[x,y,w,h],'insets':[20,12,16,20],'frameOnly':True,'pieces':pieces,'viewportInsets':[20,12,16,20],'repeatPeriod':8,'profileAxes':{'top':'x','bottom':'x','left':'y','right':'y'},'sideBands':{'top':56,'bottom':32,'middleParts':mids,'rule':'Keep original side connectors and shaded lower transition once. Extend only the8pixel quiet dither band at native y104.'}}
 crop('starport-cabinet-brace',[56,148,48,16])
 # Closed native apertures. Their interior black is copied from the actual
 # native blank aperture; no generic-purple Yard material or colour conversion.
 for name,r,cap in [('cash-window-clean',[230,14,69,12],8),('meter-window',[188,124,72,16],8)]:
  x,y,w,h=r;keys={}
  for key,rr in [('left',[x,y,cap,h]),('middle',[x+cap,y,1,h]),('right',[x+w-cap,y,cap,h])]:
   ident='starport-'+name+'-'+key;crop(ident,rr);keys[key]=ident
   if name=='cash-window-clean':
    # Six native rolling glyphs share the black middle of this static part.
    # Reuse the existing native black aperture pixel for the glyph area only.
    xx,yy,ww,hh=rr;p=bytearray();black=raw[(16*320+240)*3:(16*320+240)*3+3];assert black==b'\0\0\0'
    for row in range(hh):
     for col in range(ww):
      at=((yy+row)*320+xx+col)*3;p.extend(black if 248<=xx+col<296 and 16<=yy+row<24 else raw[at:at+3])
    png(out/parts[ident]['path'],ww,hh,p,3);parts[ident]['sha256']=sha((out/parts[ident]['path']).read_bytes());parts[ident]['nativeBlankGlyphAperture']=True
  modules['starport-'+name]={'kind':'three-slice-repeat-x','nativeRect':r,'fixedHeight':h,'pieces':keys,'insets':[cap,0,cap,0]}
 manifest={'version':2,'source':{'nativeContext':3,'rgb':str(args.rgb),'rgbSha256':sha(raw),'rgbBytes':len(raw),'game':'Dune The Battle for Arrakis Sega USA'},'policy':'Exact original Starport RGB pixels. No recolouring or generic Yard substitutes. Only the rolling-cash glyph aperture is replaced with its own original black interior sample. Complete native outer corners stay1:1; straight8pixel grain profiles repeat only on their own axis.','parts':parts,'modules':modules,'bodyNativeRgbSample':list(raw[(88*320+136)*3:(88*320+136)*3+3]),'junctionProof':{'nativeViewport':[32,48,96,96],'nativeOuterCabinet':[12,36,132,128],'oldInnerCrop':[24,40,112,112],'monitorBottomExclusive':116,'nextNativeDollarTop':116,'monitorNeverIncludesDollarPixels':True,'nativeCabinetBrace':[56,148,48,16],'noArtificialGreenTint':'Native chrome is grayscale; native button/unit backgrounds intentionally include RGB145/145/182.'}}
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'parts':len(parts),'modules':len(modules),'bodySample':manifest['bodyNativeRgbSample'],'output':str(out)}))
if __name__=='__main__':main()
