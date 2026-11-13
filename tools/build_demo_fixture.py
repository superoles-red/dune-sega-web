#!/usr/bin/env python3
"""Build an isolated house demonstration through original native helpers.

No browser cheat entry points are created. The exported file is the same DSAV
v2 payload as an ordinary save, not a custom RAM-loader format.
"""
import argparse, hashlib, json, shutil, struct, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--house',type=int,choices=(0,1),default=1,help='0 Harkonnen/red,1 archived Atreides/blue')
 ap.add_argument('--fixture',type=Path)
 ap.add_argument('--ym',type=Path,help='Paired actual AUDIO_ON source chip state; required with --fixture')
 ap.add_argument('--rom',type=Path,required=True)
 ap.add_argument('--output',type=Path)
 ap.add_argument('--evidence',type=Path)
 ap.add_argument('--web-save',type=Path)
 a=ap.parse_args();identity=json.loads((ROOT/'docs/source-identity.json').read_text())
 suffix=''if a.house==1 else'-harkonnen'
 a.output=a.output or ROOT/f'data/demo{suffix}';a.evidence=a.evidence or ROOT/f'.local/demo-fixture{suffix}';a.web_save=a.web_save or ROOT/f'web/demo{suffix}.state.bin'
 native_mission=json.loads((ROOT/'data/campaign/manifest.json').read_text())['houses'][a.house]['missions'][8]
 assert sha(a.rom)==identity['romSha256'],'Wrong source ROM'
 original=ROOT/'.local/source/build/dune-base.c';assert sha(original)==identity['generatedSourceSha256'],'Wrong translated original source'
 audio_obj=ROOT/'.local/demo-audio-ymfm.o';backend=ROOT/'.local/source/genesis_recompiler/audio_ymfm.cpp'
 subprocess.run(['clang++','-std=c++17','-O2','-c',str(backend),'-o',str(audio_obj)],check=True,cwd=ROOT)
 source_native=ROOT/'tools/capture_demo_audio_source_native.c';source_obj=ROOT/'.local/capture-demo-audio-source.o';source_binary=ROOT/'.local/capture-demo-audio-source'
 if a.fixture is None:
  subprocess.run(['clang','-std=c11','-O1','-c',str(source_native),'-o',str(source_obj)],check=True,cwd=ROOT)
  subprocess.run(['clang++',str(source_obj),str(audio_obj),'-lm','-o',str(source_binary)],check=True,cwd=ROOT)
  source_dir=ROOT/f'.local/demo-audio-source/house{a.house}-mission09';source_dir.mkdir(parents=True,exist_ok=True)
  subprocess.run([str(source_binary),str(ROOT/'.local/frontend-fixture/frontend.cpu.bin'),str(ROOT/'.local/frontend-fixture/frontend.ym.bin'),str(source_dir),str(a.house)],check=True,cwd=ROOT)
  a.fixture=source_dir/'source.cpu.bin';a.ym=source_dir/'source.ym.bin'
 if not a.fixture.is_file() or a.ym is None or not a.ym.is_file():raise SystemExit('Demo requires a genuine AUDIO_ON campaign CPU plus paired actual YMFM state; muted campaign fixtures are not audio sources.')
 old_manifest=json.loads((a.output/'manifest.json').read_text()) if (a.output/'manifest.json').exists() else None
 # Copy the actual shipping serializer, not a separately invented save schema.
 shipping=ROOT/'.local/source/build/dune-web.c';source=shipping.read_text()
 start=source.index('#define DUNE_SAVESTATE_MAGIC ')
 end=source.index('EMSCRIPTEN_KEEPALIVE int dune_load_state_from_buffer',start)
 serializer=source[start:end];assert '#define DUNE_SAVESTATE_VERSION 2' in serializer
 inc=ROOT/'.local/demo-save-serializer.inc';inc.write_text(serializer)
 binary=ROOT/f'.local/build-demo-fixture-house{a.house}';native=ROOT/'tools/build_demo_fixture_native.c'
 native_obj=ROOT/f'.local/build-demo-fixture-house{a.house}.o'
 subprocess.run(['clang','-std=c11','-O1','-c',str(native),'-o',str(native_obj)],check=True,cwd=ROOT)
 subprocess.run(['clang++',str(native_obj),str(audio_obj),'-o',str(binary),'-lm'],check=True,cwd=ROOT)
 a.evidence.mkdir(parents=True,exist_ok=True)
 run=subprocess.run([str(binary),str(a.fixture),str(a.evidence),str(a.ym)],cwd=ROOT,text=True,capture_output=True)
 (a.evidence/'build.log').write_text(run.stdout+run.stderr)
 print(run.stdout,end='')
 if run.returncode:
  print(run.stderr,file=sys.stderr,end='');run.check_returncode()
 report=json.loads((a.evidence/'report.json').read_text());state=a.evidence/'demo.state.bin';data=state.read_bytes()
 magic,version,ym_size,total=struct.unpack_from('<IIII',data)
 assert (magic,version,total)==(0x56415344,2,len(data)) and ym_size>0
 audio_proof=json.loads((a.evidence/'audio-proof.json').read_text());assert audio_proof['ymBytes']==ym_size and audio_proof['ymWriteDelta']>100 and audio_proof['nonzeroPCMFrames']>0 and not audio_proof['nativeDropped']
 if old_manifest is not None:
  old_city=[(e['type'],e['tile']) for e in old_manifest['setup']['created']]
  new_city=[(e['type'],e['tile']) for e in report['created']]
  assert old_city==new_city,'Accepted authored city positions changed; preserve original sites before publishing'
 assert report['fault']==0 and report['house']==a.house and report['mission']==9 and report['credits']==5000
 assert report['nativePowerProduction']>=report['nativePowerUsage'] and report['nativeSpiceCapacity']>=5000
 assert report['originalEnemyBuildings']==report['sourceEnemyBuildings']
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
 'house':a.house,'houseName':['Harkonnen','Atreides'][a.house],'mission':9,'originalScenario':native_mission['sourceFile'],'mapSeed':native_mission['scenario']['settings']['mapSeed'],
 'payload':{'path':'demo.state.bin','webPath':str(a.web_save.relative_to(ROOT/'web'))if a.web_save.is_relative_to(ROOT/'web')else str(a.web_save),'magic':'DSAV','version':2,'ymSize':ym_size,'bytes':len(data),'sha256':sha(state),'serializer':'Exact current original browser dune_save_state_to_buffer copied at build time','serializerSha256':sha(inc)},
 'provenance':{'sourceFixture':str(a.fixture.relative_to(ROOT))if a.fixture.is_relative_to(ROOT)else str(a.fixture),'sourceFixtureSha256':sha(a.fixture),'sourceFixtureGeneration':'tools/capture_demo_audio_source_native.c: actual AUDIO_ON original house/briefing/scenario loader, no synthetic map','sourceYmSha256':sha(a.ym),'sourceYmBytes':a.ym.stat().st_size,'sourceCaptureBuilderSha256':sha(source_native),'builder':'tools/build_demo_fixture_native.c','builderSha256':sha(native),'driver':'tools/build_demo_fixture.py','driverSha256':sha(Path(__file__))},
 'nativeHelpers':{'buildingCreate':'0x00E584','powerAndStorageRecount':'0x010490','buildingFogReveal':'0x010870','terrainClass':'0x0057EA','initialBankDisplayRefresh':'0x011F38, original forced-refresh mode1'},
 'setup':report,'interiors':menus,
 'rules':['Authored offline preplaced scenario extras only; no cheat function is installed in the browser.','All original enemy buildings, units, AI, victory flags and terrain are retained. New concrete/slabs/wall and buildings are placed by original native routines.','Native scenario-init mode is scoped to offline placement and restored before serialization.','5000credits and its original displayed counter are initial demo values. Native spice capacity and power come from actual buildings.','Host must isolate demo from normal save storage and campaign progress; payload itself contains no host demo flag.','No balance or normal mission is modified; original AI and victory/defeat remain active during the demo.','Genuine AUDIO_ON CPU/Z80/PSG and portable YMFM state are captured together; no reset-chip/midstream-Z80 combination is published.'],
 'coverage':{'nativeInteriors':15,'persistentTypes':'2..18 except unused IX6 and map-feature Wall14','terrainFeatures':[0,1,14],'noInputNativeFrames':1800,'instantWinOrLoss':False,'nativeFaults':0,'audio':audio_proof,'acceptedCityTileListUnchanged':old_manifest is not None},
 'excludedOriginalDefinitions':[{'type':6,'key':'ix','reason':'Unused Sega placeholder: original availableHouseMask0 and explicit Yard skip at$00FF2E..$00FF3A. Has no original interactive interior; no IX is created.'}],
 'limitations':['Original slab/wall placement frees its temporary record: those are native map features, not persistent active building slots.','The original enemy AI remains running; this is a demonstration city, not an endless invulnerable sandbox.','No physical-device or browser validation is claimed by this offline builder.']}
 (a.output/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'path':str(a.web_save),'ymBytes':ym_size,'bytes':len(data),'sha256':sha(state),'power':[report['nativePowerProduction'],report['nativePowerUsage']],'interiors':len(menus)},ensure_ascii=False))
if __name__=='__main__':main()
