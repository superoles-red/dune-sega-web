#!/usr/bin/env python3
"""Convert captured original campaign scenes to the existing browser v2 schema.

Outcome captures are explicitly controlled offline-condition fixtures, not
earned campaign completions. This converter never edits CPU/native save bytes.
"""
import argparse,hashlib,json,re,struct,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source',type=Path,default=ROOT/'.local/campaign-scenes')
    ap.add_argument('--output',type=Path,default=ROOT/'web/qa-fixtures/scenes')
    ap.add_argument('--converter',type=Path,default=ROOT/'.local/export-save')
    a=ap.parse_args();a.output.mkdir(parents=True,exist_ok=True);entries=[]
    for raw in sorted(a.source.glob('*.cpu.bin')):
        key=raw.name[:-8];report=raw.with_name(key+'.json')
        if not report.is_file():continue # No guessed scene metadata.
        d=json.loads(report.read_text());assert not d.get('fault'),(key,'native fault')
        state=a.output/(key+'.state.bin');temporary=state.with_name(state.name+'.tmp')
        subprocess.run([str(a.converter),str(raw),str(temporary)],capture_output=True,text=True,check=True)
        data=temporary.read_bytes();magic,version,ym,total=struct.unpack_from('<IIII',data)
        assert (magic,version,total,ym)==(0x56415344,2,len(data),0)
        if state.is_file()and state.read_bytes()==data:temporary.unlink()
        else:temporary.replace(state)
        outcome=bool(re.search(r'(victory|defeat|ending|credits|next-password)',key))
        before=bool(re.search(r'-pre-(victory|defeat)$',key))
        policy='controlled-native-outcome' if outcome else 'original-native-menu-flow'
        note=('Original outcome screen reached after deliberately satisfying native win/lose conditions offline. Not user-earned completion or evidence of full playthrough. No force-win API is installed in the browser.' if outcome else 'Captured from the original NewHouse/house-confirm/briefing flow; no synthetic scene artwork or guessed scene state.')
        capture_source='tools/capture_campaign_scenes.c'
        if before:
            assert d.get('outcome')=='none' and d.get('outcomeSeq')==0,(key,'native outcome must not have occurred')
            assert d.get('activeRunArmed')==1 and d.get('mapContext')==1,(key,'genuine armed native map')
            assert d.get('pc')==0x22ab2 and d.get('nativeOutcomeEdgeReached')is False,(key,'before original native predicates')
            assert d.get('controlledOutcomeFixture')is True and d.get('intendedOutcome')in ('victory','defeat'),(key,'controlled fixture provenance')
            policy='controlled-before-native-outcome'
            note='Controlled offline quota/Building_Free fixture. Original scheduler naturally reached PC$22AB2 before scenarioFinished/victoryCondition; outcome sequence is still0. After loading, original instructions execute the intended outcome. This is a QA progress-path test, not earned campaign completion. No runtime force-win API or predicate-result patch is installed.'
            capture_source='tools/capture_campaign_before_outcome.c'
        house=d.get('houseId');house=house if isinstance(house,int) and 0<=house<=2 else None
        entry={'key':key,'path':state.name,'scene':d.get('scene'),'house':house,'houseName':d.get('house'),'mission':d.get('mission'),'inputKind':d.get('inputKind'),'capturePc':d.get('pc'),'nativePollSource':d.get('nativePollSource'),'capturePendingRequest':bool(d.get('pending')),'captureRequestStage':d.get('requestStage'),'capturedOutcome':d.get('outcome'),'fixtureKind':policy,'controlledConditions':outcome,'label':key+(' [controlled conditions; not earned win]' if outcome else ' [original native flow]'),'provenance':note,'bytes':len(data),'sha256':sha(state),'sourceRawCpuSha256':sha(raw),'sourceReportSha256':sha(report)}
        entry.update({'captureSource':capture_source,'captureSourceSha256':sha(ROOT/capture_source),'capturedOutcomeSeq':d.get('outcomeSeq'),'beforeNativeOutcome':before})
        if before:
            entry.update({'intendedOutcome':d['intendedOutcome'],'nativeOutcomeEdgeReachedAtCapture':False,'nativePredicateEntry':d['nativePredicateEntry'],'label':key+' [BEFORE native '+d['intendedOutcome']+' edge; controlled, not earned]'})
        rgb=raw.with_name(key+'.rgb')
        if rgb.is_file():entry['sourceNativeRgbSha256']=sha(rgb)
        entries.append(entry)
    if not entries:raise SystemExit('No paired genuine native scene captures found')
    identity=json.loads((ROOT/'docs/source-identity.json').read_text())
    manifest={'version':1,'purpose':'Local QA only: genuine original scene snapshots, serialized through the existing original browser v2 save format','source':identity,'captureSource':'tools/capture_campaign_scenes.c','captureSourceSha256':sha(ROOT/'tools/capture_campaign_scenes.c'),'converterSha256':sha(a.converter),'policy':'No raw CPU loader, no RAM writes and no force-win command. Controlled outcome conditions belong to the offline capture process and are labelled per fixture. Loading captures does not claim a played/earned victory. Before-outcome fixtures may exercise a real native outcome/progress edge after load; use only the isolated sessionStorage QA mode.','hostStateBoundary':'Only the native machine is serialized. The campaign observer must reconstruct scene/input information after load; transient capture-time campaign request state and preview arming are not serialized.','coverage':{'fixtures':len(entries),'originalNativeFlow':sum(not e['controlledConditions']for e in entries),'controlledOutcomeScenes':sum(e['controlledConditions']and not e['beforeNativeOutcome']for e in entries),'controlledBeforeNativeOutcome':sum(e['beforeNativeOutcome']for e in entries),'scenes':sorted({e['scene']for e in entries if e['scene']})},'fixtures':entries}
    temporary=a.output/'manifest.json.tmp';temporary.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');temporary.replace(a.output/'manifest.json')
    print(json.dumps({'pass':True,**manifest['coverage'],'bytes':sum(e['bytes']for e in entries)},ensure_ascii=False))
if __name__=='__main__':main()
