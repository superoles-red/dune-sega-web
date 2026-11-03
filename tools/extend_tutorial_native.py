#!/usr/bin/env python3
"""Package the33 complete original descriptive tutorial cards, without practice."""
from pathlib import Path
import hashlib,json,shutil
from extract_shop_ui import ROOT,png
from extract_screen_assets import read_png
def sha(b):return hashlib.sha256(b).hexdigest()
def main(raw=None,output=None):
 raw=Path(raw)if raw else ROOT/'.local/modern-tutorial-all';out=Path(output)if output else ROOT/'data/modern-tutorial';out.mkdir(parents=True,exist_ok=True)
 captures={x['relativeFrame']:x for x in map(json.loads,(raw/'captures.jsonl').read_text().splitlines())}
 m={'version':2,'nativeSize':[320,224],'source':json.loads((ROOT/'docs/source-identity.json').read_text()),'captureTool':'tools/capture_modern_tutorial_native.c','extractor':'tools/extend_tutorial_native.py','captureIndexSha256':sha((raw/'captures.jsonl').read_bytes()),'capturePolicy':'Genuine original Main to Tutorial route from the canonical cold-boot frontend CPU; original scripts run without synthetic orders, jumps or a new game simulation.','presentationPolicy':'Only33 original terrain, unit and building descriptions, with complete320x224 source composition and bounded manual page navigation. The guide loads no practice fixture and polls no native state.','cropPolicy':'Every card preserves the full original320x224 frame.','assets':{}}
 cards=[
 ('terrain','sand',300,'SAND','All units can travel on sand.'),('terrain','spice',600,'SPICE','Harvest spice for credits.'),('terrain','dunes',1200,'SAND DUNES','Sand dunes slow units down.'),('terrain','rock',1500,'ROCK','Build your buildings on rock.'),('terrain','mountains',1800,'MOUNTAINS','Vehicles cannot cross mountains. Infantry can pass.'),
 ('units','harvester',2700,'HARVESTER','Harvesters collect spice.'),('units','mcv',3000,'MCV','Deploy an MCV to create a construction site.'),('units','infantry',3600,'INFANTRY','Infantry have light armor.'),('units','trooper',3900,'TROOPER','Troopers have light armor.'),('units','trike',4200,'TRIKE','Trikes have light armor.'),('units','quad',4800,'QUAD','Quads have light armor.'),('units','missile-tank',5100,'MISSILE TANK','Missile Tanks have light armor.'),('units','combat-tank',5400,'COMBAT TANK','Combat Tanks have medium armor.'),('units','siege-tank',6000,'SIEGE TANK','Siege Tanks have heavy armor.'),('units','carryall',6300,'CARRYALL','Carryalls transport vehicles.'),('units','ornithopter',6600,'ORNITHOPTER','Ornithopters have light armor.'),('units','sonic-tank',7200,'SONIC TANK','Sonic Tanks have medium armor.'),('units','death-hand',7500,'DEATH HAND','A battlefield support missile.'),('units','devastator',7800,'DEVASTATOR','Devastators have heavy armor.'),
 ('buildings','yard',8700,'CONSTRUCTION YARD','Use the Yard to build new structures.'),('buildings','windtrap',9300,'WINDTRAP','Windtraps supply power to your buildings.'),('buildings','outpost',9600,'OUTPOST','The Outpost displays an overview map.'),('buildings','barracks',9900,'BARRACKS','Barracks produce infantry units.'),('buildings','refinery',10500,'REFINERY','Refineries turn spice into credits.'),('buildings','silos',10800,'SILOS','Silos provide extra storage for spice.'),('buildings','vehicle-factory',11100,'VEHICLE FACTORY','Vehicle Factories produce vehicles.'),('buildings','repair',11700,'REPAIR FACILITY','Repair Facilities repair damaged vehicles.'),('buildings','high-tech',12000,'HIGH TECH FACTORY','High Tech Factories produce airborne units.'),('buildings','turret',12300,'TURRET','Turrets provide close-range defense.'),('buildings','rocket-turret',12900,'ROCKET TURRET','Rocket Turrets provide long-range defense.'),('buildings','starport',13200,'STARPORT','Use the Starport to purchase vehicles.'),('buildings','palace',13500,'PALACE','A command center awarded to chosen leaders.'),('buildings','wall',13980,'DEFENSIVE WALL','Build walls to improve your defenses.')]
 cols=4;rows=(len(cards)+cols-1)//cols;w=cols*320;h=rows*224;sheet=bytearray(w*h*3);proof=[];descriptions=[]
 for i,(chapter,key,n,title,text)in enumerate(cards):
  b=(raw/f'tutorial-{n:06}.rgb').read_bytes();assert len(b)==320*224*3;x=i%cols*320;y=i//cols*224
  for yy in range(224):sheet[((y+yy)*w+x)*3:((y+yy)*w+x+320)*3]=b[yy*960:(yy+1)*960]
  proof.append({'relativeFrame':n,'nativeFrame':captures[n]['nativeFrame'],'sourceRgbSha256':sha(b),'cropRgbSha256':sha(b)})
  descriptions.append({'id':key,'chapter':chapter,'title':title,'text':text,'asset':'native-descriptions','frameIndex':i})
 rel='art/native-descriptions.png';
 if (out/rel).exists():
  aw,ah,ac,ap=read_png(out/rel);assert (aw,ah,ac)==(w,h,3) and ap==sheet,'Existing original atlas must remain byte-identical'
 else:png(out/rel,w,h,sheet,3)
 m['assets']['native-descriptions']={'path':rel,'width':320,'height':224,'sheetWidth':w,'sheetHeight':h,'columns':cols,'frames':len(cards),'frameMs':None,'manualFrames':True,'sourceRect':[0,0,320,224],'sourceFrames':proof,'pngSha256':sha((out/rel).read_bytes()),'pixelSha256':sha(sheet),'scope':'All33 descriptive examples, complete original composition captured before the controller/instruction-button demonstration starts. Static manual cards, not a claimed full-rate animation.'};m['descriptions']=descriptions
 m['navigation']={'kind':'bounded-pages','controls':['BACK','PREV','NEXT'],'firstPrevDisabled':True,'lastNextDisabled':True,'back':'host-callback'}
 (out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
 readme='# Original descriptions\n\nThe current tutorial contains33 original full320x224 descriptions of terrain, units and buildings. BACK returns through the host callback; PREV and NEXT move between pages. The first PREV and last NEXT are disabled. There is no interactive practice, native-state polling or continuous guide rendering.\n\nThe one referenced atlas is byte-identical to its completed native source frames. Other historical PNGs and archived lesson data are unreferenced research artifacts. Training fixtures and native tools remain archived; this guide never loads them.\n\nReproduce from the existing complete native capture:\n\n```sh\npython3 tools/extract_modern_tutorial.py\n```\n\nTo recapture the original tutorial first:\n\n```sh\nclang -std=c11 -O1 tools/capture_modern_tutorial_native.c -o .local/capture-modern-tutorial -lm\n.local/capture-modern-tutorial .local/frontend-fixture/frontend.cpu.bin .local/modern-tutorial-all 42000 30\n```\n'
 (out/'README.md').write_text(readme)
 archive_note='# Archived practice research\n\nThe playable-training experiment and its native fixture remain preserved for reference. They are not imported, loaded or shown by the current descriptions-only tutorial. Current page data and source hashes are in manifest.json.\n'
 (out/'NATIVE-PRACTICE.md').write_text(archive_note)
 if out.resolve()==(ROOT/'data/modern-tutorial').resolve():
  web=ROOT/'web/tutorial-assets';web.mkdir(parents=True,exist_ok=True)
  for file in ['manifest.json','README.md','NATIVE-PRACTICE.md',rel]:
   target=web/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(out/file,target)
 print(json.dumps({'pass':True,'descriptions':len(descriptions),'runtimeAtlases':1,'nativeAtlasBytes':(out/rel).stat().st_size}))
if __name__=='__main__':main()
