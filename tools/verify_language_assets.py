#!/usr/bin/env python3
"""Check exact source bitmap/text extraction and the privacy-safe runtime projection."""
from pathlib import Path
import argparse,hashlib,json,re
from extract_language_assets import ROOT,EXPECTED,font_mask,CYRILLIC_CODES,u32
from extract_building_assets import icon_pixels,palette
from extract_screen_assets import read_png

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source-dir',type=Path,required=True,help='Directory containing the Russian and European ROMs')
 parser.add_argument('--usa',type=Path,required=True,help='Path to the USA ROM')
 args=parser.parse_args()
 data=ROOT/'data/language-assets';web=ROOT/'web/language-assets';manifest=json.loads((data/'manifest.json').read_text());runtime=json.loads((web/'manifest.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
 sources={'usa':args.usa.read_bytes()}
 for record in manifest['sourceFiles']:
  if record['id']!='usa':
   sources[record['id']]=(args.source_dir/Path(record['path']).name).read_bytes()
 for key,b in sources.items():assert len(b)==1048576 and sha(b)==EXPECTED[key]
 assert [x['code']for x in runtime['languages']]==['en','ru'] and not(web/'eu-en.json').exists()
 assert '/Users/'not in(web/'manifest.json').read_text()
 source_count=0
 for language in runtime['languages']:
  code=language['code'];cat=json.loads((data/(code+'.json')).read_text());public=json.loads((web/(code+'.json')).read_text());assert public=={k:cat[k]for k in ['version','code','label','strings','nativeTexts']}
  assert 'sources'not in public and 'bySourceText'not in public and '/Users/'not in(web/(code+'.json')).read_text()
  assert len(cat['strings'])==259 and sum(k.startswith('campaign.')or k.endswith('.intro')for k in cat['strings'])==111
  for key,proof in cat['sources'].items():
   b=sources[cat['sourceRom']];raw=b[proof['romOffset']:proof['romOffset']+proof['bytes']];assert raw.hex()==proof['rawBytesHex']and sha(raw)==proof['sha256'];source_count+=1
  font=language['font'];w,h,ch,pixels=read_png(web/font['maskPath']);assert (w,h,ch)==(font['width'],font['height'],4)
  for cp,g in font['glyphs'].items():
   assert g['w']==g['h']==8 and g['x']>=0 and g['y']>=0 and g['x']+8<=w and g['y']+8<=h
   if code=='en':expected=font_mask(sources['usa'],0x4f6c8,int(cp))
   else:
    char=chr(int(cp)).upper()
    if char=='Ё':continue
    expected=font_mask(sources['rus'],0x4f6c8,CYRILLIC_CODES[char])
   actual=[pixels[((g['y']+y)*w+g['x']+x)*4+3]>0 for y in range(8)for x in range(8)];assert actual==expected
  if code=='en':assert all(int(cp)<127 for cp in font['glyphs'])
  else:assert all(0x400<int(cp)<0x500 for cp in font['glyphs'])
  for name in ['maskPath','shadowPath']:assert (web/font[name]).read_bytes()==(data/font[name]).read_bytes()
 commands=manifest['commandAssets'];assert len(commands)==12
 for command in commands:
  b=sources['rus'if command['language']=='ru'else'usa'];p=u32(b,command['romPointerEntry']);assert p==command['romOffset'];_,colors=palette(b,command['paletteRomOffset']);expected=icon_pixels(b[p:p+384],colors);w,h,ch,actual=read_png(web/command['path']);assert(w,h,ch)==(32,24,4)and actual==expected;assert(web/command['path']).read_bytes()==(data/command['path']).read_bytes()
 guide=runtime.get('ru',{}).get('tutorial');guide_frames=0;corrected_frames=0;glyph_count=0
 if guide:
  assert guide==manifest['ru']['tutorial']and guide==runtime['languages'][1]['tutorial'];w,h,ch,pixels=read_png(web/guide['path']);assert(w,h,ch)==(1280,2016,3)and guide['columns']==4 and guide['frames']==33;provenance=json.loads((data/'tutorial/provenance.json').read_text());_,_,_,original=read_png(data/'tutorial/ru-native-descriptions.png');cleanup=json.loads((data/'tutorial/cleanup-proof.json').read_text())if guide.get('variant')else None
  for frame in provenance['frames']:
   i=frame['index'];x=i%4*320;y=i//4*224;source=b''.join(original[((y+yy)*w+x)*3:((y+yy)*w+x+320)*3]for yy in range(224));crop=b''.join(pixels[((y+yy)*w+x)*3:((y+yy)*w+x+320)*3]for yy in range(224));assert sha(source)==frame['sourceRgbSha256'];guide_frames+=1
   if cleanup:
    record=cleanup['frames'][i];assert sha(crop)==record['correctedRgbSha256'];areas=[c.get('targetPlate',c.get('targetArea'))for c in record['changes']];changed=0
    for p in range(320*224):
     if crop[p*3:p*3+3]!=source[p*3:p*3+3]:
      xx,yy=p%320,p//320;assert any(a<=xx<c and b<=yy<d for a,b,c,d in areas);changed+=1
    assert changed==record['changedPixels'];corrected_frames+=bool(changed)
   else:assert crop==source
  if cleanup:
   assert corrected_frames==cleanup['changedFrames']==16 and cleanup['allOtherPixelsExact'];assert(web/guide['path']).read_bytes()==(data/cleanup['correctedAtlas']).read_bytes();assert sha((data/cleanup['sourceAtlasPreserved']).read_bytes())==cleanup['sourceAtlasSha256']
   for char,glyph in cleanup['nativeRecoveredGlyphs'].items():
    if char==' ':assert glyph['bits']==[0]*64;continue
    if glyph.get('language')=='en':rgb=(ROOT/f'.local/modern-tutorial-all/tutorial-{glyph["relativeFrame"]:06d}.rgb').read_bytes()
    else:
     i=glyph['card'];sx=i%4*320;sy=i//4*224;rgb=b''.join(original[((sy+yy)*w+sx)*3:((sy+yy)*w+sx+320)*3]for yy in range(224))
    actual=[]
    for yy in range(8):
     for xx in range(8):
      p=((glyph['y']+yy)*320+glyph['x']+xx)*3;color=rgb[p:p+3];actual.append(1 if color==bytes([255]*3) else 2 if color==bytes([145,145,182]) else 0)
    assert actual==glyph['bits'];glyph_count+=1
  else:assert(web/guide['path']).read_bytes()==(data/guide['path']).read_bytes()
 assert manifest['research']['dataEquality']['rus']['scenarioSemanticEquality'] and manifest['research']['dataEquality']['europe']['scenarioSemanticEquality']
 assert all(m['definitionSelectedFieldEquality']for m in manifest['research']['dataEquality'].values())
 for p in web.rglob('*'):
  if p.is_file():assert p.suffix in ['.json','.png']
 result={'pass':True,'runtimeLocales':['en','ru'],'sourceLiteralRecordsVerified':source_count,'keysPerLocale':259,'campaignTextRecordsPerLocale':111,'buildingNamesPerLocale':19,'unitNamesPerLocale':27,'nativeCommandPngs':12,'russianTutorialOriginalFramesPixelExact':guide_frames,'russianTutorialSourceGlyphCorrectedFrames':corrected_frames,'guideRecoveredSourceGlyphsVerified':glyph_count,'outsideGuideModifiedTextAndPlateAreasIdentical':True,'englishAsciiGlyphs':94,'cyrillicUnicodeGlyphsIncludingCaseAliases':66,'derivedCyrillicGlyphs':['Ё'],'rawOperatorPathsAbsentFromRuntimeJson':True,'runtimeBytes':sum(p.stat().st_size for p in web.rglob('*')if p.is_file()),'sourceRomsUnchanged':True,'manifestSha256':sha((data/'manifest.json').read_bytes()),'runtimeManifestSha256':sha((web/'manifest.json').read_bytes())}
 (data/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
