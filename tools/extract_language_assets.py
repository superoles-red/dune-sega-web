#!/usr/bin/env python3
"""Read-only language resource extraction from the operator-supplied Sega ROMs.
Only normalized text/bitmap presentation assets are written; ROMs are not patched.
"""
from pathlib import Path
import argparse,hashlib,json,re,shutil
from extract_building_assets import png,palette,icon_pixels
from extract_campaign_manifest import decode_scenario
ROOT=Path(__file__).resolve().parents[1]
US=Path('/Users/oleskarpov/Desktop/TEMP на Mac/SEGA/Dune - The Battle for Arrakis (USA).gen')
LANG=Path('/Users/oleskarpov/Downloads/Dune lang')
EXPECTED={'usa':'b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba','rus':'4d93c48957cc81fc49a6edff6353787e5d32eb5e2c86963182fba918a45e906a','europe':'31979d1d9a5d6fe5c9ae95f3cfc1dd6f9f51e9e075268bb8a9f9ca57da847547'}
RU_CODES={ord(k):v for k,v in {'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','a':'Щ','b':'Ь','c':'Ы','d':'Б','e':'Ъ','f':'Г','g':'Д','h':'Э','i':'Ж','j':'З','k':'Ю','l':'И','n':'Й','q':'Л','r':'Я','s':'П','u':'У','v':'Ф','w':'Ц','y':'Ч','z':'Ш'}.items()}
HOUSES=['harkonnen','atreides','ordos']
CYRILLIC_CODES={'А':65,'Б':100,'В':66,'Г':102,'Д':103,'Е':69,'Ж':105,'З':106,'И':108,'Й':110,'К':75,'Л':113,'М':77,'Н':72,'О':79,'П':115,'Р':80,'С':67,'Т':84,'У':117,'Ф':118,'Х':88,'Ц':119,'Ч':121,'Ш':122,'Щ':97,'Ъ':101,'Ы':99,'Ь':98,'Э':104,'Ю':107,'Я':114}
def sha(b):return hashlib.sha256(b).hexdigest()
def u16(b,a):return int.from_bytes(b[a:a+2],'big')
def u32(b,a):return int.from_bytes(b[a:a+4],'big')
def norm(s):return re.sub(r'\s+',' ',s).strip()
def rawstr(b,a):
 assert 0x200<a<len(b);end=b.index(0,a);assert end-a<4096
 return b[a:end]
def text(b,rus=False):return ''.join(RU_CODES.get(x,chr(x)) if rus else chr(x) for x in b)
def font_mask(b,base,code):
 raw=b[base+code*32:base+(code+1)*32];assert len(raw)==32
 return [((raw[y*4+x//2]&15)if x&1 else raw[y*4+x//2]>>4)==9 for y in range(8)for x in range(8)]
def font_assets(out,roms):
 fonts={};proof={}
 for code,profile,chars in [('en','usa',{chr(i):i for i in range(32,127)}),('ru','rus',CYRILLIC_CODES)]:
  b=roms[profile];base=0x4f6c8;items=list(chars.items());masks=[font_mask(b,base,raw)for _,raw in items]
  if code=='ru':
   # The fan font has no Ё. A declared optional composition uses native E
   # rows and two native two-pixel dot strokes; it never replaces source art.
   e=font_mask(b,base,69);yo=[False]*64
   for y,source_y in enumerate([0,1,3,4,5,6],2):yo[y*8:(y+1)*8]=e[source_y*8:(source_y+1)*8]
   dot=font_mask(b,base,46);dot_row=next(y for y in range(8)if any(dot[y*8:(y+1)*8]));dot_pixels=[v for v in dot[dot_row*8:(dot_row+1)*8]if v];assert len(dot_pixels)==2
   for start in [1,4]:yo[start:start+2]=dot_pixels
   items.append(('Ё',None));masks.append(yo)
  cols=16;rows=(len(items)+cols-1)//cols;width=128;height=rows*8;glyphs={}
  for shadow in [False,True]:
   pixels=bytearray(width*height*4)
   for i,((ch,raw),mask)in enumerate(zip(items,masks)):
    gx=i%cols*8;gy=i//cols*8
    for y in range(8):
     for x in range(8):
      white=mask[y*8+x];black=shadow and not white and any(0<=x-dx<8 and 0<=y-dy<8 and mask[(y-dy)*8+x-dx]for dx,dy in [(1,0),(0,1),(1,1)])
      at=((gy+y)*width+gx+x)*4;pixels[at:at+4]=bytes([255,255,255,255])if white else bytes([0,0,0,255])if black else bytes(4)
    glyphs[str(ord(ch))]={'x':gx,'y':gy,'w':8,'h':8,'width':8,'height':8,'nativeByte':raw}
    if code=='ru':glyphs[str(ord(ch.lower()))]=dict(glyphs[str(ord(ch))])
   name=f'fonts/{code}-'+('shadow'if shadow else'mask')+'.png';png(out/name,width,height,pixels)
   fonts.setdefault(code,{'glyphs':glyphs,'advance':8,'width':width,'height':height,'asciiPolicy':'USA bitmap ASCII stays separate and unchanged; Cyrillic font is Unicode-only.'})['shadowPath'if shadow else'maskPath']=name
  proof[code]={'sourceRom':profile,'fontRomBase':base,'sourceFontBytesSha256':sha(b[base+32*32:base+127*32]),'sourceNativeCharacters':len(chars),'derivedCharacters':['Ё']if code=='ru'else[],'shadow':'Exact original right/down/down-right one-pixel shadow geometry. Native USA title VRAM equality independently verified for94 ordinary glyphs; byte64 is a native special control glyph, not a standard@ sign.'}
 fonts['en']['glyphs'].pop('64',None)
 # A readable two-line original-art preview. ASCII glyphs always use USA;
 # Cyrillic always uses the separate native fan-font bitmaps.
 samples=['ENGLISH 0123456789','РУССКИЙ АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];w=44*8;h=24;preview=bytearray(w*h*4)
 for row,sample in enumerate(samples):
  for i,ch in enumerate(sample):
   lang='ru'if ord(ch)>=0x400 else'en';f=fonts[lang];g=f['glyphs'].get(str(ord(ch)))
   if not g:continue
   if lang=='en':mask=font_mask(roms['usa'],0x4f6c8,ord(ch))
   elif ch=='Ё':mask=yo
   else:mask=font_mask(roms['rus'],0x4f6c8,CYRILLIC_CODES[ch])
   for y in range(8):
    for x in range(8):
     if mask[y*8+x]:at=((row*12+y)*w+i*8+x)*4;preview[at:at+4]=bytes([255,255,255,255])
 png(out/'font-preview.png',w,h,preview)
 native=ROOT/'.local/screen-assets-phase-raw/title-menu-000040.vram.bin'
 if native.exists():
  vram=native.read_bytes();matches=[]
  for ch in range(32,127):
   if ch==64:continue
   mask=font_mask(roms['usa'],0x4f6c8,ch);expected=[]
   for y in range(8):
    for x in range(8):expected.append(13 if mask[y*8+x]else 15 if any(0<=x-dx<8 and 0<=y-dy<8 and mask[(y-dy)*8+x-dx]for dx,dy in [(1,0),(0,1),(1,1)])else 0)
   raw=vram[(0x480+ch)*32:(0x481+ch)*32];actual=[n for byte in raw for n in [byte>>4,byte&15]];assert actual==expected;matches.append(ch)
  proof['en']['nativeShadowValidation']={'relativeSource':str(native.relative_to(ROOT)),'sourceVramSha256':sha(vram),'matchingNativeGlyphCodes':matches,'nativeGlyphCount':94,'excludedControlByte':64}
 return fonts,proof
def command_assets(out,roms):
 result=[];preview=bytearray(192*48*4)
 for row,(code,profile)in enumerate([('en','usa'),('ru','rus')]):
  b=roms[profile];words,colors=palette(b,0xa6c98+96)
  for col,(raw,key)in enumerate([(28,'exit-enabled'),(29,'fix-enabled'),(30,'stop-enabled'),(31,'fix-disabled'),(32,'stop-disabled'),(27,'send-order-enabled')]):
   entry=0x70ca4+raw*4;ptr=u32(b,entry);data=b[ptr:ptr+384];rgba=icon_pixels(data,colors);path=f'commands/{code}-{key}.png';png(out/path,32,24,rgba)
   for y in range(24):preview[((row*24+y)*192+col*32)*4:((row*24+y)*192+col*32+32)*4]=rgba[y*128:(y+1)*128]
   result.append({'language':code,'key':key,'raw':raw,'path':path,'width':32,'height':24,'labelSourceRect':None if raw==27 else[2,6,28,12],'romPointerTable':0x70ca4,'romPointerEntry':entry,'romOffset':ptr,'sourceRawSha256':sha(data),'paletteRomOffset':0xa6c98+96,'cramWords':words,'sha256':sha((out/path).read_bytes()),'label':None if raw==27 else({'exit-enabled':'ВЫХОД','fix-enabled':'РЕМ','fix-disabled':'РЕМ','stop-enabled':'СТОП','stop-disabled':'СТОП'}if code=='ru'else{'exit-enabled':'EXIT','fix-enabled':'FIX','fix-disabled':'FIX','stop-enabled':'STOP','stop-disabled':'STOP'})[key],'sourcePolicy':'Non-text native order arrow; identicalUSA/RU resource, also used for production Upgrade; no separate disabled-order pointer exists in33-entry native icon table.'if raw==27 else'Literal native4bpp column-major32x24 sprite and source CRAM. Nibble0 transparent. No painted/recolored letters; native fan translation abbreviates Repair as РЕМ.'})
 png(out/'command-preview.png',192,48,preview)
 (out/'commands.json').write_text(json.dumps({'version':1,'commands':result},ensure_ascii=False,indent=2)+'\n')
 return result
def source_inventory(out,roms):
 research=out/'research';research.mkdir(exist_ok=True);resources={};captions=[];scenarios={};stats={}
 for profile,b in roms.items():
  shift=-8 if profile=='europe'else 0;files=[];table=0x52c34+shift
  for i in range(128):
   entry=table+i*8;name_ptr=u32(b,entry)
   if not name_ptr:break
   name=rawstr(b,name_ptr).decode('ascii');ptr=u32(b,entry+4);files.append({'name':name,'romOffset':ptr,'namePointer':name_ptr,'tableEntry':entry})
   if name.startswith('SCEN'):scenarios.setdefault(profile,{})[name]=decode_scenario(b,ptr)
   if name.startswith('REGION'):
    raw=rawstr(b,ptr);section=''
    for match in re.finditer(rb'([^\r\n]*)(?:\r\n|$)',raw):
     line=match.group(1).decode('ascii');head=re.match(r'\[(.*?)\]',line)
     if head:section=head.group(1)
     m=re.match(r'(ENG|FRE|GER)TXT\s*(\d+)\s*=\s*(.*)',line)
     if m:captions.append({'profile':profile,'file':name,'section':section,'language':{'ENG':'en','FRE':'fr','GER':'de'}[m.group(1)],'id':int(m.group(2)),'text':m.group(3),'romOffset':ptr+match.start(1),'sourceLine':line,'status':'legacy raw INI resource; not proof of selectable/full runtime localization','warning':'Many French/German source lines are visibly truncated at the first absent accented character. No missing suffix is invented.'if m.group(1)!='ENG'else None})
  assert len(files)==37 and len(scenarios.get(profile,{}))==27;resources[profile]=files;stat={'buildings':[],'units':[]}
  for kind,base,count in [('buildings',0x6b954,19),('units',0x6c5bc,27)]:
   for ident in range(count):
    p=u32(b,base+shift+ident*4);record={'id':ident,'cost':u16(b,p+22),'hp':u16(b,p+16)}
    if kind=='buildings':record.update(power=int.from_bytes(b[p+58:p+60],'big',signed=True),campaign=u16(b,p+26),houseMask=b[p+50],sort=b[p+32],upgradeLevel=b[p+33])
    else:record.update(damage=u16(b,p+84),range=u16(b,p+82))
    stat[kind].append(record)
  stats[profile]=stat
 canonical=lambda record:{k:v for k,v in record.items()if k not in ['romOffset','sha256']}
 equality={profile:{'scenariosCompared':27,'scenarioSemanticEquality':all(canonical(scenarios[profile][k])==canonical(v)for k,v in scenarios['usa'].items()),'definitionFieldsCompared':{'buildingIds':19,'unitIds':27,'buildingFields':['cost','hp','power','campaign','houseMask','sort','upgradeLevel'],'unitFields':['cost','hp','damage','range']},'definitionSelectedFieldEquality':stats[profile]==stats['usa']}for profile in ['rus','europe']}
 (research/'resource-index.json').write_text(json.dumps(resources,ensure_ascii=False,indent=2)+'\n');(research/'legacy-region-captions.json').write_text(json.dumps({'records':captions,'captionCountPerProfile':{p:{l:sum(x['profile']==p and x['language']==l for x in captions)for l in ['en','fr','de']}for p in roms},'shipping':False},ensure_ascii=False,indent=2)+'\n')
 (research/'scenario-definition-comparison.json').write_text(json.dumps({'comparisons':equality,'scenarios':scenarios,'selectedDefinitionFields':stats,'scope':'Read-only data comparison only, not an equivalence proof for regional machine code. Shipping runtime always remains the pinned USA program.'},ensure_ascii=False,indent=2)+'\n')
 flags={'nativeCountryFlagsFound':False,'searchScope':['All37 named native resource-index entries in each supplied ROM: no language/flag/country resource names.','Existing full native Main/Options/house-picker source-art inventory has no country-language selector; three faction banners are house emblems, not country flags.'],'limitation':'This is a bounded resource/UI inventory, not semantic identification of every opaque graphics byte. It does not prove an arbitrary unused bitmap could never resemble a flag.','shipping':'No native country flags are exported or claimed. Any English/Russian picker flag must be an explicitly authored matching-style interface symbol.'}
 (research/'country-flags.json').write_text(json.dumps(flags,ensure_ascii=False,indent=2)+'\n')
 return {'resourceIndexCountPerProfile':{k:len(v)for k,v in resources.items()},'legacyRegionCaptionCount':len(captions),'dataEquality':equality,'countryFlags':flags}
def translation_review(out,catalogs):
 en,ru=catalogs['en'],catalogs['ru'];differences=[]
 for key,value in en['strings'].items():
  if not(key.startswith('campaign.')or key.endswith('.intro')):continue
  actual=ru['strings'][key];a=re.findall(r'\d+',value);b=re.findall(r'\d+',actual)
  if sorted(a)!=sorted(b):differences.append({'key':key,'reason':'Numeric story/hint content differs; preserve canonical English mission meaning in an authored faithful translation.','englishNumbers':a,'fanRussianNumbers':b,'english':value,'fanRussian':actual})
 notes={'campaign.harkonnen.1.hints':'Fan text omits the original1000-credit hint and adds destroying enemy infantry; that additional advice is not in the canonical source.','campaign.ordos.1.hints':'Fan text omits the explicit original1000-credit quota.','campaign.atreides.7.briefing':'Fan text adds sector7 where the original only says this region.','statistics.rank.5':'Outpost Commander is freely translated as Начальник связи (communications chief).','statistics.rank.8':'Ruler of Arrakis is freely translated as Лучший из лучших (best of the best).','shop.damage':'Original Dmg means damage. Fan ЖЗН suggests life/HP and is an inaccurate label; a faithful host label should use УРОН.','shop.sendOrder':'This fan-ROM inline caption remains English; use an explicitly authored Russian UI label rather than falsely calling it a native Russian string.'}
 result={'status':'Source extraction is not certification of fan translation fidelity.','campaignRecords':111,'canonicalMeaningSource':'Pinned USA English111 texts. A separate authored faithful Russian story can replace these fan strings in the host presentation only.','cyrilNote':'МОЕ ИМЯ КИРИЛЛ translates the original Mentat Cyril greeting; it is not a translator credit.','detectedNumericalDifferences':differences,'concreteSemanticNotes':notes,'scope':'Automated numeric comparison plus bounded manual examples; no claim that all111 fan texts were semantically reviewed. Raw extracted strings are never silently rewritten.'}
 (out/'research/translation-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 return {'status':'unreviewed-fan-source; canonical English remains authority','numericalDifferences':len(differences),'details':'research/translation-review.json'}
def tutorial_assets(out,raw):
 if not(raw/'captures.jsonl').exists():return None
 source=json.loads((ROOT/'data/modern-tutorial/manifest.json').read_text());cards=source['descriptions'];captures=[json.loads(line)for line in(raw/'captures.jsonl').read_text().splitlines()];assert len(cards)==len(captures)==33
 cols=4;rows=9;w=1280;h=2016;atlas=bytearray(w*h*3);proof=[];review=out/'research/tutorial-review';review.mkdir(parents=True,exist_ok=True);images=[]
 for i,(card,capture)in enumerate(zip(cards,captures)):
  assert capture['index']==i;rgb=(raw/f'card-{i:02d}.rgb').read_bytes();assert len(rgb)==320*224*3;images.append(rgb);x=i%cols*320;y=i//cols*224
  for yy in range(224):atlas[((y+yy)*w+x)*3:((y+yy)*w+x+320)*3]=rgb[yy*960:(yy+1)*960]
  png(review/f'card-{i:02d}-{card["id"]}.png',320,224,rgb,3)
  proof.append({'index':i,'id':card['id'],'chapter':card['chapter'],'sourceRgbSha256':sha(rgb),'relativeFrame':capture['relativeFrame'],'nativeFrame':capture['nativeFrame'],'nativePc':capture['pc'],'scriptPointer':capture['scriptPointer']})
 for start in range(0,33,6):
  sw,sh=1280,1344;sheet=bytearray(sw*sh*3)
  for local,rgb in enumerate(images[start:start+6]):
   ox=local%2*640;oy=local//2*448
   for y in range(224):
    for x in range(320):
     value=rgb[(y*320+x)*3:(y*320+x+1)*3]
     for dy in range(2):
      at=((oy+y*2+dy)*sw+ox+x*2)*3;sheet[at:at+6]=value+value
  png(review/f'sheet-{start//6:02d}.png',sw,sh,sheet,3)
 path='tutorial/ru-native-descriptions.png';png(out/path,w,h,atlas,3)
 metadata={'path':path,'width':320,'height':224,'sheetWidth':w,'sheetHeight':h,'columns':4,'frames':33,'manualFrames':True,'frameIndexPolicy':'Same33 card IDs/order and320x224 source geometry. Literal source atlas is preserved in data; the runtime correction variant is separately declared.'}
 annotations=ROOT/'tools/language_tutorial_annotations_ru.json';notes=json.loads(annotations.read_text());assert all(a['id']==b['id']and a['index']==b['index']for a,b in zip(notes['cards'],proof));assert len(notes['cards'])==33
 (out/'tutorial/transcription-ru.json').write_text(json.dumps(notes,ensure_ascii=False,indent=2)+'\n')
 provenance={'version':1,'sourceRom':'rus','sourceRomSha256':EXPECTED['rus'],'pinnedOriginalCodeSha256':json.loads((ROOT/'docs/source-identity.json').read_text())['generatedSourceSha256'],'originalFrontendFixtureSha256':sha((ROOT/'.local/frontend-fixture/frontend.cpu.bin').read_bytes()),'captureTool':'tools/capture_language_tutorial_native.c','captureToolSha256':sha((ROOT/'tools/capture_language_tutorial_native.c').read_bytes()),'captureIndexSha256':sha((raw/'captures.jsonl').read_bytes()),'method':'Offline pinned-USA translated original resource renderer runs original Main→Tutorial flow with supplied Russian ROM data. No Russian68K machine-code patches are executed, no map/gameplay is simulated, and shipping USA runtime ROM/code is never replaced. All resulting card pixels come from the supplied resource data and original renderer.','limitation':'Resource composition proof, not a claim of complete execution-equivalence for the Russian hacked program. Descriptive text is preserved inside actual native bitmap cards; it is not falsely reported as a decoded plaintext table.','runtime':metadata,'atlasPixelSha256':sha(atlas),'atlasPngSha256':sha((out/path).read_bytes()),'frames':proof,'review':{'nativePngs':'research/tutorial-review/card-*.png','contactSheets':'research/tutorial-review/sheet-00.png through sheet-05.png','sheetGeometry':'6 cards per sheet,2 columns×3rows, exact2x pixel repetition, no interpolation. Last sheet has3 cards.','manualTranscription':'tutorial/transcription-ru.json','manualAnnotationSource':str(annotations.relative_to(ROOT)),'manualAnnotationSha256':sha(annotations.read_bytes()),'sourceSpellingPolicy':'All33 cards visually reviewed; source term variants/house spelling and the original A-button wording are explicitly noted. Original pixels stay unchanged.'}}
 (out/'tutorial/provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
 (review/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Original Russian tutorial —33cards</title><style>body{background:#111;color:white;font:16px monospace}section{display:inline-block;margin:8px;vertical-align:top}img{width:640px;height:448px;image-rendering:pixelated;display:block}</style>'+''.join(f'<section><p>{i:02d} {card["id"]}</p><img src="card-{i:02d}-{card["id"]}.png"></section>'for i,card in enumerate(cards)))
 return metadata
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source-dir',type=Path,default=LANG);ap.add_argument('--usa',type=Path,default=US);ap.add_argument('--output',type=Path,default=ROOT/'data/language-assets');ap.add_argument('--web-output',type=Path,default=ROOT/'web/language-assets');ap.add_argument('--tutorial-raw',type=Path,default=ROOT/'.local/language-tutorial-ru');a=ap.parse_args()
 paths={'usa':a.usa,'rus':next(a.source_dir.glob('*Rus*.gen')),'europe':next(a.source_dir.glob('*Europe*.gen'))}
 roms={k:p.read_bytes()for k,p in paths.items()}
 for key,b in roms.items():assert len(b)==1048576 and sha(b)==EXPECTED[key],f'Unexpected source {key}'
 out=a.output;out.mkdir(parents=True,exist_ok=True)
 refs={};catalogs={}
 for profile,code,shift in [('usa','en',0),('rus','ru',0),('europe','eu-en',-8)]:
  b=roms[profile];rus=profile=='rus';cat={'version':1,'code':code,'label':'Русский' if rus else 'English','sourceRom':profile,'strings':{},'nativeTexts':{},'bySourceText':{},'sources':{},'coverage':{},'translationStatus':'Unreviewed third-party fan translation; source text preserved verbatim'if rus else'Original literal English'}
  def add(key,ptr,table):
   raw=rawstr(b,ptr);usptr=refs.get(key,ptr);usraw=rawstr(roms['usa'],usptr);unchanged=rus and raw==usraw;s=text(raw,rus and not unchanged);english=catalogs.get('en',{}).get('strings',{}).get(key,s);cat['strings'][key]=s;cat['nativeTexts'][str(usptr)]=s;cat['bySourceText'][norm(english)]=s
   cat['sources'][key]={'romOffset':ptr,'usaPointer':usptr,'tableEntry':table,'rawBytesHex':raw.hex(),'rawText':raw.decode('ascii'),'bytes':len(raw),'sha256':sha(raw),'translationStatus':'untranslated-source-English'if unchanged else'fan-translated'if rus else'original-English'}
   if profile=='usa':refs[key]=ptr
  for h,key in enumerate(HOUSES):
   table=0x87d7c+shift+h*4;add(f'house.{key}.intro',u32(b,table),table)
   table=0x87f38+shift+h*4;base=u32(b,table)
   for m in range(1,10):
    for j,kind in enumerate(['briefing','victory','defeat','hints']):
     entry=base+(m-1)*16+j*4;add(f'campaign.{key}.{m}.{kind}',u32(b,entry),entry)
  assert len(cat['strings'])==111
  for h,key in enumerate(HOUSES):
   entry=0x6c75a+shift+h*30;add(f'house.{key}.name',u32(b,entry),entry)
  for kind,table,count in [('building',0x6b954,19),('unit',0x6c5bc,27)]:
   for ident in range(count):
    entry=table+shift+ident*4;definition=u32(b,entry);add(f'{kind}.{ident}.name',u32(b,definition+2),definition+2)
  option_count=0
  for kind,table in [('musicTest',0x87f44),('soundTest',0x87fdc)]:
   for i in range(128):
    entry=table+shift+i*8;ptr=u32(b,entry)
    if not ptr:break
    add(f'options.{kind}.{i}',ptr,entry);option_count+=1
  action=b.find(b'Attack\0',0x12f00,0x13200)
  assert action>0
  for ident in range(14):add(f'unitAction.{ident}',action,None);action=b.index(0,action)+1
  onoff=roms['usa'].index(b'On \0Off\0',0x20d00,0x20e00)if profile!='europe'else b.index(b'On \0Off\0',0x20d00,0x20e00)
  for ident in range(14):add(f'options.value.{ident}',onoff,None);onoff=b.index(0,onoff)+1
  for key,literal in [('shop.upgrade',b'* Upgrade * '),('shop.damage',b'Dmg:        '),('shop.outOfStock',b'Out Of Stock'),('shop.sendOrder',b' Send Order ')]:
   ptr=roms['usa'].index(literal+b'\0')if profile!='europe'else b.index(literal+b'\0');add(key,ptr,None)
  rank=b.index(b'   Sand Snake')if profile!='rus'else roms['usa'].index(b'   Sand Snake')
  # Nine source result-rank strings occupy fixed17-byte slots, no NUL between.
  for ident in range(9):
   ptr=rank+ident*17;raw=b[ptr:ptr+17];key=f'statistics.rank.{ident}';usptr=refs.get(key,ptr);usraw=roms['usa'][usptr:usptr+17];s=text(raw,rus and raw!=usraw);cat['strings'][key]=s;cat['nativeTexts'][str(usptr)]=s;cat['bySourceText'][norm(text(usraw))]=s;cat['sources'][key]={'romOffset':ptr,'usaPointer':usptr,'bytes':17,'rawBytesHex':raw.hex(),'rawText':raw.decode('ascii'),'sha256':sha(raw),'format':'fixed17-byte rank slot'}
   if profile=='usa':refs[key]=ptr
  cat['coverage']={'canonicalCampaignTextRecords':111,'introRecords':3,'missionTextRecords':108,'houseNames':3,'buildingNames':19,'unitNames':27,'optionTestNames':option_count,'nativeUnitActionNames':14,'nativeOptionValueStrings':14,'nativeShopInlineLabels':4,'nativeResultRanks':9,'bakedMenuTutorialText':'Not parsed as literal C strings. Actual bitmap labels/resources are inventoried separately; no source translation is invented.','completeRuntimeLocalization':False}
  catalogs[code]=cat
 fonts,font_proof=font_assets(out,roms);commands=command_assets(out,roms);inventory=source_inventory(out,roms);review=translation_review(out,catalogs);tutorial=tutorial_assets(out,a.tutorial_raw)
 for code,cat in catalogs.items():(out/(code+'.json')).write_text(json.dumps(cat,ensure_ascii=False,indent=2)+'\n')
 inv={'version':1,'sourceFiles':[{'id':k,'path':str(paths[k]),'bytes':len(v),'sha256':sha(v),'headerRegion':v[0x1f0:0x200].decode('ascii').strip()}for k,v in roms.items()],'sourcesUntouched':True,'stage':'text-font-command-assets','languages':[{'code':code,'catalogPath':code+'.json','label':catalogs[code]['label'],'font':fonts[code],'commands':{x['key']:x['path']for x in commands if x['language']==code}}for code in ['en','ru']],'fontProvenance':font_proof,'commandAssets':commands,'coverage':{k:c['coverage']for k,c in catalogs.items()},'europe':{'canonicalEnglishCampaignEqualUSA':all(catalogs['eu-en']['strings'][k]==v for k,v in catalogs['en']['strings'].items()if k.startswith('campaign.')or k.endswith('.intro')),'shippingLocale':False},'strategy':'Read-only presentation lookup by canonical USA text/pointer. Keep USA native instructions, scenarios, prices, AI, clocks and balance; never replace runtime ROM with the European or fan-translated binary.'}
 inv['research']=inventory
 inv['extractorSha256']={name:sha((ROOT/'tools'/name).read_bytes())for name in ['extract_language_assets.py','verify_language_assets.py','capture_language_tutorial_native.c','language_tutorial_annotations_ru.json','recompose_language_tutorial.py']}
 inv['analysisBoundary']={'reaSkillApplied':True,'reaNativeTargetOpened':False,'reason':'Advertised REA raw-binary architecture schema lacks68000; no ROM was opened under a false architecture. Matching pinned original generated consumers and explicit format-aware byte/pixel parsers provide the extraction evidence.','runtimeCodeModified':False,'runtimeRomReplaced':False}
 inv['russianTranslationReview']=review
 inv['countryFlags']={'found':False,'reason':'No native country-language flags in the parsed resource/UI inventory; faction banners are not country flags.','details':'research/country-flags.json'}
 inv['fontPreview']='font-preview.png';inv['commandPreview']='command-preview.png'
 if tutorial:
  inv['languages'][1]['tutorial']=tutorial;inv['ru']={'tutorial':tutorial}
 (out/'manifest.json').write_text(json.dumps(inv,ensure_ascii=False,indent=2)+'\n')
 a.web_output.mkdir(parents=True,exist_ok=True)
 for code in ['en','ru']:
  cat=catalogs[code];runtime={k:cat[k]for k in ['version','code','label','strings','nativeTexts']};(a.web_output/(code+'.json')).write_text(json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+'\n')
 runtime_manifest={k:inv[k]for k in ['version','languages','strategy']};runtime_manifest['sources']={k:sha(v)for k,v in roms.items()};(a.web_output/'manifest.json').write_text(json.dumps(runtime_manifest,ensure_ascii=False,separators=(',',':'))+'\n')
 if tutorial:runtime_manifest['ru']={'tutorial':tutorial};(a.web_output/'manifest.json').write_text(json.dumps(runtime_manifest,ensure_ascii=False,separators=(',',':'))+'\n')
 # A previous discovery export had a European research file; it is deliberately
 # removed from the runtime projection, never from the canonical research set.
 eu_web=a.web_output/'eu-en.json'
 if eu_web.exists():eu_web.unlink()
 for folder in ['fonts','commands']+(['tutorial']if tutorial else[]):
  for source in(out/folder).glob('*.png'):
   if folder=='tutorial'and source.name!='ru-native-descriptions.png':continue
   target=a.web_output/folder/source.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
 for name in ['ru-native-descriptions-corrected.png','recovered-italic-glyphs.png']:
  stale=a.web_output/'tutorial'/name
  if stale.exists():stale.unlink() # Prior debug mirrors; originals remain in data.
 for name in ['font-preview.png','command-preview.png']:shutil.copyfile(out/name,a.web_output/name)
 if tutorial:
  from recompose_language_tutorial import corrected_assets
  cleanup=corrected_assets(out,a.web_output);tutorial['variant']='native-source-glyph-corrected';tutorial['sha256']=cleanup['correctedAtlasSha256'];inv['tutorialCorrections']={'proof':'tutorial/cleanup-proof.json','sourceAtlasPreserved':cleanup['sourceAtlasPreserved'],'canonicalCorrectedAtlas':cleanup['correctedAtlas'],'changedFrames':cleanup['changedFrames'],'allOtherPixelsExact':True}
  (out/'manifest.json').write_text(json.dumps(inv,ensure_ascii=False,indent=2)+'\n');(a.web_output/'manifest.json').write_text(json.dumps(runtime_manifest,ensure_ascii=False,separators=(',',':'))+'\n')
 for key,path in paths.items():assert sha(path.read_bytes())==EXPECTED[key],'Source ROM changed during extraction'
 print(json.dumps({'pass':True,'catalogs':{k:len(v['strings'])for k,v in catalogs.items()},'europeCanonicalCampaignEqualsUSA':catalogs['eu-en']['strings']==catalogs['en']['strings'],'output':str(out)},ensure_ascii=False))
if __name__=='__main__':main()
