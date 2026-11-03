#!/usr/bin/env python3
"""Export canonical native focus phases and APNG from temporal-oracle RGBA.
No painting, resizing, colour-keying, or palette changes. Alpha comes from
nonzero nibbles of the focus entry in the original VDP sprite table.
"""
from pathlib import Path
from fractions import Fraction
import argparse, hashlib, json, struct, zlib
ROOT=Path(__file__).resolve().parents[1]

def chunk(kind,data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def pixels(raw,w=32,h=24):
    assert len(raw)==w*h*4
    return zlib.compress(b''.join(b'\0'+raw[y*w*4:(y+1)*w*4] for y in range(h)),9)
def png(raw):
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',32,24,8,6,0,0,0))+chunk(b'IDAT',pixels(raw))+chunk(b'IEND',b'')
def apng(frames,delay):
    # PNG delay fields are 16-bit. The manifest retains the exact Sega fraction;
    # limit_denominator changes this browser preview by less than a nanosecond.
    d=delay.limit_denominator(65535)
    assert 0<d.numerator<=65535 and d.denominator<=65535
    out=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',32,24,8,6,0,0,0))+chunk(b'acTL',struct.pack('>II',len(frames),0))
    sequence=0
    for i,raw in enumerate(frames):
        out+=chunk(b'fcTL',struct.pack('>IIIIIHHBB',sequence,32,24,0,0,d.numerator,d.denominator,0,0));sequence+=1
        compressed=pixels(raw)
        if i==0:out+=chunk(b'IDAT',compressed)
        else:out+=chunk(b'fdAT',struct.pack('>I',sequence)+compressed);sequence+=1
    return out+chunk(b'IEND',b''),d

def digest(b):return hashlib.sha256(b).hexdigest()
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('raw',type=Path,nargs='?',default=ROOT/'.local/menu-animation-oracle')
    parser.add_argument('output',type=Path,nargs='?',default=ROOT/'data/menu-animations')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    identity=json.loads((ROOT/'docs/source-identity.json').read_text())
    result={'version':1,'source':identity,'method':'Original machine_step and vdp_render only after native menu entry; completed VDP frames. Modern pointer observers absent during all 320-frame measurements. RGBA alpha is native SAT nonzero 4bpp pattern nibble; RGB is taken from that exact completed native frame.',
      'nativeFps':{'numerator':53693175,'denominator':896040},'neverDisappears':True,
      'presentationRule':'One continuous colour pulse; retain the same animated overlay when changing the selected cell. Do not animate CSS opacity or recolour the artwork.',
      'focus':{},'verification':{}}
    for name,hold in [('yard',8),('starport',16)]:
        folder=args.raw/name;timeline=json.loads((folder/'timeline.json').read_text());samples=timeline['samples'];assert len(samples)>=256
        assert timeline['adaptedMismatchFrames']==0
        variants={}
        for sample in samples:
            raw=(folder/f"focus-native-{sample['sample']:03}.rgba").read_bytes()
            assert len(raw)==32*24*4 and sum(raw[i]==255 for i in range(3,len(raw),4))==208
            assert set(raw[3::4])=={0,255}
            brightness=max(raw[i] for i in range(len(raw)) if i%4!=3)
            old=variants.setdefault(brightness,(raw,sample['sample']))
            assert old[0]==raw,'same native pulse brightness must give identical artwork'
        levels=sorted(variants)
        assert len(levels)==3 and levels==[109,182,255],levels
        order=[levels[2],levels[1],levels[0],levels[1]]
        path=args.output/'focus'/name;path.mkdir(parents=True,exist_ok=True)
        native_delay=Fraction(hold*timeline['frameClocks'],timeline['masterHz'])
        frames=[];metadata=[]
        for phase,level in enumerate(order):
            raw,sample=variants[level];encoded=png(raw);filename=f'phase-{phase}.png';(path/filename).write_bytes(encoded);frames.append(raw)
            metadata.append({'phase':phase,'path':f'focus/{name}/{filename}','sourceSample':sample,'nativeFrames':hold,'width':32,'height':24,'opaquePixels':208,'rgbaSha256':digest(raw),'sha256':digest(encoded)})
        encoded,preview_delay=apng(frames,native_delay);(path/'pulse.png').write_bytes(encoded)
        native_rgb=sorted({tuple(sample['rgb']) for sample in samples})
        entry={'phases':metadata,'animatedPath':f'focus/{name}/pulse.png','animatedSha256':digest(encoded),
          'phaseNativeFrames':hold,'cycleNativeFrames':hold*4,'phaseMilliseconds':float(native_delay*1000),'cycleMilliseconds':float(native_delay*4000),
          'nativePhaseDelay':{'numerator':native_delay.numerator,'denominator':native_delay.denominator},
          'apngPhaseDelay':{'numerator':preview_delay.numerator,'denominator':preview_delay.denominator},
          'apngDelayErrorNanoseconds':float((preview_delay-native_delay)*10**9),
          'observedNativeRgb':native_rgb,'sourceTimelineSha256':digest((folder/'timeline.json').read_bytes())}
        result['focus'][name]=entry
    for name in ['yard','starport','yard-midline100','starport-midline100']:
        p=args.raw/name/'timeline.json';d=json.loads(p.read_text());result['verification'][name]={k:d[k] for k in ['sampleLine','frameRange','adaptedMismatchFrames','legacyMismatchFrames','borderMismatchFrames','redLedMismatchFrames','greenRingMismatchFrames','phaseCounts']};result['verification'][name]['nativeSamples']=len(d['samples']);result['verification'][name]['sha256']=digest(p.read_bytes())
    yard_samples=json.loads((args.raw/'yard/timeline.json').read_text())['samples']
    indicator_timers={}
    for field,address,lo,hi,component in [('bfac','BFAC',7,27,None),('bfae','BFAE',4,11,'green indicator core [180,24,2,2]'),('bfb0','BFB0',7,17,'red indicator')]:
        event=field+'UpdateFrame'
        steps=sorted({(a[field]-b[field])&65535 for a,b in zip(yard_samples,yard_samples[1:]) if a[event]==b[event]})
        assert steps==[2],steps
        updates=sorted({v[event] for v in yard_samples if v[event]})
        indicator_timers[address]={'component':component,'reloadInclusive':[lo,hi],
          'reloadIntervalHelperCalls':[lo+1,hi+1],
          'observedCounterDecrementPerNativeFrame':steps[0],
          'observedReloadIntervalsNativeFrames':sorted({b-a for a,b in zip(updates,updates[1:])}),
          'visibleStateMayRepeat':True}
    result['yardIndicatorTiming']={'scope':'Observed original idle Yard menu; Starport uses a separate helper and is not assigned these counters.',
      'nativeHelper':'007F90','nativeRandomFunction':'000C0C',
      'rule':'SUBQ happens before the nonnegative check; a reload value N lasts N+1 helper calls. Two decrements per completed native frame were observed for every interval without a reload. Graphics may choose the same state again, so visible run lengths can exceed one timer interval.',
      'counters':indicator_timers,
      'combinedGreenCrop':'[172,12,16,16] contains four states: two native green-core states and a separate 21-pixel top-metal flash in [172..182,13..14].'}
    result['filesBytes']=sum(p.stat().st_size for p in (args.output/'focus').rglob('*.png'))
    (args.output/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (args.output/'README.md').write_text('''# Native menu focus animation

Exact original 32×24 RGBA focus artwork from the completed Sega USA VDP frames.
The frame never disappears: 208 opaque border pixels persist throughout the
four native brightness phases. The interior remains transparent.

- Yard: 8 native frames per phase, 32 per cycle.
- Starport: 16 native frames per phase, 64 per cycle in the observed native menu.
- Native clock: 53,693,175 master clocks/s; 896,040 clocks/frame.
- Keep one continuous animation when moving the selected cell; do not animate
  CSS opacity and do not repaint its palette.

`pulse.png` is APNG and uses the closest 16-bit PNG delay fraction; the exact
native fraction and the sub-nanosecond preview error are in `manifest.json`.
The individual PNG phases allow an exact clocked canvas implementation.

Reproduce with `tools/test_em_web_menu_animation.c` followed by
`tools/export_menu_animations.py`. The full temporal raw evidence stays under
`.local/menu-animation-oracle`, outside the shipped game. All exported RGB and
alpha values originate in native frames and SAT pattern nibbles.
''')
    print(json.dumps({'bytes':result['filesBytes'],'focus':{k:{'cycleMs':v['cycleMilliseconds'],'apngDelayErrorNs':v['apngDelayErrorNanoseconds']}for k,v in result['focus'].items()}},indent=2))
if __name__=='__main__':main()
