#!/usr/bin/env python3
"""Native-piece presentation additions; no repainting or hidden-pixel guessing.

Run after extract_screen_assets.py. Every RGB byte comes from an exact captured
native layer. Original words baked into Options are exposed as control holes,
not falsely claimed recoverable artwork.
"""
from pathlib import Path
import hashlib,json,shutil
from extract_shop_ui import ROOT,png
from extract_screen_assets import image_crop
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 output=ROOT/'data/screen-assets';manifest=json.loads((output/'manifest.json').read_text());additions={}
 def emit(name,w,h,pixels,ch,source):
  rel='art/'+name+'.png';png(output/rel,w,h,pixels,ch)
  item={'path':rel,'width':w,'height':h,'channels':ch,'transparent':ch==4,'pixelSha256':sha(pixels),'sha256':sha((output/rel).read_bytes()),**source};manifest['parts'][name]=item;additions[name]=item
 prefix=ROOT/'.local/screen-options-raw/pause-options';metadata=json.loads(prefix.with_suffix('.json').read_text());assert metadata['currentVdpRgbMismatchBytes']==0
 indices=prefix.with_suffix('.window.indices').read_bytes();palette=prefix.with_suffix('.palette.rgb').read_bytes();rgb=b''.join(palette[(i&63)*3:(i&63)*3+3]for i in indices)
 labels=[{'label':'OPTIONS','rect':[128,16,56,8]},{'label':'MUSIC IS','rect':[32,40,64,8]},{'label':'SOUNDS ARE','rect':[32,56,80,8]},{'label':'RADAR IS','rect':[32,72,64,8]},{'label':'MUSIC TEST','rect':[32,88,80,8]},{'label':'SOUND TEST','rect':[32,104,80,8]},{'label':'ENTER PASSWORD','rect':[32,136,112,8]},{'label':'PRESS START TO EXIT','rect':[72,192,168,8]}]
 label_pixels=set()
 for label in labels:
  x,y,w,h=label['rect'];label_pixels.update((y+yy)*320+x+xx for yy in range(h)for xx in range(w))
 assert all((i&15)!=8 or at in label_pixels for at,i in enumerate(indices)),'Every static native white letter lies in the declared original control rectangles'
 source={'capture':'pause-options','sourceLayer':'WINDOW','sourceRect':[0,0,320,224],'phaseProof':'Current captured VDP reproduces the completed native frame exactly','sourceRgbSha256':sha(prefix.with_suffix('.rgb').read_bytes())}
 for name,rect in [('options-helmet-and-launcher',[112,48,208,88]),('options-native-lower-body',[0,144,320,48]),('options-native-bottom-terrain',[0,200,320,24]),('options-native-right-side',[144,48,176,144]),('options-native-left-shoulder',[0,48,32,96])]:
  x,y,w,h=rect;assert not any((indices[(y+yy)*320+x+xx]&15)==8 for yy in range(h)for xx in range(w))
  emit(name,w,h,image_crop(rgb,320,rect),3,{**source,'sourceRect':rect,'scope':'Entire original label-free native fragment; no cropped label, recolour, generated pixel or resampling.'})
 # A compact original illustration for controls BELOW the art. Skip the one
 # legacy password-label row, joining two untouched, equally wide fragments.
 # This is deliberately a native-piece composition, not a reconstructed frame.
 hero_rects=[[112,48,208,88],[112,144,208,48]]
 hero=b''.join(image_crop(rgb,320,rect)for rect in hero_rects)
 assert len(hero)==208*136*3
 for x,y,w,h in hero_rects:
  assert not any((indices[(y+yy)*320+x+xx]&15)==8 for yy in range(h)for xx in range(w))
 emit('options-responsive-art',208,136,hero,3,{**source,'sourceRect':None,'sourceRects':hero_rects,'destRects':[[0,0,208,88],[0,88,208,48]],'scope':'Two original label-free WINDOW fragments joined without resampling, repainting, transparent holes or invented hidden pixels. Cropped helmet back remains the original native edge; original face, shoulder launcher and right scenery are preserved.','nativeSeam':{'destinationY':88,'sourceRows':[135,144],'removedSourceRows':[136,143],'reason':'Only the baked ENTER PASSWORD row crosses this native fragment.'}})
 rgba=bytearray(320*224*4)
 for at in range(320*224):rgba[at*4:at*4+4]=rgb[at*3:at*3+3]+bytes([0 if at in label_pixels else 255])
 emit('options-native-decor',320,224,rgba,4,{**source,'alphaSource':'Only the eight complete original static label/control rectangles are transparent; all remaining native artwork stays opaque. No RGB colour key.','controlHoles':labels,'requiresOpaqueControlsOverHoles':True,'scope':'A native-piece UI composition layer, not a claim of recovering picture pixels hidden under original baked words.'})
 # A complete title preview without ONLY the three native menu choices. The
 # source planeB is the real planet/starfield under those labels and pointer.
 title=ROOT/'.local/screen-assets-phase-raw/title-menu-000040';tm=json.loads(title.with_suffix('.json').read_text());assert tm['currentVdpRgbMismatchBytes']==0
 ti=title.with_suffix('.plane-b.indices').read_bytes();tp=title.with_suffix('.palette.rgb').read_bytes();background=b''.join(tp[(i&63)*3:(i&63)*3+3]for i in ti)
 rect=[104,156,144,32];patch=image_crop(background,320,rect);emit('title-choice-underlay',144,32,patch,3,{'capture':'title-menu-000040','sourceLayer':'plane-b','sourceRect':rect,'sourceRgbSha256':sha(title.with_suffix('.rgb').read_bytes()),'scope':'Exact original planet/starfield under native START GAME/OPTIONS/TUTORIAL and pointer; valid for settled native Main palette only.'})
 clean=bytearray(title.with_suffix('.rgb').read_bytes())
 for y in range(32):clean[((156+y)*320+104)*3:((156+y)*320+248)*3]=patch[y*144*3:(y+1)*144*3]
 emit('title-complete-without-choices',320,224,clean,3,{'capture':'title-menu-000040','sourceRect':[0,0,320,224],'recipe':'Complete actual native frame; only[104,156,144,32] replaced with its exact native planeB. DUNE/logo/subtitle/license/stars and all remaining pixels are unchanged.','scope':'Static settled-Main fallback. Live intro must use the complete live native frame, and live Main should use the read-only native choice-mask compositor.'})
 for alias,original in [('options-clean-background','options-native-decor'),('options-original-window','pause-options-original-background'),('title-choices-underlay','title-choice-underlay')]:
  item={**manifest['parts'][original],'sourceAlias':original};manifest['parts'][alias]=item;additions[alias]=item
 recipes={
 'main':{'liveRect':[0,0,320,224],'staticCompletePart':'title-complete-without-choices','choiceUnderlayPart':'title-choices-underlay','nativeChoiceArea':[104,156,144,32],'hideOnlyAfterNativePoll':0x178d2,'rule':'Preserve full original intro. Hide native menu glyphs/pointer only after actual Main is ready; never crop to the top144px.'},
 'pause-options':{'originalWindowPart':'options-original-window','nativeDecorPart':'options-clean-background','cleanWideHeroPart':'options-responsive-art','completeNativeSize':[320,224],'controlHoles':labels,'suggestedOpaqueCoverRects':[[120,8,72,24],[24,32,96,88],[24,128,128,24],[64,184,184,24]],'parts':[name for name in additions if name.startswith('options-')],'rule':'Use options-responsive-art above separate controls. It joins two untouched original fragments; the native8px password-label row is omitted. Full original WINDOW and label-hole composition are reference alternatives. Hidden original artwork is not invented; do not substitute results soldiers.'},
 'story':{'liveRect':[0,0,320,224],'nativeTextRect':[16,16,288,40],'nativeChoiceAreas':[[184,164,96,24],[184,188,96,28]],'requiresNativeTextlessCompositor':True,'rule':'Show complete original advisor+strategic map. Strip only original font480..4DE over true native background; fifth row overlaps the map. Original gold choice areas have genuine black background outside advisor/map; reflow the actual native message below.'},
 'cinematics':{'liveRect':[0,0,320,224],'originalMovieContentRect':[8,40,304,120],'rule':'Keep the complete native canvas and original cadence, including the original black surrounding frame. A single reference PNG is not an animation replacement.'},
 'results-ending':{'liveRect':[0,0,320,224],'rule':'Keep full original stats/background/extended artwork and ending/credits. Do not substitute cropped soldiers or a separately calculated scoreboard.'}}
 for key in ['options','pause-options','pause']:
  if key in manifest['screens']:manifest['screens'][key].update({'staticHeroPart':'options-responsive-art','heroSourceRect':None,'heroSourceRects':hero_rects,'originalWindowPart':'pause-options-original-background','nativeDecorPart':'options-native-decor','nativeCompositionRecipe':'pause-options'})
 for key in ['title','main','main-menu']:
  if key in manifest['screens']:manifest['screens'][key].update({'sourceRect':[0,0,320,224],'completePartWithoutChoices':'title-complete-without-choices','choiceUnderlayPart':'title-choice-underlay','nativeCompositionRecipe':'main'})
 for key in ['house_briefing','briefing','victory','defeat']:
  if key in manifest['screens']:
   item=manifest['screens'][key];item['advisorAnimationRect']=item.get('portraitRect');item.update({'sourceRect':[0,0,320,224],'portraitRect':None,'nativeCompositionRecipe':'story'})
 for key in ['victory_movie','defeat_movie']:
  if key in manifest['screens']:manifest['screens'][key].update({'originalMovieContentRect':[8,40,304,120],'movieRect':[0,0,320,224],'sourceRect':[0,0,320,224],'nativeCompositionRecipe':'cinematics'})
 for key in ['results','password_display','ending','credits']:
  if key in manifest['screens']:manifest['screens'][key].update({'sourceRect':[0,0,320,224],'portraitRect':None,'nativeCompositionRecipe':'results-ending'})
 manifest['presentationRecipes']=recipes;manifest['nativeSceneAdditionsExtractorSha256']=sha(Path(__file__).read_bytes());manifest['pngCount']=len(list(output.rglob('*.png')));manifest['pngBytes']=sum(p.stat().st_size for p in output.rglob('*.png'));(output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 review=ROOT/'data/scene-presentation';review.mkdir(parents=True,exist_ok=True);(review/'manifest.json').write_text(json.dumps({'version':1,'parts':additions,'recipes':recipes,'source':manifest['source']},ensure_ascii=False,indent=2)+'\n')
 web=ROOT/'web/ui-assets/screen-assets'
 for part in additions.values():p=web/part['path'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(output/part['path'],p)
 shutil.copyfile(output/'manifest.json',web/'manifest.json');print(json.dumps({'pass':True,'newNativeParts':len(additions),'pngCount':manifest['pngCount'],'pngBytes':manifest['pngBytes']}))
if __name__=='__main__':main()
