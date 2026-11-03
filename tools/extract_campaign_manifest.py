#!/usr/bin/env python3
"""Decode the supported USA campaign selectors, passwords and scenario definitions.
No DOS campaign graph, ROM mutation or inferred balance. Native ROM dispatchers:
$21902/$88124 passwords, $1609C scenario lookup, $25FA8/$96050 fixed territories.
"""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HASH='b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba'

def decode_scenario(rom,start):
 p=start;settings={};houses=[];units=[];buildings=[]
 def word():
  nonlocal p
  n=int.from_bytes(rom[p:p+2],'big');p+=2;return n
 fields=['loseMovie','winMovie','briefMovie','timeout','mapScale','cursorPacked','tacticalPacked','winFlags','finishFlags']
 while True:
  tag=word()
  if tag==65535:break
  kind,sub=tag>>8,tag&255
  if kind==0:
   if sub<3:
    n=word();value=rom[p:p+n].split(b'\0')[0].decode('ascii');p+=n
   else:value=word()
   settings[fields[sub]]=value
  elif kind==1:
   if sub in (66,70):
    n=word()
    for _ in range(n):word()
   else:assert sub==83;settings['mapSeed']=word()
  elif kind in (2,3,4,5):
   h={'houseId':{2:0,3:1,4:2,5:4}[kind]};field=sub
   for i in range(4):
    h[{66:'brain',67:'credits',77:'maxUnits',81:'quota'}[field]]=word()
    if i<3:field=word()&255
   houses.append(h)
  elif kind==6:word()
  elif kind==7:
   for _ in range(5):word()
  elif kind==8:units.append([word()for _ in range(6)])
  elif kind==9:buildings.append([word()for _ in range(3 if sub==71 else 5)])
  elif kind==10:
   for _ in range(4):word()
  else:raise ValueError((hex(p-2),kind,sub))
 return {'romOffset':start,'bytes':p-start,'sha256':hashlib.sha256(rom[start:p]).hexdigest(),'settings':settings,'houses':houses,'unitDefinitionCount':len(units),'buildingDefinitionCount':len(buildings)}

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('rom',type=Path);ap.add_argument('--output',type=Path,default=ROOT/'data/campaign/manifest.json');a=ap.parse_args()
 rom=a.rom.read_bytes();assert len(rom)==1048576 and hashlib.sha256(rom).hexdigest()==HASH
 word=lambda at:int.from_bytes(rom[at:at+2],'big');long=lambda at:int.from_bytes(rom[at:at+4],'big')
 string=lambda at:rom[at:rom.index(0,at)].decode('ascii')
 passwords={};cheats=[]
 for at in range(0x88124,0x8820d,8):
  pointer=long(at)
  if not pointer:break
  h,m=word(at+4),word(at+6);record={'text':string(pointer),'romOffset':pointer,'tableEntry':at,'houseId':h,'mission':m}
  if h<3 and 2<=m<=9:passwords[h,m]=record
  else:cheats.append(record)
 assert len(passwords)==24
 scenarios={}
 for at in range(0x52c34,0x52dcc,8):
  name,pointer=long(at),long(at+4)
  if not name:break
  name=string(name)
  if name.startswith('SCEN'):
   scenarios[name]=decode_scenario(rom,pointer)
 # The file index continues beyond its string block; scan by terminator.
 at=0x52c34
 while long(at):
  name,pointer=string(long(at)),long(at+4)
  if name.startswith('SCEN'):scenarios[name]=decode_scenario(rom,pointer)
  at+=8
 assert len(scenarios)==27
 houses=[]
 for h,key,letter in [(0,'harkonnen','H'),(1,'atreides','A'),(2,'ordos','O')]:
  native_name=string(long(0x6c75a+h*30));region_base=long(0x96050+h*4);brief_base=long(0x87f38+h*4);missions=[]
  for m in range(1,10):
   fname=f'SCEN{letter}{m:03}.INI';scenario=scenarios[fname];human=next(x for x in scenario['houses']if x['brain']==72);assert human['houseId']==h
   record={'mission':m,'campaignIndex':m-1,'name':passwords[h,m]['text']if m>1 else'Mission 1','nameSource':'native canonical password'if m>1 else'UI ordinal: no native password exists for first mission','password':passwords.get((h,m)),'sourceFile':fname,'region':word(region_base+(m-1)*8+6),'regionTableEntry':region_base+(m-1)*8,'briefingTextPointers':{k:long(brief_base+(m-1)*16+i*4)for i,k in enumerate(['briefing','victory','defeat','hints'])},'scenario':scenario,'initialPlayer':human}
   record['texts']={k:{'text':string(pointer),'romOffset':pointer,'sha256':hashlib.sha256(rom[pointer:rom.index(0,pointer)]).hexdigest(),'encoding':'literal original ASCII, NUL terminated; no translation or rewritten punctuation'}for k,pointer in record['briefingTextPointers'].items()}
   missions.append(record)
  intro=long(0x87d7c+h*4)
  houses.append({'id':h,'key':key,'name':native_name,'introText':{'romOffset':intro,'text':string(intro),'encoding':'literal original ASCII, NUL terminated'},'nameRomPointerEntry':0x6c75a+h*30,'missionCount':9,'missions':missions})
 options={}
 for kind,table in [('musicTest',0x87f44),('soundTest',0x87fdc)]:
  values=[]
  for i in range(128):
   ptr=long(table+i*8)
   if not ptr:break
   values.append({'index':i,'text':string(ptr),'romOffset':ptr,'nativeId':long(table+i*8+4)})
  options[kind]={'table':table,'values':values}
 manifest={'schemaVersion':1,'originalGeneratedSourceSha256':json.loads((ROOT/'docs/source-identity.json').read_text())['generatedSourceSha256'],'nativeOptions':options,'romSha256':HASH,'source':'Original Sega Genesis USA ROM; no DOS campaign data','houses':houses,'missionCountPerHouse':9,'totalScenarioCount':27,'passwordTable':0x88124,'excludedCheats':cheats,'regionChoice':False,'regionEvidence':{'table':0x96050,'consumer':'$25FA8..25FC2 maps (house,mission) to one fixed territory identifier; $264F8 calls one canonical scenario, no branch variant argument','briefingChoice':'Native PROCEED/ADVICE selects mission instructions or original hints, not a different scenario/map. No DOS region graph is substituted.'},'nativeFlow':{'safeMainLoopCheckpoint':0x1253e,'nativeNewHouseStateAddress':0xffc14c,'nativeNewHouseStateValue':2,'housePicker':0x26b8a,'passwordValidator':0x21902,'missionStartWithBriefing':0x264f8,'scenarioLoader':0x26540,'scenarioParser':0x1609c,'victoryCondition':0x22a2c,'scenarioFinishedCondition':0x229b8,'victoryEdge':0x22afc,'defeatEdge':0x22bde,'missionIncrementAfterResults':0x22b94,'endingAfterNinthVictory':0x12734,'credits':0x117b8},'progressContract':{'owner':'Browser storage managed separately by host','unlock':'Only one verified original victory edge for an armed played mission; boot, loading, scene changes, password validation and defeat never unlock','replay':'Host may request any previously unlocked mission; original loader creates its scenario state. Browser save slot is not erased by this adapter.','missionOne':'No invented password. Uses ordinary native new-house flow.'},'limitations':['Native start regression covers all27 scenario starts; it is not a full campaign playthrough.','Mission outcome fixtures may deliberately satisfy native win/lose conditions offline; they do not claim user-earned completion.','ROM and translated instruction bytes remain unchanged; only native menu intent and campaign selector entry points are adapted.']}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(f'Wrote {a.output}:3houses,27scenarios,24passwords,9fixedterritories/house')
if __name__=='__main__':main()
