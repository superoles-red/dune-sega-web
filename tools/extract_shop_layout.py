#!/usr/bin/env python3
"""Native menu modules for a separate responsive UI prototype (no game edits).

Pixels are copied or decoded from the original USA VDP. Complex corners/caps
keep their native dimensions; straight 1px strips or 8px samples may repeat.
Fonts deliberately retain the original opaque black glyph-cell background.
"""
from pathlib import Path
import argparse, hashlib, json
from extract_shop_ui import ROOT,png,crop

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--raw',type=Path,default=ROOT/'.local/shop-layout-raw')
    ap.add_argument('--ui-raw',type=Path,default=ROOT/'.local/shop-ui-raw')
    ap.add_argument('--output',type=Path,default=ROOT/'data/shop-layout-kit')
    a=ap.parse_args();out=a.output;out.mkdir(parents=True,exist_ok=True)
    source=(a.ui_raw/'yard-idle.clean.rgb').read_bytes()
    vram=(a.raw/'menu-vram.bin').read_bytes();palette=(a.raw/'menu-palette.rgb').read_bytes()
    identity=json.loads((ROOT/'docs/source-identity.json').read_text())
    assert hashlib.sha256((ROOT/'.local/source/build/dune-base.c').read_bytes()).hexdigest()==identity['generatedSourceSha256']
    manifest={'version':1,'game':'Dune — The Battle for Arrakis, Sega Genesis USA',
      'source':{'romSha256':identity['romSha256'],'generatedSourceSha256':identity['generatedSourceSha256'],
        'sourceFrame':'yard-idle.clean.rgb from extract_shop_ui.c','sourceFrameSha256':hashlib.sha256(source).hexdigest(),
        'vramSha256':hashlib.sha256(vram).hexdigest(),'paletteSha256':hashlib.sha256(palette).hexdigest(),
        'paletteCoverage':'Original observed Atreides menu palette; no other-house UI palette claim.'},
      'renderingRules':['Draw at native size multiplied by an integer scale. Disable image smoothing.',
        'Do not resize corners, icons, caps or artwork independently. Repeat only declared straight strips or texture samples.',
        'Crop the final repetition at the destination boundary; do not rescale its pixels.',
        'Fonts have original opaque black 8x8 cells; use them on black windows.',
        'No generated imagery, painted borders, CSS gradients or colour-key transparency are included.'],
      'parts':{},'modules':{},'fonts':{},'notes':[]}

    # Decode the original WINDOW plane separately: cabinet corners must not
    # bake EXIT/STOP sprites into the native chrome. This is the source bitmap,
    # not a reconstruction or colour-key operation.
    window=bytearray(320*224*3)
    for yy in range(224):
        for xx in range(320):
            at=0x6000+((yy//8)*64+xx//8)*2;entry=int.from_bytes(vram[at:at+2],'big')
            tx=7-xx%8 if entry&0x800 else xx%8;ty=7-yy%8 if entry&0x1000 else yy%8
            b=vram[((entry&2047)*32+ty*4+tx//2)&65535];n=b&15 if tx&1 else b>>4
            ci=((entry>>13)&3)*16+n;window[(yy*320+xx)*3:(yy*320+xx+1)*3]=palette[ci*3:ci*3+3]
    window=bytes(window)
    def rgba(rgb,w,h,rows,inner=None):
        assert len(rows)==h
        result=bytearray(w*h*4)
        for yy,(lo,hi) in enumerate(rows):
            assert 0<=lo<=hi<=w
            for xx in range(w):
                at=yy*w+xx;result[at*4:at*4+3]=rgb[at*3:at*3+3]
                result[at*4+3]=255 if lo<=xx<hi and not(inner and inner(xx,yy)) else 0
        return bytes(result)
    def part(name,rect,role='fixed',repeat=None,label=None,rows=None,inner=None,frame=None):
        x,y,w,h=rect;pixels=crop(frame or source,rect);channels=3
        if rows is not None:pixels=rgba(pixels,w,h,rows,inner);channels=4
        rel='chrome/'+name+'.png';png(out/rel,w,h,pixels,channels)

        manifest['parts'][name]={'path':rel,'width':w,'height':h,'sourceRect':rect,'role':role,
          'repeat':repeat,'label':label or name,'transparent':channels==4,'pixelSha256':hashlib.sha256(pixels).hexdigest()}
        if rows is not None:manifest['parts'][name]['alphaGeometry']={'rowRuns':rows,'method':'Measured source contour, end-exclusive X runs; no RGB colour-key. Interior original black remains opaque.'}
        if frame is window:manifest['parts'][name]['sourceLayer']='Original VDP WINDOW plane, base0x6000, 64 tiles per row; sprites excluded.'
        return name

    def nine(name,rect,edge_x,edge_y):
        x,y,w,h=rect;parts={}
        for k,r in [('tl',[x,y,8,8]),('tr',[x+w-8,y,8,8]),('bl',[x,y+h-8,8,8]),('br',[x+w-8,y+h-8,8,8])]:parts[k]=part(name+'-'+k,r,'corner')
        parts['top']=part(name+'-top',[edge_x,y,1,8],'straight-edge','x')
        parts['bottom']=part(name+'-bottom',[edge_x,y+h-8,1,8],'straight-edge','x')
        parts['left']=part(name+'-left',[x,edge_y,8,1],'straight-edge','y')
        parts['right']=part(name+'-right',[x+w-8,edge_y,8,1],'straight-edge','y')
        parts['fill']=part(name+'-fill',[40,112,8,8],'fill','xy')
        manifest['modules'][name]={'kind':'nine-slice-repeat','nativeRect':rect,'nativeSize':[w,h],
          'insets':[8,8,8,8],'minimumSize':[24,24],'pieces':parts,
          'seamContract':'All joins use unscaled 8px native corners. Repeat 1px straight profiles between them. Outer cabinet background variations remain original source pixels, not repainted.'}
    # Cabinet is a frame-only 16px nine-slice. The original inner black
    # quadrants are transparent so native button sprites never become ghost
    # fragments. Its viewport/border remains8px;16 preserves curved corners.
    cabinet_rows=[(0,0),(4,108),(2,110),(1,111),(1,111)]+[(0,112)]*149+[(0,111),(0,111),(2,110),(1,109),(2,107),(0,0)]
    assert len(cabinet_rows)==160
    pieces={}
    for k,rx,ry,inner in [('tl',0,0,lambda x,y:x>=8 and y>=8),('tr',96,0,lambda x,y:x<8 and y>=8),('bl',0,144,lambda x,y:x>=8 and y<8),('br',96,144,lambda x,y:x<8 and y<8)]:
        rows=[(max(0,lo-rx),min(16,max(0,hi-rx))) if hi>rx and lo<rx+16 else (0,0) for lo,hi in cabinet_rows[ry:ry+16]]
        pieces[k]=part('command-cabinet-'+k,[24+rx,40+ry,16,16],'corner',rows=rows,inner=inner,frame=window)
    pieces['top']=part('command-cabinet-top',[64,40,1,16],'straight-edge','x',rows=[(0,0)]+[(0,1)]*7+[(0,0)]*8,frame=window)
    pieces['bottom']=part('command-cabinet-bottom',[64,184,1,16],'straight-edge','x',rows=[(0,0)]*8+[(0,1)]*7+[(0,0)],frame=window)
    pieces['left']=part('command-cabinet-left',[24,112,16,1],'straight-edge','y',rows=[(0,8)],frame=window)
    pieces['right']=part('command-cabinet-right',[120,112,16,1],'straight-edge','y',rows=[(8,16)],frame=window)
    pieces['fill']=part('command-cabinet-fill',[40,112,8,8],'fill','xy',frame=window)
    manifest['modules']['command-cabinet']={'kind':'nine-slice-repeat','nativeRect':[24,40,112,160],'nativeSize':[112,160],
      'insets':[16,16,16,16],'borderWidth':8,'viewportInsets':[8,8,8,8],'minimumSize':[40,40],'frameOnly':True,'pieces':pieces,
      'seamContract':'Draw black underlay then content inset8, then frame-only corners/strips LAST, with no fill. Corners16 preserve native curves. Keep all pixels native; repeat only straight profiles.'}
    nine('monitor',[152,32,112,72],192,64)
    manifest['modules']['monitor']['nativeArtworkRect']=[160,40,96,56]
    manifest['modules']['monitor']['nativeArtworkSize']=[96,56]

    def three(name,rect,middle_x,content_insets):
        x,y,w,h=rect
        pieces={'left':part(name+'-left',[x,y,8,h],'cap'),
          'middle':part(name+'-middle',[middle_x,y,1,h],'straight-edge','x'),
          'right':part(name+'-right',[x+w-8,y,8,h],'cap')}
        manifest['modules'][name]={'kind':'three-slice-repeat-x','nativeRect':rect,
          'nativeSize':[w,h],'fixedHeight':h,'minimumWidth':24,'contentInsets':content_insets,
          'pieces':pieces,'seamContract':'Keep both8px caps and native height; repeat the centre1px profile only in X.'}
    three('title-window',[152,104,112,16],192,[8,0,8,8])
    three('cash-window',[224,8,80,16],240,[8,8,8,0])
    three('meter-window',[188,124,72,16],220,[8,4,8,4])
    for name,rect,role,repeat in [
      ('native-black',[40,112,8,8],'fill','xy'),('steel-light',[136,88,8,8],'texture','xy'),
      ('steel-grain',[184,144,8,8],'native-shading-band-reference','x'),
      ('command-top-texture8',[56,40,8,8],'straight-edge','x'),
      ('command-bottom-texture8',[56,192,8,8],'straight-edge','x'),
      ('command-left-texture8',[24,112,8,8],'straight-edge','y'),
      ('command-right-texture8',[128,112,8,8],'straight-edge','y'),
      ('radar-cabinet72',[64,16,72,24],'fixed',None),
      ('radar-window56',[72,24,56,16],'fixed',None),
      ('radar-center48',[80,24,48,16],'literal-window-crop',None),
      ('radar-center32',[88,24,32,16],'literal-window-crop',None),
      ('resource-dollar',[156,116,24,24],'fixed',None),
      ('resource-power',[156,148,24,24],'fixed',None),
      ('resource-armor',[156,180,24,24],'fixed',None),
      ('resource-knob',[136,116,16,24],'fixed',None),
      ('resource-vent',[264,116,40,56],'fixed',None)]:part(name,rect,role,repeat)
    part('steel-medium',[32,32,8,8],'texture','xy')
    manifest['parts']['steel-medium']['nativeRgb']=[145,145,182]
    monitor_rows=[(8,104),(6,104),(5,106),(4,108),(4,109),(3,110),(2,111),(2,111)]+[(2,111)]*72+[(2,111),(3,111),(3,111),(4,111),(5,110),(6,109),(0,0),(0,0)]
    part('monitor-stack',[152,32,112,88],rows=monitor_rows)
    manifest['parts']['monitor-stack'].update({'nativeArtworkRect':[8,8,96,56],'nativeTextRect':[8,72,96,8],'joinContract':'One original fixed WINDOW assembly: monitor and title share their native bevel; do not split or resize.'})
    radar_rows=[(0,0),(0,0),(7,10),(6,11),(0,47)]+[(y-23,47) for y in range(23,41)]+[(19,47)]
    part('radar-clean',[66,18,48,24],rows=radar_rows)
    part('header-vents',[124,20,28,8],rows=[(0,0),(0,28),(0,28),(0,28),(0,28),(0,28),(0,28),(0,28)],frame=window)
    cash_rows=[(4,64),(1,67),(1,67)]+[(0,68)]*6+[(1,67),(1,67),(4,64)]
    for name,rx,ww in [('left',0,8),('middle',18,1),('right',61,8)]:
        rows=[(max(0,lo-rx),min(ww,max(0,hi-rx))) if hi>rx and lo<rx+ww else (0,0) for lo,hi in cash_rows]
        part('cash-window-clean-'+name,[230+rx,14,ww,12],'straight-edge' if name=='middle' else 'cap','x' if name=='middle' else None,rows=rows,frame=window)
    manifest['modules']['cash-window-clean']={'kind':'three-slice-repeat-x','nativeRect':[230,14,69,12],'nativeSize':[69,12],'fixedHeight':12,'minimumWidth':24,'contentInsets':[8,2,3,2],
      'nativeTextRect':[18,2,48,8],'pieces':{k:'cash-window-clean-'+k for k in ['left','middle','right']},'seamContract':'Native closed glass bevel only, excluding original cabinet roof.8x12 caps,1x12 repeated middle. Native text startsY2.'}
    # Fixed resource bezels retain their original pixel silhouettes. Gray
    # body padding is outside these measured shapes; black apertures remain
    # opaque and original dollar/power/armor sprites remain unchanged.
    resource_masks={
      'resource-dollar':[(0,0)]*3+[(3,21),(2,21)]+[(2,22)]*14+[(2,22),(2,20),(3,20)]+[(0,0)]*2,
      'resource-power':[(0,0)]*2+[(4,20),(3,21)]+[(2,22)]*15+[(3,21),(3,21),(5,19)]+[(0,0)]*2,
      'resource-armor':[(0,0)]*2+[(4,20),(3,21)]+[(2,22)]*17+[(4,21)]+[(0,0)]*2,
      'resource-knob':[(0,0)]*4+[(10,12),(7,13),(5,14),(4,15),(4,15)]+[(4,16)]*11+[(5,15),(6,14),(8,12),(0,0)],
      'resource-vent':[(0,0)]*5+[(14,25),(10,29),(9,31),(8,33),(7,34),(6,35),(5,36),(4,37),(3,38),(3,39),(2,39)]+[(2,39)]*24+[(3,39),(3,38),(3,38),(4,37),(5,36),(6,35),(7,34),(8,33),(9,32),(10,31),(11,29),(13,27)]+[(0,0)]*4}
    for name,rows in resource_masks.items():
        rect=manifest['parts'][name]['sourceRect'];assert len(rows)==rect[3],(name,len(rows))
        part(name,rect,rows=rows)
    meter_rows=[(0,0),(0,0),(5,67),(3,69),(2,70)]+[(2,71)]*5+[(2,70),(2,70),(4,69),(5,67),(0,0),(0,0)]
    for name,rx,ww in [('left',0,8),('middle',32,1),('right',64,8)]:
        rows=[(max(0,lo-rx),min(ww,max(0,hi-rx))) if hi>rx and lo<rx+ww else (0,0) for lo,hi in meter_rows]
        part('meter-window-'+name,[188+rx,124,ww,16],'straight-edge' if name=='middle' else 'cap','x' if name=='middle' else None,rows=rows)
    manifest['modules']['meter-window']['seamContract']='Keep8px native caps and16px height; repeat the original1px middle. Measured rounded aperture silhouette removes surrounding cabinet body only.'
    steel=crop(source,[136,88,8,8]);assert len({steel[i:i+3] for i in range(0,len(steel),3)})==1
    manifest['parts']['steel-light']['nativeRgb']=list(steel[:3])

    # Original menu glyphs use native pattern tile0x400+ASCII. Palette lane1
    # is observed in native cash SAT entries (e.g.A7B6), and gives exactly the
    # white/black pixels in title and cash display cells.
    def glyph(code):
        tile=0x400+code;pixels=bytearray(8*8*3)
        for y in range(8):
            for x in range(8):
                byte=vram[tile*32+y*4+x//2];n=byte&15 if x&1 else byte>>4
                pixels[(y*8+x)*3:(y*8+x+1)*3]=palette[(16+n)*3:(16+n+1)*3]
        return bytes(pixels)
    glyphs={code:glyph(code) for code in range(32,96)}
    atlas=bytearray(128*32*3)
    for code,g in glyphs.items():
        i=code-32;xx=(i%16)*8;yy=(i//16)*8
        for y in range(8):atlas[((yy+y)*128+xx)*3:((yy+y)*128+xx+8)*3]=g[y*24:(y+1)*24]
    png(out/'font/ui-ascii-32-95.png',128,32,atlas)
    strip=b''.join(b''.join(glyphs[48+n][y*24:(y+1)*24] for n in range(10)) for y in range(8))
    png(out/'font/digits.png',80,8,strip)
    for code in list(range(48,58))+[36]:png(out/f'font/glyph-{code}.png',8,8,glyphs[code])
    verify_title=(a.ui_raw/'yard-windtrap-preview.clean.rgb').read_bytes()
    for i,ch in enumerate('WINDTRAP'):assert crop(verify_title,[176+i*8,104,8,8])==glyphs[ord(ch)]
    # Native first-mission captured cash display reads642, independently of
    # the live house balance's rolling number animation.
    for i,ch in enumerate('642'):assert crop(source,[272+i*8,16,8,8])==glyphs[ord(ch)]
    manifest['fonts']['ui']={'path':'font/ui-ascii-32-95.png','width':128,'height':32,'glyphWidth':8,'glyphHeight':8,
      'firstCode':32,'lastCode':95,'columns':16,'rows':4,'advance':8,'nativeTileBase':1024,'paletteLane':1,
      'foregroundRgb':[255,255,255],'backgroundRgb':[0,0,0],'transparent':False,
      'digitsPath':'font/digits.png','digitsOrder':'0123456789','dollarPath':'font/glyph-36.png',
      'validation':'Exact64-pixel RGB equality with original WINDTRAP name cells and642 cash display cells.',
      'glyphs':{str(code):{'x':((code-32)%16)*8,'y':((code-32)//16)*8,'width':8,'height':8,'char':chr(code),'nativeTile':0x400+code} for code in glyphs}}
    capture=json.loads((a.raw/'capture.json').read_text());manifest['animations']={}
    for region in capture['regions']:
        name=region['id'];x,y,w,h=region['rect'];states=[];by_pixels={};sequence=[]
        for i in range(capture['nativeFrames']):
            pixels=(a.raw/f'{name}-{i:03}.rgb').read_bytes();assert len(pixels)==w*h*3
            if pixels not in by_pixels:
                index=len(states);by_pixels[pixels]=index;rel=f'animations/{name}/state-{index}.png';png(out/rel,w,h,pixels)
                states.append({'index':index,'path':rel,'width':w,'height':h,'firstObservedFrame':i,'pixelSha256':hashlib.sha256(pixels).hexdigest()})
            index=by_pixels[pixels]
            if sequence and sequence[-1]['state']==index:sequence[-1]['durationNativeFrames']+=1
            else:sequence.append({'state':index,'startNativeFrame':i,'durationNativeFrames':1})
        strip=bytearray(w*len(states)*h*3)
        for pixels,index in by_pixels.items():
            for yy in range(h):strip[(yy*w*len(states)+index*w)*3:(yy*w*len(states)+index*w+w)*3]=pixels[yy*w*3:(yy+1)*w*3]
        rel=f'animations/{name}/states-strip.png';png(out/rel,w*len(states),h,strip)
        ms_per_frame=capture['clocksPerFrame']/capture['masterHz']*1000
        for run in sequence:run['durationMs']=run['durationNativeFrames']*ms_per_frame
        manifest['animations'][name]={'sourceRect':region['rect'],'states':states,'stripPath':rel,'frameWidth':w,'frameHeight':h,
          'static':len(states)==1,'timeline':sequence,'nativeFrameCount':capture['nativeFrames'],
          'firstSourceNativeFrame':capture['firstNativeFrame'],'masterHz':capture['masterHz'],'clocksPerFrame':capture['clocksPerFrame'],
          'msPerNativeFrame':ms_per_frame,'sourceMethod':'Actual core.vdp.frame, the last completed original VDP frame at every source native frame. No shadow1088 replay.',
          'timingScope':'Recorded240-frame completed-native sequence. This is not a claimed periodic native cycle; original lamp timers are pseudo-random.',
          'prototypeUse':'The observed native sequence may be replayed for the standalone visual prototype; game integration must use the live original timer/state rather than replace it with this clip.'}
    # Geometric masks isolate complete original lamp fixtures. The green
    # fixture excludes the separate roof stripe/glint above it. Lamp clips keep
    # the actual240-frame completed-native timeline already captured above.
    stable=(a.raw/'menu-stable.rgb').read_bytes()
    fixture_specs=[('green-fixture','green-indicator',[172,16,16,16],[(0,0)]+[(7,12)]*4+[(6,13),(5,14)]+[(4,15)]*5+[(5,14),(6,13),(7,12),(7,12)]),
      ('red-fixture','red-indicator',[270,51,16,16],[(0,13)]*16)]
    for name,original,rect,rows in fixture_specs:
        x,y,w,h=rect;base=crop(stable,rect);states=[];lookup={};timeline=[]
        for i in range(capture['nativeFrames']):
            region=next(r for r in capture['regions'] if r['id']==original);ox,oy,ow,oh=region['rect'];old=(a.raw/f'{original}-{i:03}.rgb').read_bytes();rgb=bytearray(base)
            for gy in range(max(y,oy),min(y+h,oy+oh)):
                for gx in range(max(x,ox),min(x+w,ox+ow)):
                    to=((gy-y)*w+gx-x)*3;fr=((gy-oy)*ow+gx-ox)*3;rgb[to:to+3]=old[fr:fr+3]
            pixels=rgba(rgb,w,h,rows)
            if pixels not in lookup:
                index=len(states);lookup[pixels]=index;rel=f'animations/{name}/state-{index}.png';png(out/rel,w,h,pixels,4)
                states.append({'index':index,'path':rel,'width':w,'height':h,'firstObservedFrame':i,'pixelSha256':hashlib.sha256(pixels).hexdigest()})
            index=lookup[pixels]
            if timeline and timeline[-1]['state']==index:timeline[-1]['durationNativeFrames']+=1
            else:timeline.append({'state':index,'startNativeFrame':i,'durationNativeFrames':1})
        for run in timeline:run['durationMs']=run['durationNativeFrames']*ms_per_frame
        manifest['animations'][name]={**manifest['animations'][original],'sourceRect':rect,'states':states,'stripPath':None,'frameWidth':w,'frameHeight':h,'transparent':True,'alphaGeometry':{'rowRuns':rows},'timeline':timeline,
          'static':len(states)==1,'sourceMethod':'Exact overlap from same240 completed-native RGB frames; static fixture margin from the capture start completed-native frame. Measured source contour alpha only.'}
    manifest['notes']=[
      'Monitor artwork remains96x56 native pixels. Integer zoom it inside a larger repeated-frame window; do not stretch the artwork.',
      'Title window is a fixed16px-high three-slice. Native text is8px high, leaving original bezel rows.',
      'cash-window-clean isolates actual glass bevel; original glyph cells start2px below its top. Old cash-window retains the surrounding original cabinet roof as reference.',
      'Meter window is cropped tightly atx188..259 to avoid the vent; keep height16px.',
      'Resources cabinet is intentionally not offered as arbitrary nine-slice: knobs/vent/curved cabinet are complex fixed art. Compose the original fixed icons and individual meter modules instead.',
      'Radar32/48 crops are literal source windows, not rescaled or reconstructed complete radars.',
      'Indicator PNG states and recorded native procedure timelines are provided. Random native lamp rules/timing are verified separately by focus_verification; these clips are not canonical periodic loops.']
    for name,p in manifest['parts'].items():p['sha256']=hashlib.sha256((out/p['path']).read_bytes()).hexdigest()
    manifest['version']=2
    manifest['geometryNotes']=['Native source contour rowRuns are explicit masks, never selected by RGB colour. All retained RGB bytes are unchanged.', 'Cabinet16 inner quadrants are native WINDOW tile0x001 black; alpha removes only black/background sprites there, never native bezel. See .local/backdrop-analysis/cabinet-geometry.json.', 'steel-grain is preserved only as a source reference; its native vertical shading is not suitable for repeating inY. Use steel-light/steel-medium for flat native body fields.']
    manifest['pngCount']=len(list(out.rglob('*.png')));manifest['pngBytes']=sum(p.stat().st_size for p in out.rglob('*.png'))
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (out/'README.md').write_text('''# Native modular shop layout kit

Extracted original Sega USA pixels for a separate responsive prototype.
No runtime, balance, source UI assets, or original artwork was changed.

Reproduce:
```sh
clang -std=c11 -O1 tools/extract_shop_layout.c -o .local/extract-shop-layout -lm
mkdir -p .local/shop-layout-raw
.local/extract-shop-layout ../dune-web/data/evidence/mission-atreides-01.cpu.bin .local/shop-layout-raw
python3 tools/extract_shop_layout.py
```

Read manifest modules before drawing: corners/caps keep exact native size;
repeat only their declared straight1px/8px strips. Scale the complete assembly
by an integer. Draw the original font on black using native8x8 cells.
The font atlas was verified against original WINDTRAP and642 display pixels.

For responsive composition use fixed `monitor-stack`112x88 (portrait96x56 at
8,8; title at8,72), complete `radar-clean`48x24 + `header-vents`28x8,
`cash-window-clean`12px high, individual native icons and meter modules.
Use flat `steel-light` (182,182,218) for body and `steel-medium`
(145,145,182) for cells. `steel-grain` is an X-only native shading reference;
its vertical dither must never repeat inY.

The command cabinet uses16px corners/insets but has an8px border/viewport.
Draw black underlay inset8, draw contents, then draw frame-only parts LAST,
with no fill. Its inner corner quadrants are transparent WINDOW black cells,
so no EXIT/STOP sprite fragments are baked into the bezel.
All fixed RGBA pieces use explicit measured source contour row runs, not an
RGB colour key. Native apertures remain opaque black. Retained RGB bytes
are identical to original full-frame/WINDOW pixels.

Lamps use `green-fixture` and `red-fixture`, both16x16, with exact completed
native240-frame recorded timelines. The green fixture excludes the unrelated
roof stripe; its extra lower fixture margin is static in all320 independent
completed-native oracle frames. Recorded clips are for this standalone
visual prototype, not replacements for original runtime timing rules.
Large curved/resource decorations stay fixed; do not stretch them to fill gaps.
''',encoding='utf8')
    print(f"Exported{manifest['pngCount']} native PNGs ({manifest['pngBytes']}bytes) -> {out}")

if __name__=='__main__':main()
