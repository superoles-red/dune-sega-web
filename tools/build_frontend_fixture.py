#!/usr/bin/env python3
"""Build a genuine cold-boot Main DSAVv2 payload including portable YMFM.

No world snapshot is used and no original routine is borrowed from gameplay.
"""
import argparse,hashlib,json,shutil,struct,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--rom',type=Path,default=Path('/Users/oleskarpov/Desktop/TEMP на Mac/SEGA/Dune - The Battle for Arrakis (USA).gen'))
 ap.add_argument('--output',type=Path,default=ROOT/'data/frontend')
 ap.add_argument('--evidence',type=Path,default=ROOT/'.local/frontend-fixture')
 ap.add_argument('--web-save',type=Path,default=ROOT/'web/frontend.state.bin')
 a=ap.parse_args();identity=json.loads((ROOT/'docs/source-identity.json').read_text());original=ROOT/'.local/source/build/dune-base.c'
 assert sha(a.rom)==identity['romSha256'];assert sha(original)==identity['generatedSourceSha256']
 shipping=ROOT/'.local/source/build/dune-web.c';s=shipping.read_text();start=s.index('#define DUNE_SAVESTATE_MAGIC ');end=s.index('EMSCRIPTEN_KEEPALIVE int dune_load_state_from_buffer',start)
 inc=ROOT/'.local/frontend-save-serializer.inc';inc.write_text(s[start:end]);assert '#define DUNE_SAVESTATE_VERSION 2' in inc.read_text()
 native=ROOT/'tools/build_frontend_fixture_native.c';backend=ROOT/'.local/source/genesis_recompiler/audio_ymfm.cpp';obj=ROOT/'.local/frontend-native.o';audio_obj=ROOT/'.local/frontend-ymfm.o';binary=ROOT/'.local/build-frontend-fixture'
 subprocess.run(['clang','-std=c11','-O1','-c',str(native),'-o',str(obj)],check=True,cwd=ROOT)
 subprocess.run(['clang++','-std=c++17','-O2','-c',str(backend),'-o',str(audio_obj)],check=True,cwd=ROOT)
 subprocess.run(['clang++',str(obj),str(audio_obj),'-o',str(binary),'-lm'],check=True,cwd=ROOT)
 a.evidence.mkdir(parents=True,exist_ok=True);run=subprocess.run([str(binary),str(a.evidence)],text=True,capture_output=True,cwd=ROOT)
 (a.evidence/'build.log').write_text(run.stdout+run.stderr);print(run.stdout,end='')
 if run.returncode:print(run.stderr,file=sys.stderr,end='');run.check_returncode()
 report=json.loads((a.evidence/'report.json').read_text());payload=a.evidence/'frontend.state.bin';data=payload.read_bytes();magic,version,ym,total=struct.unpack_from('<IIII',data)
 assert(magic,version,total)==(0x56415344,2,len(data));assert ym==report['ymBytes']>0
 assert report['houseId']==-1 and report['housePointer']==0 and report['mapContext']==0 and report['scene']=='main' and report['fault']==0
 assert report['currentVdpRgbMismatchBytes']==0 and report['settledCompletedFrames']>=8 and report['ymClockedStereoParitySamples']==4096
 a.output.mkdir(parents=True,exist_ok=True);a.web_save.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(payload,a.output/'frontend.state.bin');shutil.copyfile(payload,a.web_save)
 sys.path.insert(0,str(ROOT/'tools'));from extract_shop_ui import png
 png(a.evidence/'frontend.png',320,224,(a.evidence/'frontend.rgb').read_bytes(),3)
 manifest={'version':1,'purpose':'Clean original frontend Main payload for leaving a world without borrowing native menu routines from its RAM','source':identity,
 'payload':{'path':'frontend.state.bin','webPath':'frontend.state.bin','magic':'DSAV','version':2,'ymSize':ym,'bytes':len(data),'sha256':sha(payload),'serializer':'Exact current original browser dune_save_state_to_buffer, including the same YMFM backend state','serializerSha256':sha(inc)},
 'capture':report,
 'provenance':{'builder':'tools/build_frontend_fixture_native.c','builderSha256':sha(native),'driver':'tools/build_frontend_fixture.py','driverSha256':sha(Path(__file__)),'backend':'genesis_recompiler/audio_ymfm.cpp','backendSha256':sha(backend),'rawCpuSha256':sha(a.evidence/'frontend.cpu.bin'),'nativeRgbSha256':sha(a.evidence/'frontend.rgb'),'ymStateSha256':sha(a.evidence/'frontend.ym.bin')},
 'rules':['Original cold-reset registers and actual ROM reset vector; exclusively original machine_step until the actual Main input poll.','No world/mission fixture, no scene-PC jump, no RAM invention and no borrowed Main call from world.','At least8 completed native frames after first Main poll; actual completed RGB equals current VDP composition.','Full original Z80/PSG state and portable YMFM bytes are present; normal browser v2 loader restores them and rebases audio sampling.','Native YMFM state is explicitly encoded in fixed-width little-endian primitives, not raw C++ object memory.'],
 'verification':{'ymByteRoundtripIdentical':True,'identicalClockedStereoSamples':4096,'nativeHouseId':-1,'nativeMapContext':0,'browserHotWorldReturn':'Pending separate browser/runtime integration verification; not claimed by this offline builder.'}}
 (a.output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'path':str(a.web_save),'bytes':len(data),'ymBytes':ym,'sha256':sha(payload)},ensure_ascii=False))
if __name__=='__main__':main()
