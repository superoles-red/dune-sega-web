#!/usr/bin/env python3
"""Build the isolated Atreides demonstration through original native helpers.

No browser cheat entry points are created. The exported file is the same DSAV
v2 payload as an ordinary save, not a custom RAM-loader format.
"""
import argparse, hashlib, json, shutil, struct, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--fixture',type=Path,default=ROOT/'.local/campaign-fixtures/house1-mission09.cpu.bin')
 ap.add_argument('--rom',type=Path,required=True)
 ap.add_argument('--output',type=Path,default=ROOT/'data/demo')
 ap.add_argument('--evidence',type=Path,default=ROOT/'.local/demo-fixture')
 ap.add_argument('--web-save',type=Path,default=ROOT/'web/demo.state.bin')
 a=ap.parse_args();identity=json.loads((ROOT/'docs/source-identity.json').read_text())
 assert sha(a.rom)==identity['romSha256'],'Wrong source ROM'
 original=ROOT/'.local/source/build/dune-base.c';assert sha(original)==identity['generatedSourceSha256'],'Wrong translated original source'
 if not a.fixture.is_file():raise SystemExit('First generate authentic native campaign fixtures with tools/test_em_web_campaign.c; see data/demo/README.md.')
 # Copy the actual shipping serializer, not a separately invented save schema.
 shipping=ROOT/'.local/source/build/dune-web.c';source=shipping.read_text()
 start=source.index('#define DUNE_SAVESTATE_MAGIC ')
 end=source.index('EMSCRIPTEN_KEEPALIVE int dune_load_state_from_buffer',start)
 serializer=source[start:end];assert '#define DUNE_SAVESTATE_VERSION 2' in serializer
 inc=ROOT/'.local/demo-save-serializer.inc';inc.write_text(serializer)
 binary=ROOT/'.local/build-demo-fixture';native=ROOT/'tools/build_demo_fixture_native.c'
 subprocess.run(['clang','-std=c11','-O1',str(native),'-o',str(binary),'-lm'],check=True,cwd=ROOT)
 a.evidence.mkdir(parents=True,exist_ok=True)
 run=subprocess.run([str(binary),str(a.fixture),str(a.evidence)],cwd=ROOT,text=True,capture_output=True)
 (a.evidence/'build.log').write_text(run.stdout+run.stderr)
 print(run.stdout,end='')
 if run.returncode:
  print(run.stderr,file=sys.stderr,end='');run.check_returncode()
 report=json.loads((a.evidence/'report.json').read_text());state=a.evidence/'demo.state.bin';data=state.read_bytes()
 assert struct.unpack_from('<IIII',data)==(0x56415344,2,0,len(data))
 assert report['fault']==0 and report['house']==1 and report['mission']==9 and report['credits']==5000
 assert report['nativePowerProduction']>=report['nativePowerUsage'] and report['nativeSpiceCapacity']>=5000
 assert report['originalEnemyBuildings']==32
 assert {e['type']for e in report['created']}|{8}==set(range(19))-{6}
 menu_types=[2,3,4,5,7,8,9,10,11,12,13,15,16,17,18]
 menus=[]
 for t in menu_types:
  p=a.evidence/f'building-{t:02d}.json';j=json.loads(p.read_text());assert j['active'] and j['producer']['type']==t
  menus.append({'type':t,'nativeContext':j['context'],'sourceJsonSha256':sha(p)})
 a.output.mkdir(parents=True,exist_ok=True);a.web_save.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(state,a.output/'demo.state.bin');shutil.copyfile(state,a.web_save)
 sys.path.insert(0,str(ROOT/'tools'));from extract_shop_ui import png
 png(a.evidence/'demo.png',320,224,(a.evidence/'demo.rgb').read_bytes(),3)
 m={'version':1,'purpose':'Temporary isolated demonstration, not a normal campaign start or earned progression','source':identity,
 'house':1,'houseName':'Atreides','mission':9,'originalScenario':'SCENA009.INI','mapSeed':27,
 'payload':{'path':'demo.state.bin','webPath':'demo.state.bin','magic':'DSAV','version':2,'ymSize':0,'bytes':len(data),'sha256':sha(state),'serializer':'Exact current original browser dune_save_state_to_buffer copied at build time','serializerSha256':sha(inc)},
 'provenance':{'sourceFixture':str(a.fixture.relative_to(ROOT))if a.fixture.is_relative_to(ROOT)else str(a.fixture),'sourceFixtureSha256':sha(a.fixture),'sourceFixtureGeneration':'tools/test_em_web_campaign.c: original house/briefing/scenario loader, no synthetic map','builder':'tools/build_demo_fixture_native.c','builderSha256':sha(native),'driver':'tools/build_demo_fixture.py','driverSha256':sha(Path(__file__))},
 'nativeHelpers':{'buildingCreate':'0x00E584','powerAndStorageRecount':'0x010490','buildingFogReveal':'0x010870','terrainClass':'0x0057EA','initialBankDisplayRefresh':'0x011F38, original forced-refresh mode1'},
 'setup':report,'interiors':menus,
 'rules':['Authored offline preplaced scenario extras only; no cheat function is installed in the browser.','All original enemy buildings, units, AI, victory flags and terrain are retained. New concrete/slabs/wall and buildings are placed by original native routines.','Native scenario-init mode is scoped to offline placement and restored before serialization.','5000credits and its original displayed counter are initial demo values. Native spice capacity and power come from actual buildings.','Host must isolate demo from normal save storage and campaign progress; payload itself contains no host demo flag.','No balance or normal mission is modified; original AI and victory/defeat remain active during the demo.'],
 'coverage':{'nativeInteriors':15,'persistentTypes':'2..18 except unused IX6 and map-feature Wall14','terrainFeatures':[0,1,14],'noInputNativeFrames':1800,'instantWinOrLoss':False,'nativeFaults':0},
 'excludedOriginalDefinitions':[{'type':6,'key':'ix','reason':'Unused Sega placeholder: original availableHouseMask0 and explicit Yard skip at$00FF2E..$00FF3A. Has no original interactive interior; its former3x3site remains unoccupied original rock.'}],
 'limitations':['Original slab/wall placement frees its temporary record: those are native map features, not persistent active building slots.','The original enemy AI remains running; this is a demonstration city, not an endless invulnerable sandbox.','No physical-device or browser validation is claimed by this offline builder.']}
 (a.output/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'path':str(a.web_save),'bytes':len(data),'sha256':sha(state),'power':[report['nativePowerProduction'],report['nativePowerUsage']],'interiors':len(menus)},ensure_ascii=False))
if __name__=='__main__':main()
