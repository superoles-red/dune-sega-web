#!/usr/bin/env python3
"""Recompose a finite set of fan-guide words with exact recovered source glyphs."""
from pathlib import Path
import json,hashlib,collections
from extract_building_assets import png
ROOT=Path(__file__).resolve().parents[1]
WHITE=b'\xff\xff\xff';SHADE=bytes([145,145,182]);GREEN=b'\x00\xb6\x00';FILL=b'\x00\x24\x00'

def sha(b):return hashlib.sha256(b).hexdigest()
def pixel(b,x,y):return b[(y*320+x)*3:(y*320+x+1)*3]
def plates(b):
 pts={i for i in range(320*224)if b[i*3:i*3+3]==GREEN};boxes=[]
 while pts:
  p=pts.pop();q=[p]
  for n in q:
   x,y=n%320,n//320
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     xx,yy=x+dx,y+dy;t=yy*320+xx
     if 0<=xx<320 and 0<=yy<224 and t in pts:pts.remove(t);q.append(t)
  x0,y0,x1,y1=min(t%320 for t in q),min(t//320 for t in q),max(t%320 for t in q)+1,max(t//320 for t in q)+1
  if x1-x0>=30 and y1-y0>=18:boxes.append((x0,y0,x1,y1))
 boxes=[r for r in boxes if not any(s!=r and s[0]<=r[0]and s[1]<=r[1]and s[2]>=r[2]and s[3]>=r[3]for s in boxes)]
 assert len(boxes)==2,(boxes,)
 return sorted(boxes,key=lambda p:p[1])
def rows(b,rect):
 x0,y0,x1,y1=rect;ys=[]
 for y in range(y0+2,y1-2):
  if sum(pixel(b,x,y)==WHITE for x in range(x0+2,x1-2))>=4:ys.append(y)
 groups=[]
 for y in ys:
  if not groups or y>groups[-1][-1]+1:groups.append([y])
  else:groups[-1].append(y)
 assert all(5<=len(g)<=8 for g in groups),(rect,groups)
 return [g[0]-1 for g in groups]
def mask(b,x,y):return bytes(1 if pixel(b,x+xx,y+yy)==WHITE else 2 if pixel(b,x+xx,y+yy)==SHADE else 0 for yy in range(8)for xx in range(8))
def recover(images,notes):
 dictionary={' ':bytes(64)};proof={};lines=[]
 # Seed the literal five-glyph ПЕСОК header, whose cells are on the native8px grid.
 for i,ch in enumerate('ПЕСОК'):
  dictionary[ch]=mask(images[0],128+i*8,80);proof[ch]={'card':0,'x':128+i*8,'y':80,'source':'native ПЕСОК title'}
 for i,(b,card)in enumerate(zip(images,notes['cards'])):
  ps=plates(b)
  for role,rect,texts in [('title',ps[0],[card['title']]),('description',ps[1],card['lines'])]:
   ys=rows(b,rect)
   if role=='title'and len(ys)>1:
    texts=card['title'].split(' ')
   assert len(ys)==len(texts),(i,role,ys,texts)
   for y,text in zip(ys,texts):lines.append({'card':i,'role':role,'rect':rect,'y':y,'text':text})
 remaining=lines[:]
 for turn in range(12):
  later=[];solved=0
  for line in remaining:
   b=images[line['card']];text=line['text'];x0,y0,x1,y1=line['rect'];choices=[]
   known=sum(ch in dictionary for ch in text)
   if not known:later.append(line);continue
   for x in range(max(0,x0-8),min(320-len(text)*8,x1-len(text)*8+8)+1):
    values=[mask(b,x+j*8,line['y'])for j in range(len(text))];bad=sum(sum(a!=b for a,b in zip(value,dictionary[ch]))for ch,value in zip(text,values)if ch in dictionary)
    local={};repeat_bad=0
    for ch,value in zip(text,values):
     if ch in local and local[ch]!=value:repeat_bad+=1
     local[ch]=value
    if not bad and not repeat_bad:choices.append((x,values))
   if len(choices)!=1:later.append(line);continue
   x,values=choices[0];line['x']=x
   for j,(ch,value)in enumerate(zip(text,values)):
    if ch not in dictionary:dictionary[ch]=value;proof[ch]={'card':line['card'],'x':x+j*8,'y':line['y'],'source':line['text']}
   solved+=1
  print('recovery',turn,'resolved',solved,'remaining',len(later),'glyphs',''.join(sorted(dictionary)))
  if not solved:break
  remaining=later
 return dictionary,proof,lines,remaining

def crop(rgb,rect):
 x0,y0,x1,y1=rect;return b''.join(rgb[(y*320+x0)*3:(y*320+x1)*3]for y in range(y0,y1))
def full(rect):return(rect[0]-2,rect[1]-2,rect[2]+2,rect[3]+2)
def clear_text(rgb,rect):
 out=bytearray(rgb);x0,y0,x1,y1=rect
 for y in range(y0+2,y1-2):
  for x in range(x0+2,x1-2):
   if pixel(out,x,y)in(WHITE,SHADE):out[(y*320+x)*3:(y*320+x+1)*3]=FILL
 return out
def draw_lines(rgb,rect,texts,glyphs):
 x0,y0,x1,y1=rect;start_y=(y0+y1-len(texts)*8)//2
 for row,text in enumerate(texts):
  start_x=(x0+x1-len(text)*8)//2
  assert start_x>=x0+3 and start_x+len(text)*8<=x1-3,(rect,text)
  for i,ch in enumerate(text):
   bits=glyphs[ch]
   for y in range(8):
    for x in range(8):
     if bits[y*8+x]:at=((start_y+row*8+y)*320+start_x+i*8+x)*3;rgb[at:at+3]=WHITE if bits[y*8+x]==1 else SHADE
def replace_title(rgb,rect,text,glyphs):
 source=clear_text(rgb,rect);old=full(rect);x0,y0,x1,y1=old;w=x1-x0;h=y1-y0;new_w=max(w,len(text)*8+16);new_x=max(2,min(318-new_w,(x0+x1-new_w)//2));new=(new_x,y0,new_x+new_w,y1);assert new_x<=x0 and new_x+new_w>=x1
 template=crop(source,old);out=bytearray(rgb)
 for y in range(h):
  for x in range(new_w):
   sx=x if x<8 else w-(new_w-x)if x>=new_w-8 else 8+(x-8)%(w-16)
   # All original letters were removed; the source center contains only
   # native horizontal frame/fill pixels, so repeating it adds no art.
   at=((new[1]+y)*320+new[0]+x)*3;out[at:at+3]=template[(y*w+sx)*3:(y*w+sx+1)*3]
 draw_lines(out,new,[text],glyphs);return out,new
def corrected_assets(out,web):
 raw=ROOT/'.local/language-tutorial-ru';images=[(raw/f'card-{i:02d}.rgb').read_bytes()for i in range(33)];notes=json.loads((ROOT/'tools/language_tutorial_annotations_ru.json').read_text());glyphs,glyph_proof,lines,remaining=recover(images,notes)
 # English MCV's existing italic letters supply the unchanged Latin proper
 # abbreviation. Its original description already contains no A instruction.
 en=(ROOT/'.local/modern-tutorial-all/tutorial-003000.rgb').read_bytes()
 for i,ch in enumerate('MCV'):glyphs[ch]=mask(en,64+i*8,88);glyph_proof[ch]={'language':'en','relativeFrame':3000,'x':64+i*8,'y':88,'source':'original MCV title'}
 titles={6:'MCV',8:'ДЕСАНТНИК',9:'ТРАЙК',10:'КВАД',11:'РАКЕТНЫЙ ТАНК',13:'ОСАДНЫЙ ТАНК',15:'ОРНИТОПТЕР',16:'ЗВУКОВОЙ ТАНК',19:'СТРОИТЕЛЬНАЯ БАЗА',20:'ВЕТРОЛОВУШКА',21:'ФОРПОСТ',22:'КАЗАРМЫ',25:'ЗАВОД ТЕХНИКИ',26:'РЕМОНТНЫЙ ЦЕХ',27:'АВИАЗАВОД'}
 mcv=['СОЗДАЕТ НОВЫЙ','СТРОИТЕЛЬНЫЙ','ЦЕНТР'];hark=['СМЕРТЕЛЬНОЕ','ОРУЖИЕ','ХАРКОННЕНОВ']
 required=set(''.join(titles.values())+''.join(mcv+hark));assert not(required-set(glyphs)),sorted(required-set(glyphs))
 corrected=[];records=[];review=out/'research/tutorial-corrected';review.mkdir(parents=True,exist_ok=True)
 for i,rgb in enumerate(images):
  ps=plates(rgb);next_rgb=bytearray(rgb);areas=[];changes=[]
  if i in titles:
   next_rgb,rect=replace_title(next_rgb,ps[0],titles[i],glyphs);areas.append(rect);changes.append({'role':'title','old':notes['cards'][i]['title'],'new':titles[i],'sourcePlate':full(ps[0]),'targetPlate':rect,'resizedWidthOnly':rect[2]-rect[0]!=full(ps[0])[2]-full(ps[0])[0]})
  if i==6:
   next_rgb=clear_text(next_rgb,ps[1]);rect=full(ps[1]);draw_lines(next_rgb,rect,mcv,glyphs);areas.append(rect);changes.append({'role':'description','old':notes['cards'][i]['lines'],'new':mcv,'targetPlate':rect})
  if i==17:
   source=next(line for line in lines if line['card']==17 and line['role']=='description'and line['text']=='ХАРКОНЕНОВ');assert 'x'in source
   x,y=source['x'],source['y']
   for yy in range(y,y+8):
    for xx in range(x,x+len(source['text'])*8):
     if pixel(next_rgb,xx,yy)in(WHITE,SHADE):at=(yy*320+xx)*3;next_rgb[at:at+3]=FILL
   rect=(ps[1][0],y,ps[1][2],y+8);draw_lines(next_rgb,rect,[hark[-1]],glyphs);areas.append(rect);changes.append({'role':'description-one-word','old':source['text'],'new':hark[-1],'targetArea':rect,'allOtherDescriptionWordsUnchanged':True})
  changed=[]
  for p in range(320*224):
   if next_rgb[p*3:p*3+3]!=rgb[p*3:p*3+3]:
    x,y=p%320,p//320;assert any(a<=x<c and b<=y<d for a,b,c,d in areas),(i,x,y);changed.append(p)
  corrected.append(bytes(next_rgb));records.append({'index':i,'id':notes['cards'][i]['id'],'sourceRgbSha256':sha(rgb),'correctedRgbSha256':sha(next_rgb),'changedPixels':len(changed),'changes':changes,'outsideAnnotatedAreasByteIdentical':True})
  if changes:png(review/f'card-{i:02d}-{notes["cards"][i]["id"]}.png',320,224,next_rgb,3)
 # Glyph proof atlas: every white bit is copied from a recorded source cell.
 chars=sorted(glyphs);fw=128;fh=((len(chars)+15)//16)*8;font=bytearray(fw*fh*4)
 for i,ch in enumerate(chars):
  for y in range(8):
   for x in range(8):
    if glyphs[ch][y*8+x]:p=((i//16*8+y)*fw+i%16*8+x)*4;font[p:p+4]=(WHITE if glyphs[ch][y*8+x]==1 else SHADE)+b'\xff'
 png(out/'tutorial/recovered-italic-glyphs.png',fw,fh,font)
 atlas=bytearray(1280*2016*3)
 for i,rgb in enumerate(corrected):
  x=i%4*320;y=i//4*224
  for yy in range(224):atlas[((y+yy)*1280+x)*3:((y+yy)*1280+x+320)*3]=rgb[yy*960:(yy+1)*960]
 png(out/'tutorial/ru-native-descriptions-corrected.png',1280,2016,atlas,3);(web/'tutorial').mkdir(parents=True,exist_ok=True);(web/'tutorial/ru-native-descriptions.png').write_bytes((out/'tutorial/ru-native-descriptions-corrected.png').read_bytes())
 changed_indices=[i for i,r in enumerate(records)if r['changedPixels']]
 for start in range(0,len(changed_indices),4):
  sw,sh=1280,1792;sheet=bytearray(sw*sh*3)
  for row,i in enumerate(changed_indices[start:start+4]):
   for col,rgb in enumerate([images[i],corrected[i]]):
    for y in range(224):
     for x in range(320):
      value=rgb[(y*320+x)*3:(y*320+x+1)*3]
      for dy in range(2):p=((row*448+y*2+dy)*sw+col*640+x*2)*3;sheet[p:p+6]=value+value
  png(review/f'comparison-{start//4:02d}.png',sw,sh,sheet,3)
 (review/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Finite native-glyph corrections</title><style>body{background:#111;color:white;font:16px monospace}section{margin:20px}img{width:640px;height:448px;image-rendering:pixelated}p{margin:4px}</style>'+''.join(f'<section><p>{i:02d} {notes["cards"][i]["id"]}: original left / source-glyph correction right</p><img src="../tutorial-review/card-{i:02d}-{notes["cards"][i]["id"]}.png"><img src="card-{i:02d}-{notes["cards"][i]["id"]}.png"></section>'for i in changed_indices))
 proof={'version':1,'sourceAtlasPreserved':'tutorial/ru-native-descriptions.png','sourceAtlasSha256':sha((out/'tutorial/ru-native-descriptions.png').read_bytes()),'correctedAtlas':'tutorial/ru-native-descriptions-corrected.png','correctedAtlasSha256':sha((out/'tutorial/ru-native-descriptions-corrected.png').read_bytes()),'runtimePath':'tutorial/ru-native-descriptions.png','englishAtlasChanged':False,'method':'Finite source-glyph composition only. Exact8x8 white-and-native-shade cells recovered from known transcribed captions; green plate corners/edges/fill are copied from the same original card, with horizontal center repetition only where longer titles require it. Both native ink colours are preserved. No glyph rescaling, interpolated pixels, generated strokes or gameplay edits.','glyphInkPalette':{'0':'transparent, source glass background','1':[255,255,255],'2':[145,145,182]},'toolSha256':sha(Path(__file__).read_bytes()),'unresolvedUnusedSourceLines':remaining,'nativeRecoveredGlyphs':{ch:{**glyph_proof.get(ch,{}),'bits':list(bits),'sha256':sha(bits)}for ch,bits in glyphs.items()},'frames':records,'changedFrames':sum(bool(x['changedPixels'])for x in records),'allOtherPixelsExact':True,'retainedAliases':{'carryall':'ТРАНСПОРТ retained: optional ПЕРЕВОЗЧИК needs Ч not present in this recovered caption set.','silos':'СКЛАДЫ retained: ХРАНИЛИЩА needs Щ not present.','wall':'БЕТОННАЯ СТЕНА retained as accepted native alias, avoiding an invented Щ glyph.'},'review':'research/tutorial-corrected/index.html; four comparison sheets, original left/corrected right, exact2x pixels.'}
 (out/'tutorial/cleanup-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'changedFrames':proof['changedFrames'],'allOutsideAreasExact':True,'runtimeAtlasSha256':proof['correctedAtlasSha256'],'optionalAliasesRetained':list(proof['retainedAliases'])},ensure_ascii=False));return proof

def main():
 raw=ROOT/'.local/language-tutorial-ru';images=[(raw/f'card-{i:02d}.rgb').read_bytes()for i in range(33)];notes=json.loads((ROOT/'tools/language_tutorial_annotations_ru.json').read_text());glyphs,proof,lines,remaining=recover(images,notes)
 output=ROOT/'data/language-assets/tutorial';output.mkdir(parents=True,exist_ok=True)
 report={'glyphs':{ch:{**proof.get(ch,{}),'bits':list(bits),'sha256':sha(bits)}for ch,bits in glyphs.items()},'unresolvedLines':remaining};(output/'glyph-recovery-probe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 corrected_assets(output.parent,ROOT/'web/language-assets')
if __name__=='__main__':main()
