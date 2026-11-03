#!/usr/bin/env python3
"""Original Sega USA unit shop icons/monitor images, including genuine absences.

Static resource extraction complements the live native-frame bridge. It does
not replace house/state-dependent pixels with approximations.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,tempfile
from extract_building_assets import png,format80,palette,icon_pixels,illustration_pixels,u16,u32,ROM_SHA256
ROOT=Path(__file__).resolve().parents[1]
KEYS=['carryall','ornithopter','infantry','troopers','soldier','trooper','saboteur','launcher','deviator','tank','siege-tank','devastator','sonic-tank','trike','raider-trike','quad','harvester','mcv','death-hand','rocket','turret-rocket','deviator-rocket','mini-rocket','bullet','sonic-blast','sandworm','frigate']
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('rom',type=Path);ap.add_argument('--output',type=Path,default=ROOT/'data/unit-assets');ap.add_argument('--native-helper',type=Path);a=ap.parse_args()
    rom=a.rom.read_bytes()
    if sha(rom)!=ROM_SHA256:raise SystemExit('Exact original Sega USA ROM required')
    out=a.output;out.mkdir(parents=True,exist_ok=True);lane1_words,lane1=palette(rom,0xa6c98+32);lane3_words,lane3=palette(rom,0xa6c98+96)
    manifest={'version':1,'source':{'game':'Dune — The Battle for Arrakis, Sega Genesis USA','romSha256':ROM_SHA256,'unitDefinitionTable':'0x06c5bc','iconPointerTable':'0x070ca4','portraitPointerTable':'0x08f1d0','nativeConsumers':['0x00827a','0x008306','0x008fec','0x00905e']},'pixelPolicy':'Original 4bpp patterns, mappings/flips and CRAM colors; no painted/generated replacements. Live RGB frames remain authoritative for selected/state/house palettes.','palettes':{'lane1':{'romOffset':0xa6c98+32,'cramWords':lane1_words,'rgb8':[list(c) for c in lane1]},'lane3':{'romOffset':0xa6c98+96,'cramWords':lane3_words,'rgb8':[list(c) for c in lane3]}},'units':[],'commands':[],'validation':{'nativeLcwCompared':False}}
    banks={};icon_count=portrait_count=0
    for ident,key in enumerate(KEYS):
        definition=u32(rom,0x6c5bc+ident*4);name_at=u32(rom,definition+2);name=rom[name_at:rom.index(0,name_at)].decode('ascii').strip()
        icon_at=u32(rom,0x70ca4+ident*4);record=u32(rom,0x8f1d0+ident*4)
        entry={'id':ident,'key':key,'name':name,'definitionRomOffset':definition,'icons':[],'portraits':[],'iconVariants':{},'nativeRole':'ordinary-production-or-starport' if ident<18 and ident!=6 else 'palace-special' if ident==6 else 'palace-projectile' if ident==18 else 'projectile-effect' if ident<25 else 'sandworm-non-shop' if ident==25 else 'frigate-delivery-non-shop','cost':u16(rom,definition+22),'hp':u16(rom,definition+16),'damage':u16(rom,definition+84),'range':u16(rom,definition+82),'iconSource':{'romOffset':icon_at,'rawPatternBytes':384,'width':32,'height':24,'nativeTransparency':'4bpp nibble0 transparent'},'portraitSource':{'recordRomOffset':record,'width':96,'height':56}}
        if icon_at:
            raw=rom[icon_at:icon_at+384];path=f'icons/{ident:02d}-{key}.png';colors=lane1 if ident==12 else lane3
            png(out/path,32,24,icon_pixels(raw,colors));entry['icons'].append(path);entry['iconVariants']['production']=path;entry['iconSource']['sha256']=sha((out/path).read_bytes());entry['iconSource']['paletteLane']=1 if ident==12 else 3;icon_count+=1
            if ident==12:
                starport=f'icons/{ident:02d}-{key}-starport.png';png(out/starport,32,24,icon_pixels(raw,lane3));entry['icons'].append(starport);entry['iconVariants']['starport']=starport;icon_count+=1
                entry['iconSource']['paletteNote']='Native production renderer forces Sonic Tank12 to palette lane1, while Starport uses lane3. Production lane1 can change with the currently selected monitor image; the live native-frame bridge preserves that exact state.'
            else:entry['iconVariants']['starport']=path
        else:entry['iconSource']['absence']='Original icon pointer is zero. No replacement icon has been invented.'
        if record and record!=0x95cd8:
            patterns,compressed_bytes=format80(rom,record+202);banks[ident]=patterns;pwords,pcolors=palette(rom,record);mapping=[u16(rom,record+32+i*2) for i in range(84)]
            path=f'portraits/{ident:02d}-{key}.png';png(out/path,96,56,illustration_pixels(patterns,mapping,pcolors),3);entry['portraits'].append(path);portrait_count+=1
            entry['portraitSource'].update({'paletteRomOffset':record,'cramWords':pwords,'rgb8':[list(c) for c in pcolors],'tilemapRomOffset':record+32,'tilemapWords':mapping,'compressedRomOffset':record+202,'compressedBytes':compressed_bytes,'decodedPatternBytes':len(patterns),'nativeUploadBytes':u16(rom,record+200),'patternsSha256':sha(patterns),'sha256':sha((out/path).read_bytes()),'animation':'One static native monitor resource; console and frame effects are separate.'})
            if u16(rom,record+200)!=len(patterns):entry['portraitSource']['nativeLengthQuirk']='The complete LCW resource is longer than the native declared upload length. This PNG preserves the complete decoded resource; the live native frame preserves any state-dependent prior VRAM bytes.'
            if ident==12:
                selected=f'icons/{ident:02d}-{key}-selected-palette.png';png(out/selected,32,24,icon_pixels(rom[icon_at:icon_at+384],pcolors));entry['icons'].append(selected);entry['iconVariants']['productionSelectedOwnPortraitPalette']=selected;icon_count+=1
        else:entry['portraitSource']['absence']='Original pointer is the non-picture dummy record0x95CD8 (or zero). No per-unit monitor illustration exists in this native table; use the original live UI fallback rather than a fabricated image.'
        manifest['units'].append(entry)
    # Native table also contains a production Upgrade icon and the Starport
    # command variants. Keep their roles distinct from unit definitions.
    command_keys={27:'upgrade-production',28:'exit-starport',29:'fix-starport',30:'stop-starport',31:'fix-disabled-starport',32:'stop-disabled-starport'}
    for raw,key in command_keys.items():
        ip=u32(rom,0x70ca4+raw*4);path=f'commands/{raw:02d}-{key}.png';png(out/path,32,24,icon_pixels(rom[ip:ip+384],lane3));manifest['commands'].append({'raw':raw,'key':key,'path':path,'width':32,'height':24,'romOffset':ip,'palette':'lane3','sha256':sha((out/path).read_bytes())});icon_count+=1
    if a.native_helper:
        with tempfile.TemporaryDirectory(prefix='dune-unit-native-') as temp:
            run=subprocess.run([str(a.native_helper.resolve()),temp],capture_output=True,text=True,check=True);comparisons=[]
            for ident,patterns in banks.items():
                native=(Path(temp)/f'unit-{ident:02d}.patterns.bin').read_bytes()
                if native!=patterns:raise SystemExit(f'Original native LCW mismatch for unit{ident}')
                comparisons.append({'id':ident,'bytes':len(native),'sha256':sha(native),'matches':True})
            manifest['validation']={'nativeLcwCompared':True,'decoderAddress':'0x000c32','comparisons':comparisons};print(run.stdout,end='')
    manifest['coverage']={'unitDefinitions':27,'nativeUnitIconPointersPresent':sum(bool(u['icons']) for u in manifest['units']),'nativeMonitorResourcesPresent':portrait_count,'allOrdinaryUnitShopIconIds':[i for i in range(18)],'ordinaryShopPortraitIds':[i for i in range(18) if i!=6],'iconsWithNoNativePointer':[u['id'] for u in manifest['units'] if not u['icons']],'portraitsWithNoNativeResource':[u['id'] for u in manifest['units'] if not u['portraits']],'livePixelsRequired':'Focus frame/blink phase, counts, sold-out state, current selected palette and every house/state-dependent menu detail come from the live original 320x224 RGB frame.'}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (out/'README.md').write_text('''# Original Sega USA unit shop art

All 27 native unit definitions are inventoried. Every nonzero original unit icon
pointer is exported at32×24, plus the original Upgrade and Starport command
icons. All17 genuine unit monitor-picture resources are exported at96×56.
The remaining monitor pointers reference a non-picture dummy record; missing
images and zero icon pointers remain explicitly absent, never replaced.

Ordinary production/Starport shop portraits cover unit IDs0..17 except Saboteur6,
which is a Palace special rather than a normal shop purchase. Death Hand and
projectile/delivery/non-shop definitions are still inventoried accurately.

Icons use source nibble-zero transparency, original tile ordering and CRAM.
Production Sonic Tank12 is forced to palette lane1; Starport uses lane3. Its
base production, own-selected-portrait and Starport palette variants are separate.
The live native-frame bridge remains authoritative for exact changing palettes,
red focus, counts, unavailable states, lights and animations.

Reproduce:

```sh
clang -std=c11 -O1 tools/extract_unit_assets_native.c -o .local/extract-unit-assets-native -lm
python3 tools/extract_unit_assets.py '/path/to/Dune - The Battle for Arrakis (USA).gen' --native-helper .local/extract-unit-assets-native
```

The Python exporter uses only the standard library plus the local original
building-asset decoder module. Optional native validation compares every
decompressed byte against original offline routine$0C32. No ROM/gameplay/runtime
code or original assets are modified.
''')
    print(json.dumps({'unitDefinitions':27,'unitMonitorImages':portrait_count,'pngFiles':len(list(out.rglob('*.png'))),'pngBytes':sum(p.stat().st_size for p in out.rglob('*.png')),'nativeLcwCompared':manifest['validation']['nativeLcwCompared'],'output':str(out)},ensure_ascii=False))
if __name__=='__main__':main()
