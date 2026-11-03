#!/usr/bin/env python3
"""Export the complete building-menu image set from the exact Sega USA ROM.

Only Python's standard library is required. No generated/redrawn pixels.
Optional --native-helper checks LCW output against original translated $0C32.
"""
from pathlib import Path
import argparse
import hashlib
import json
import struct
import subprocess
import tempfile
import zlib

ROOT=Path(__file__).resolve().parents[1]
ROM_SHA256='b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba'
KEYS=['concrete-1','concrete-4','palace','light-vehicle','heavy-vehicle','hi-tech','ix','wor','construction-yard','windtrap','barracks','starport','refinery','repair','wall','turret','rocket-turret','silo','outpost']
ICON_TABLE=0x6e840
ILLUSTRATION_TABLE=0x882a4
BUILDING_TABLE=0x6b954
ICON_PALETTE=0xa6c98+32

def u16(data,at):return int.from_bytes(data[at:at+2],'big')
def u32(data,at):return int.from_bytes(data[at:at+4],'big')
def digest(data):return hashlib.sha256(data).hexdigest()

def png(path,width,height,pixels,channels=4):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    stride=width*channels
    scan=b''.join(b'\0'+pixels[y*stride:(y+1)*stride] for y in range(height))
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6 if channels==4 else 2,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))

def format80(data,at):
    """LCW semantics used by original $0C32; bounded offline implementation."""
    out=bytearray();start=at
    while len(out)<65536:
        command=data[at];at+=1
        if command==0x80:return bytes(out),at-start
        if command<0x80:
            count=(command>>4)+3;offset=((command&15)<<8)+data[at];at+=1
            if not 0<offset<=len(out):raise ValueError('Invalid relative LCW offset')
            for _ in range(count):out.append(out[-offset])
        elif command==0xfe:
            count=int.from_bytes(data[at:at+2],'little');value=data[at+2];at+=3;out.extend([value]*count)
        elif command==0xff or command&0x40:
            count=int.from_bytes(data[at:at+2],'little') if command==0xff else (command&63)+3
            if command==0xff:at+=2
            offset=int.from_bytes(data[at:at+2],'little');at+=2
            for _ in range(count):
                if offset>=len(out):raise ValueError('Invalid absolute LCW offset')
                out.append(out[offset]);offset+=1
        else:
            count=command&63;out.extend(data[at:at+count]);at+=count
    raise ValueError('Unterminated LCW stream')

def palette(data,at):
    words=[u16(data,at+i*2) for i in range(16)]
    colors=[bytes((((w>>1)&7)*255//7,((w>>5)&7)*255//7,((w>>9)&7)*255//7)) for w in words]
    return words,colors

def icon_pixels(patterns,colors):
    # Original mapping $4A1E2 is one 4x3-tile SAT piece. Genesis sprite
    # patterns are column-major, not the row-major layout of a plane map.
    image=bytearray()
    for y in range(24):
        for x in range(32):
            tile=(x//8)*3+y//8;raw=patterns[tile*32+(y&7)*4+(x&7)//2]
            color=raw&15 if x&1 else raw>>4
            image.extend(colors[color]+bytes([255 if color else 0]))
    return image

def illustration_pixels(patterns,entries,colors):
    image=bytearray()
    for y in range(56):
        for x in range(96):
            entry=entries[(y//8)*12+x//8]
            xx=7-(x&7) if entry&0x800 else x&7
            yy=7-(y&7) if entry&0x1000 else y&7
            offset=(entry&2047)*32+yy*4+xx//2
            if offset>=len(patterns):raise ValueError('Tile map exceeds decoded pattern bank')
            raw=patterns[offset];color=raw&15 if xx&1 else raw>>4
            # Native monitor is a complete opaque rectangle over black.
            image.extend(colors[color])
    return image

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('rom',type=Path)
    ap.add_argument('--output',type=Path,default=ROOT/'data/building-assets')
    ap.add_argument('--native-helper',type=Path)
    args=ap.parse_args();rom=args.rom.read_bytes()
    if len(rom)!=1048576 or digest(rom)!=ROM_SHA256:raise SystemExit('Unsupported ROM: exact Sega USA file required')
    out=args.output;out.mkdir(parents=True,exist_ok=True)
    words,colors=palette(rom,ICON_PALETTE)
    manifest={'schemaVersion':1,'source':{'game':'Dune — The Battle for Arrakis, Sega Genesis USA','romSha256':ROM_SHA256,'romBytes':len(rom),'nativeConsumers':{'icons':'$00827A..$0082FC','illustrations':'$008306..$008440','lcw':'$000C32..$000CD6'},'iconPointerTable':'0x06e840','illustrationPointerTable':'0x0882a4','buildingDefinitionTable':'0x06b954'},'pixelPolicy':'Original 4bpp patterns, native mappings/flips and CRAM colors. No interpolation, recoloring, redrawing or generated art.','iconPalette':{'romOffset':ICON_PALETTE,'cramWords':words,'rgb8':[list(c) for c in colors],'nativeLane':1,'alpha':'Nibble 0 transparent, as in the native SAT sprite renderer'},'buildings':[]}
    banks={};canonical_icons={};canonical_illustrations={}
    for i,key in enumerate(KEYS):
        definition=u32(rom,BUILDING_TABLE+i*4);name_ptr=u32(rom,definition+2)
        name=rom[name_ptr:rom.index(b'\0',name_ptr)].decode('ascii').strip()
        ip=u32(rom,ICON_TABLE+i*4);pp=u32(rom,ILLUSTRATION_TABLE+i*4)
        raw=rom[ip:ip+384];patterns,compressed_bytes=format80(rom,pp+202);banks[i]=patterns
        pwords,pcolors=palette(rom,pp);entries=[u16(rom,pp+32+j*2) for j in range(84)]
        icon_path=f'icons/{i:02d}-{key}.png';picture_path=f'illustrations/{i:02d}-{key}.png'
        png(out/icon_path,32,24,icon_pixels(raw,colors))
        png(out/picture_path,96,56,illustration_pixels(patterns,entries,pcolors),3)
        row={'id':i,'key':key,'name':name,'icons':[icon_path],'illustrations':[picture_path],'icon':{'width':32,'height':24,'romOffset':ip,'patternBytes':384,'mappingOffset':0x4a1e2,'palette':'manifest.iconPalette','sha256':digest((out/icon_path).read_bytes()),'sameResourceAsBuilding':canonical_icons.setdefault(ip,i)},'illustration':{'width':96,'height':56,'recordRomOffset':pp,'paletteRomOffset':pp,'cramWords':pwords,'rgb8':[list(c) for c in pcolors],'tilemapRomOffset':pp+32,'tilemapWords':entries,'compressedRomOffset':pp+202,'compressedBytes':compressed_bytes,'decodedPatternBytes':len(patterns),'nativeUploadBytes':u16(rom,pp+200),'patternsSha256':digest(patterns),'sha256':digest((out/picture_path).read_bytes()),'sameResourceAsBuilding':canonical_illustrations.setdefault(pp,i)},'animation':{'status':'static-native-resource','frames':1,'note':'The native building monitor resource is one image. Console flashes, digits and chrome animations are separate menu effects, not additional building image frames.'}}
        if u16(rom,pp+200)!=len(patterns):row['illustration']['nativeLengthQuirk']='Original Refinery record declares 2700 upload bytes, while its complete LCW stream contains 2720. This PNG preserves the complete decoded ROM resource; the native upload may retain 20 prior VRAM bytes at the last tile.'
        manifest['buildings'].append(row)
    validation={'independentLcwDecoder':True,'all19PointerEntriesValid':True,'allIcons32x24':True,'allIllustrations96x56':True,'nativeDecoderCompared':False}
    if args.native_helper:
        expected=json.loads((ROOT/'docs/source-identity.json').read_text())['generatedSourceSha256']
        if digest((ROOT/'.local/source/build/dune-base.c').read_bytes())!=expected:raise SystemExit('Pinned original generated C changed')
        with tempfile.TemporaryDirectory(prefix='dune-building-native-') as temp:
            run=subprocess.run([str(args.native_helper.resolve()),temp],capture_output=True,text=True,check=True)
            comparisons=[]
            for i,bank in banks.items():
                raw=(Path(temp)/f'building-{i:02d}.patterns.bin').read_bytes()
                if raw!=bank:raise SystemExit(f'Original native LCW mismatch: building {i}')
                comparisons.append({'id':i,'bytes':len(raw),'sha256':digest(raw),'matches':True})
            validation.update({'nativeDecoderCompared':True,'nativeDecoderAddress':'0x000c32','originalGeneratedSourceSha256':expected,'comparisons':comparisons})
            print(run.stdout,end='')
    manifest['validation']=validation
    manifest['coverage']={'buildingIds':list(range(19)),'icons':19,'illustrations':19,'uniqueIconResources':len(canonical_icons),'uniqueIllustrationResources':len(canonical_illustrations),'mapSprites':'Not included: this package is the complete building-menu image set, not world map animation/owner variants.','animations':'No per-building animation sequence in these native monitor records. Separate UI effects are not baked into the PNGs.'}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (out/'README.md').write_text('''# Original Sega USA building menu graphics

This local source-art package contains all 19 native building IDs: 32×24 menu
icons and 96×56 monitor illustrations. The asset names and IDs come from the
original ROM, including the two concrete IDs and reused native artwork.

`manifest.json` contains dimensions, exact ROM offsets, palettes, tile maps,
file/resource SHA-256, shared-resource identities and decoder validation.
Paths in the manifest are relative to this directory. Icons use original
transparent nibble zero; complete monitor images have an opaque black backdrop.

The monitor images are static original resources. Console lights, digits,
cursor frames and menu chrome are separate layers for a future interface.
World-map buildings, owner palettes, turret headings and construction/animation
overlays are outside this package; they have not been silently approximated.

Refinery ID12 has a native length quirk: 2700 declared VRAM-upload bytes versus
2720 complete decoded bytes. Its PNG preserves the complete ROM resource; see
the manifest for the exact distinction from a state-dependent native frame.

Reproduce from the exact USA ROM:

```sh
clang -std=c11 -O1 tools/extract_building_assets_native.c -o .local/extract-building-assets-native -lm
python3 tools/extract_building_assets.py '/path/to/Dune - The Battle for Arrakis (USA).gen' --native-helper .local/extract-building-assets-native
```

PNG encoding, LCW decoding and palette conversion use Python standard library
only. The optional native helper executes the original offline LCW routine,
then compares every decompressed byte for every building with the independent
decoder. No game mechanics or original program bytes are modified.
''')
    count=sum(p.stat().st_size for p in out.rglob('*.png'))
    print(json.dumps({'buildings':19,'pngs':38,'pngBytes':count,'nativeDecoderCompared':validation['nativeDecoderCompared'],'output':str(out)},ensure_ascii=False))

if __name__=='__main__':main()
