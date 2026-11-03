#!/usr/bin/env python3
"""Verify native source pixels and render a component-only before/after proof.

The montage is an offline cabinet-parts preview, not a browser screenshot.
"""
from pathlib import Path
import argparse,collections,hashlib,json,struct,zlib
from extract_building_assets import png
ROOT=Path(__file__).resolve().parents[1]
def read_png(p):
 b=p.read_bytes();pos=8;encoded=b''
 while pos<len(b):
  n=int.from_bytes(b[pos:pos+4],'big');kind=b[pos+4:pos+8];v=b[pos+8:pos+8+n];pos+=12+n
  if kind==b'IHDR':w,h,depth,color,_,_,_=struct.unpack('>IIBBBBB',v);assert depth==8 and color in (2,6);ch=4 if color==6 else 3
  if kind==b'IDAT':encoded+=v
 scan=zlib.decompress(encoded);stride=w*ch;rows=[];prior=bytearray(stride);at=0
 for _ in range(h):
  mode=scan[at];row=bytearray(scan[at+1:at+1+stride]);at+=stride+1
  for i in range(stride):
   a=row[i-ch]if i>=ch else 0;b=prior[i];c=prior[i-ch]if i>=ch else 0
   if mode==1:row[i]=(row[i]+a)&255
   elif mode==2:row[i]=(row[i]+b)&255
   elif mode==3:row[i]=(row[i]+(a+b)//2)&255
   elif mode==4:
    estimate=a+b-c;d=[abs(estimate-a),abs(estimate-b),abs(estimate-c)];row[i]=(row[i]+[a,b,c][d.index(min(d))])&255
  rows.append(bytes(row));prior=row
 data=b''.join(rows)
 if ch==3:data=b''.join(data[i:i+3]+b'\xff'for i in range(0,len(data),3))
 return w,h,data
def blit(dst,W,H,img,x,y,w=None,h=None):
 sw,sh,src=img;w=sw if w is None else int(w);h=sh if h is None else int(h)
 for yy in range(h):
  if not 0<=y+yy<H:continue
  for xx in range(w):
   if not 0<=x+xx<W:continue
   at=(min(sh-1,yy*sh//h)*sw+min(sw-1,xx*sw//w))*4;to=((y+yy)*W+x+xx)*4
   if src[at+3]:dst[to:to+4]=src[at:at+4]
def repeat(dst,W,H,img,x,y,w,h):
 sw,sh,data=img
 for yy in range(h):
  for xx in range(w):
   at=((yy%sh)*sw+xx%sw)*4;to=((y+yy)*W+x+xx)*4
   if data[at+3]:dst[to:to+4]=data[at:at+4]
def shell(manifest,folder,W,H):
 d=bytearray(b'\0\0\0\xff'*(W*H));m=manifest['modules']['starport-command-cabinet'];l,t,r,b=m['insets'];p={k:read_png(folder/manifest['parts'][v]['path'])for k,v in m['pieces'].items()}
 for k,x,y in [('tl',0,0),('tr',W-r,0),('bl',0,H-b),('br',W-r,H-b)]:blit(d,W,H,p[k],x,y)
 for k,x,y,w,h in [('top',l,0,W-l-r,t),('bottom',l,H-b,W-l-r,b),('left',0,t,l,H-t-b),('right',W-r,t,r,H-t-b)]:repeat(d,W,H,p[k],x,y,w,h)
 if 'sideBands'in m:
  bands=m['sideBands'];hh=H-t-b
  for key,x,ww in [('left',0,l),('right',W-r,r)]:
   iw,ih,pixels=p[key];top=min(bands['top'],hh);bottom=min(bands['bottom'],hh-top);blit(d,W,H,(iw,top,pixels[:iw*top*4]),x,t);middle=read_png(folder/manifest['parts'][bands['middleParts'][key]]['path']);repeat(d,W,H,middle,x,t+top,ww,hh-top-bottom);blit(d,W,H,(iw,bottom,pixels[(ih-bottom)*iw*4:]),x,H-b-bottom)
 if 'starport-cabinet-brace'in manifest['parts']:blit(d,W,H,read_png(folder/manifest['parts']['starport-cabinet-brace']['path']),int((W-48)/2+2),H-16)
 return W,H,bytes(d)
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--before',type=Path,default=ROOT/'.local/starport-before-polish/starport-ui');ap.add_argument('--output',type=Path,default=ROOT/'.local/starport-polish');a=ap.parse_args();folder=ROOT/'data/starport-ui';m=json.loads((folder/'manifest.json').read_text());raw=(ROOT/m['source']['rgb']).read_bytes();assert hashlib.sha256(raw).hexdigest()==m['source']['rgbSha256'];checked=0
 for name,p in m['parts'].items():
  w,h,data=read_png(folder/p['path']);x,y,ww,hh=p['sourceRect'];assert(w,h)==(ww,hh)
  for yy in range(h):
   for xx in range(w):
    at=(yy*w+xx)*4;expect=raw[((y+yy)*320+x+xx)*3:((y+yy)*320+x+xx)*3+3]
    if p.get('nativeBlankGlyphAperture')and 248<=x+xx<296 and 16<=y+yy<24:expect=b'\0\0\0'
    assert data[at:at+3]==expect,(name,xx,yy)
  checked+=w*h
 a.output.mkdir(parents=True,exist_ok=True);before=json.loads((a.before/'manifest.json').read_text());pictures=[shell(before,a.before,216,248),shell(m,folder,216,248)];montage=bytearray(b'\0\0\0\xff'*(432*248))
 for i,p in enumerate(pictures):blit(montage,432,248,p,216*i,0)
 enlarged=bytearray()
 for y in range(248):
  row=b''.join(montage[(y*432+x)*4:(y*432+x+1)*4]*2 for x in range(432));enlarged.extend(row*2)
 png(a.output/'cabinet-before-after-2x.png',864,496,enlarged,4);png(a.output/'native-starport.png',320,224,raw,3)
 report={'pass':True,'sourceRgbSha256':m['source']['rgbSha256'],'originalPixelsVerified':checked,'parts':len(m['parts']),'nativeCorners':m['modules']['starport-command-cabinet']['nativeRect'],'insets':m['modules']['starport-command-cabinet']['insets'],'profiles':'8pixel native dither; top/bottom repeatX, left/right repeatY','monitorDollarBoundary':m['junctionProof'],'preview':'Offline component proof only; browser/physical-device rendering is a separate check.'};(a.output/'source-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
