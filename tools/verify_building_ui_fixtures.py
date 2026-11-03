#!/usr/bin/env python3
"""Validate native building-UI fixtures and export existing v2 browser snapshots.

The native producer runs the original instructions. JSON is observation only;
this script never edits fixture RAM, native menu cells, prices or save bytes.
"""
import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TYPES={2,3,4,5,7,8,9,10,11,12,13,15,16,17,18}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def checked(path,what):
    if not path.is_file():raise SystemExit(f'Missing {what}: {path}')
    return path
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--fixtures',type=Path,default=ROOT/'.local/building-ui-fixtures')
    ap.add_argument('--campaign',type=Path,default=ROOT/'.local/campaign-fixtures')
    ap.add_argument('--converter',type=Path,default=ROOT/'.local/export-save')
    ap.add_argument('--native-test',type=Path,default=ROOT/'.local/test-building-ui')
    ap.add_argument('--run',action='store_true',help='Run the compiled native regression before validating')
    a=ap.parse_args();a.fixtures.mkdir(parents=True,exist_ok=True)
    identity=json.loads((ROOT/'docs/source-identity.json').read_text())
    source=checked(ROOT/'.local/source/build/dune-base.c','pinned original translated source')
    if sha(source)!=identity['generatedSourceSha256']:raise SystemExit('Pinned original source hash differs')
    if a.run:subprocess.run([str(checked(a.native_test,'compiled native UI regression')),str(a.campaign),str(a.fixtures)],check=True)
    checked(a.converter,'existing native CPU to browser-v2 snapshot converter')
    fixtures=[];coverage={house:set() for house in range(3)}
    for path in sorted(a.fixtures.glob('house*.json')):
        if 'debug' in path.stem:continue
        d=json.loads(path.read_text());house=d['playerHouse'];producer=d['producer'];cells=d['cells']
        assert d['active'] and d['context'] in (2,3),(path,'active native menu')
        assert d['rows']==(4 if d['context']==3 else 6) and d['columns']==3
        assert len(cells)==d['rows']*3 and len(d['paletteCram'])==64
        assert house in coverage and producer['house']==house
        assert d['frame']['ready'] and d['frame']['width']==320 and d['frame']['height']==224
        assert len(path.read_bytes())<32768
        if '-building' in path.stem:coverage[house].add(producer['type'])
        for index,cell in enumerate(cells):
            assert (cell['index'],cell['row'],cell['col'])==(index,index//3,index%3)
            assert cell['sourceRect']=={'x':32+32*(index%3),'y':48+24*(index//3),'w':32,'h':24}
            assert cell['clickable']==(cell['kind']!='empty')
            if cell['kind']=='empty':assert not cell['visible']
            if d['context']==3 and cell['kind']=='unit':
                assert cell['costSource'] in ('native-starport-record+4','native-starport-record-not-ready')
                if cell['costSource'].endswith('not-ready'):assert cell['cost'] is None
        assert d['creditsGlyphRect']=={'x':248,'y':16,'w':48,'h':8}
        assert len(d['creditsText'])<=6
        raw=checked(path.with_suffix('.cpu.bin'),'raw native CPU fixture')
        rgb=checked(path.with_suffix('.rgb'),'completed original VDP RGB frame')
        assert rgb.stat().st_size==320*224*3
        state=path.with_suffix('.state.bin')
        subprocess.run([str(a.converter),str(raw),str(state)],check=True,capture_output=True,text=True)
        magic,version,ym_size,total=struct.unpack_from('<IIII',state.read_bytes())
        assert (magic,version)==(0x56415344,2) and total==state.stat().st_size and not ym_size
        fixtures.append({'key':path.stem,'house':house,'producerType':producer['type'],'producerName':producer['name'],'context':d['context'],'menuKind':d['menuKind'],'rows':d['rows'],'selectedRaw':d['selectedRaw'],'previewArmedAtCapture':d['previewArmed'],'creditsActual':d['creditsActual'],'creditsText':d['creditsText'],'rawGrid':[c['raw'] for c in cells],'json':path.name,'nativeRgb':rgb.name,'rawCpu':raw.name,'browserState':state.name,'sha256':{'json':sha(path),'rgb':sha(rgb),'rawCpu':sha(raw),'browserState':sha(state)}})
    for house,types in coverage.items():assert types==TYPES,(house,'missing native enterable producer types',TYPES-types)
    manifest={'version':1,'source':identity,'testSource':'tools/test_em_web_building_ui.c','readOnlyBridge':'tools/em_web_building_ui.h','converter':{'path':str(a.converter),'sha256':sha(a.converter),'format':'existing original browser v2 save schema; no raw-CPU runtime loader'},'fixturePolicy':'All houses start from authentic original mission09 campaign snapshots; extra producer buildings are authored offline through original Building_Create in scenario-init placement mode. Paid Windtrap uses mission01, Upgrade and repair use mission02. Controlled damage is confined to offline repair fixtures. No runtime prices/stock/tech/menu grids are changed.','hostAdapterSaveBoundary':'Native v2 snapshots serialize the original machine, not transient host pointer/preview adapter state. Preview fixtures preserve native selected pixels and catalogue; a browser load clears preview arming and requires a new first tap. JSON previewArmedAtCapture describes the original native regression capture.','coverage':{'houses':3,'enterableProducerTypes':sorted(TYPES),'fixtures':len(fixtures)},'fixtures':fixtures}
    (a.fixtures/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'pass':True,'fixtures':len(fixtures),'browserV2Snapshots':len(fixtures),'output':str(a.fixtures)},ensure_ascii=False))
if __name__=='__main__':main()
