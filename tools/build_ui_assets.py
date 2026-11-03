#!/usr/bin/env python3
"""Package original UI PNG/JSON kits; optionally copy validated native v2 QA saves.

Only derived web/ui-assets and web/qa-fixtures/buildings are written. Source
data, game code, runtime instructions and native save bytes remain unchanged.
No server, public publishing or raw-CPU runtime loader is involved.
"""
import argparse
import hashlib
import json
import shutil
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GROUPS=('shop-layout-kit','screen-assets','campaign','unit-assets')
def digest(data):return hashlib.sha256(data).hexdigest()
def encode(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def record(path,relative):
    data=path.read_bytes();return {'path':relative,'bytes':len(data),'sha256':digest(data)}
def sync(source,dest,check):
    files={p.relative_to(source) for p in source.rglob('*') if p.is_file()}
    existing={p.relative_to(dest) for p in dest.rglob('*') if p.is_file()} if dest.exists() else set()
    if check:
        if files!=existing:raise SystemExit(f'Packaged file set differs: {dest}')
        for rel in sorted(files):
            if (source/rel).read_bytes()!=(dest/rel).read_bytes():raise SystemExit(f'Packaged bytes differ: {dest/rel}')
        return
    dest.mkdir(parents=True,exist_ok=True)
    for rel in sorted(files):
        (dest/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/rel,dest/rel)
    # The named output group is derived entirely from its canonical source kit.
    for rel in existing-files:(dest/rel).unlink()
    for p in sorted(dest.rglob('*'),reverse=True):
        if p.is_dir() and not any(p.iterdir()):p.rmdir()
def write_or_check(path,data,check):
    if check:
        if not path.is_file() or path.read_bytes()!=data:raise SystemExit(f'Generated manifest differs: {path}')
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
def qa_manifest(directory):
    source=directory/'manifest.json'
    if not source.is_file():raise SystemExit('Run tools/verify_building_ui_fixtures.py first: missing native fixture manifest')
    native=json.loads(source.read_text());entries=[];files={}
    if native.get('coverage',{}).get('fixtures')!=60 or len(native.get('fixtures',[]))!=60:raise SystemExit('Expected the validated 60 native building-UI fixtures')
    for fixture in native['fixtures']:
        name=fixture['browserState'];path=directory/name
        if Path(name).name!=name or not path.is_file():raise SystemExit(f'Invalid browser fixture path: {name}')
        data=path.read_bytes();sha=digest(data)
        if sha!=fixture['sha256']['browserState']:raise SystemExit(f'Native fixture hash differs: {name}')
        if len(data)<16:raise SystemExit(f'Native fixture too short: {name}')
        magic,version,ym,total=struct.unpack_from('<IIII',data)
        if (magic,version)!=(0x56415344,2) or total!=len(data) or ym:raise SystemExit(f'Fixture is not the validated ordinary native v2 format: {name}')
        files[name]=path
        entries.append({k:fixture[k] for k in ('key','house','producerType','producerName','context','menuKind','rows','selectedRaw','previewArmedAtCapture','creditsActual','creditsText','rawGrid')}|{'path':name,'bytes':len(data),'sha256':sha})
    return {'version':1,'purpose':'Local/browser QA only: original v2 save snapshots; no raw CPU loader','nativeSourceManifestSha256':digest(source.read_bytes()),'source':native['source'],'coverage':native['coverage'],'fixturePolicy':native['fixturePolicy'],'hostAdapterSaveBoundary':native['hostAdapterSaveBoundary'],'fixtures':entries},files
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,default=ROOT/'web/ui-assets')
    ap.add_argument('--qa-fixtures',action='store_true',help='Also copy the validated 60 normal v2 building snapshots for browser QA')
    ap.add_argument('--qa-source',type=Path,default=ROOT/'.local/building-ui-fixtures')
    ap.add_argument('--qa-output',type=Path,default=ROOT/'web/qa-fixtures/buildings')
    ap.add_argument('--check',action='store_true',help='Read-only byte/hash check of an existing package')
    a=ap.parse_args();groups={};all_files=[]
    for name in GROUPS:
        source=ROOT/'data'/name;manifest_path=source/'manifest.json'
        if not manifest_path.is_file():raise SystemExit(f'Missing canonical UI manifest: {manifest_path}')
        native=json.loads(manifest_path.read_text());entries=[record(p,str(Path(name)/p.relative_to(source))) for p in sorted(source.rglob('*')) if p.is_file()]
        pngs=[e for e in entries if e['path'].endswith('.png')]
        groups[name]={'source':f'data/{name}','manifest':f'{name}/manifest.json','manifestSha256':digest(manifest_path.read_bytes()),'files':len(entries),'bytes':sum(e['bytes'] for e in entries),'pngFiles':len(pngs),'pngBytes':sum(e['bytes'] for e in pngs),'coverage':native.get('coverage') or {'parts':len(native.get('parts',{})),'modules':len(native.get('modules',{})),'fonts':len(native.get('fonts',{})),'animations':len(native.get('animations',{})),'totalScenarioCount':native.get('totalScenarioCount')},'nativeSource':native.get('source')}
        sync(source,a.output/name,a.check);all_files.extend(entries)
    output={'version':1,'purpose':'Original native art and campaign metadata for the local adaptive interface','policy':'UI composition only. Original instructions and live menu frame own focus phase, prices, stock, availability and all actions.','groups':groups,'coverage':{'groups':len(groups),'files':len(all_files),'pngFiles':sum(g['pngFiles'] for g in groups.values()),'bytes':sum(g['bytes'] for g in groups.values())},'contentSha256':digest(encode(all_files)),'files':all_files}
    write_or_check(a.output/'manifest.json',encode(output),a.check)
    qa_count=0
    if a.qa_fixtures:
        qa,states=qa_manifest(a.qa_source);a.qa_output.mkdir(parents=True,exist_ok=True) if not a.check else None
        for name,path in states.items():
            target=a.qa_output/name
            if a.check:
                if not target.is_file() or target.read_bytes()!=path.read_bytes():raise SystemExit(f'Packaged QA snapshot differs: {target}')
            else:shutil.copyfile(path,target)
        if not a.check:
            for stale in a.qa_output.glob('*.state.bin'):
                if stale.name not in states:stale.unlink()
        write_or_check(a.qa_output/'manifest.json',encode(qa),a.check);qa_count=len(states)
    print(json.dumps({'pass':True,'mode':'check' if a.check else 'build','ui':output['coverage'],'contentSha256':output['contentSha256'],'qaBuildingSnapshots':qa_count},ensure_ascii=False))
if __name__=='__main__':main()
