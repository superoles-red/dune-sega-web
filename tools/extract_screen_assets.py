#!/usr/bin/env python3
"""Native Sega USA screen art and reusable presentation pieces.

This separate output never edits the live game, original ROM, or frozen shop kit.
All PNG pixels come from exact native source captures, source WINDOW graphics,
original indexed glyphs or declared lossless permutations of those pixels.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,struct,zlib
from extract_shop_ui import ROOT,png,crop

def sha(data):return hashlib.sha256(data).hexdigest()
def read_png(path):
    b=path.read_bytes();pos=8;data=b''
    assert b[:8]==b'\x89PNG\r\n\x1a\n'
    while pos<len(b):
        size=int.from_bytes(b[pos:pos+4],'big');kind=b[pos+4:pos+8];block=b[pos+8:pos+8+size];pos+=size+12
        if kind==b'IHDR':w,h,depth,ct,*_=struct.unpack('>IIBBBBB',block);assert depth==8 and ct in (2,6)
        if kind==b'IDAT':data+=block
    channels=4 if ct==6 else 3;stride=w*channels;raw=zlib.decompress(data)
    assert len(raw)==h*(stride+1) and all(raw[y*(stride+1)]==0 for y in range(h))
    return w,h,channels,b''.join(raw[y*(stride+1)+1:(y+1)*(stride+1)] for y in range(h))
def image_crop(pixels,sw,rect,ch=3):
    x,y,w,h=rect;return b''.join(pixels[((y+yy)*sw+x)*ch:((y+yy)*sw+x+w)*ch] for yy in range(h))

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--raw',type=Path,default=ROOT/'.local/screen-assets-phase-raw');ap.add_argument('--rom',type=Path,default=ROOT/'.local/roms/Dune-USA.gen');ap.add_argument('--scene-raw',type=Path,action='append',default=[]);ap.add_argument('--output',type=Path,default=ROOT/'data/screen-assets');a=ap.parse_args();out=a.output;out.mkdir(parents=True,exist_ok=True)
    identity=json.loads((ROOT/'docs/source-identity.json').read_text());rom=a.rom.read_bytes();assert sha(rom)==identity['romSha256'];kit=ROOT/'data/shop-layout-kit';km=json.loads((kit/'manifest.json').read_text())
    assert sha((ROOT/'.local/source/build/dune-base.c').read_bytes())==identity['generatedSourceSha256']
    m={'version':1,'game':'Dune — The Battle for Arrakis, Sega Genesis USA','source':identity,
       'nativeSize':[320,224],'parts':{},'modules':{},'fonts':{},'animations':{},'screens':{},
       'rules':['Native source RGB only; no AI imagery, repainting or colour grading.','Keep complex artwork at native dimensions times an integer scale; repeat only declared edge/fill samples.','Black pixels in native display apertures stay opaque.','New responsive layouts and touch hit areas are presentation adaptations. Original handler remains authoritative.']}
    def emit(name,w,h,pixels,ch=3,extra=None,category='ui'):
        rel=f'{category}/{name}.png';png(out/rel,w,h,pixels,ch)
        p={'path':rel,'width':w,'height':h,'channels':ch,'transparent':ch==4,'pixelSha256':sha(pixels),'sha256':sha((out/rel).read_bytes())}
        if extra:p.update(extra)
        m['parts'][name]=p;return name
    def copy(name,path,extra=None):
        w,h,ch,pixels=read_png(path);return emit(name,w,h,pixels,ch,extra)
    # Exact source modules are copied into this independent package so future
    # screen work cannot mutate the accepted/frozen building layout kit.
    for name in ['native-black','steel-light','steel-medium']:
        p=km['parts'][name];copy(name,kit/p['path'],{'origin':'data/shop-layout-kit/'+p['path'],'sourceRect':p['sourceRect'],'role':'fill','repeat':'xy'})
    cabinet=km['modules']['command-cabinet'];ps={}
    for key,name in cabinet['pieces'].items():
        p=km['parts'][name];ps[key]=copy(name,kit/p['path'],{'origin':'data/shop-layout-kit/'+p['path'],'sourceRect':p['sourceRect'],'role':p['role'],'repeat':p['repeat'],'alphaGeometry':p.get('alphaGeometry')})
    m['modules']['native-command-frame']={**cabinet,'pieces':ps,'sourceScope':'Original WINDOW cabinet silhouette, copied byte-for-byte from frozen kit v2. Render frame LAST with native8px viewport.'}
    # The original command cells have a genuine1px native bevel. The blank
    # inner row is repeated vertically; original labels are never painted out.
    rgb=(ROOT/'.local/shop-ui-raw/yard-idle.clean.rgb').read_bytes()
    for state,rect,expected in [('normal',[32,48,32,24],[145,145,182]),('disabled',[64,48,32,24],[36,36,72])]:
        cell=crop(rgb,rect);inner=cell[32*3:64*3];assert {inner[i:i+3] for i in range(3,31*3,3)}=={bytes(expected)}
        sample=cell[:96]+inner*22+cell[23*96:24*96]
        name='command-skin-'+state
        emit(name,32,24,sample,extra={'sourceFrame':'yard-idle.clean.rgb','sourceRect':rect,'recipe':'Original top/bottom bevel rows and22 exact repetitions of original blank inner row1. Original label pixels are never repainted.','nativeRgb':expected})
        pieces={}
        for key,r,repeat in [('tl',[0,0,1,1],None),('tr',[31,0,1,1],None),('bl',[0,23,1,1],None),('br',[31,23,1,1],None),('top',[8,0,1,1],'x'),('bottom',[8,23,1,1],'x'),('left',[0,1,1,1],'y'),('right',[31,1,1,1],'y'),('fill',[8,1,1,1],'xy')]:
            pieces[key]=emit(name+'-'+key,r[2],r[3],image_crop(sample,32,r),extra={'origin':name,'sourceRect':r,'repeat':repeat})
        m['modules'][name]={'kind':'nine-slice-repeat','nativeSize':[32,24],'insets':[1,1,1,1],'minimumSize':[3,3],'pieces':pieces,'originalMeaning':'Actual native command-button1px bevel and blank fill.'}
    fm=json.loads((ROOT/'data/menu-animations/manifest.json').read_text());phases=[]
    for phase in fm['focus']['yard']['phases']:
        w,h,ch,px=read_png(ROOT/'data/menu-animations'/phase['path']);assert (w,h,ch)==(32,24,4)
        name=copy('command-focus-'+str(phase['phase']),ROOT/'data/menu-animations'/phase['path'],{'origin':'data/menu-animations/'+phase['path'],'nativeFrames':phase['nativeFrames'],'alphaSource':'Original nonzero sprite4bpp pattern nibble.'})
        pieces={}
        for key,r,repeat in [('tl',[0,0,2,2],None),('tr',[30,0,2,2],None),('bl',[0,22,2,2],None),('br',[30,22,2,2],None),('top',[8,0,1,2],'x'),('bottom',[8,22,1,2],'x'),('left',[0,8,2,1],'y'),('right',[30,8,2,1],'y')]:
            pieces[key]=emit(name+'-'+key,r[2],r[3],image_crop(px,32,r,4),4,{'origin':name,'sourceRect':r,'repeat':repeat})
        m['modules'][name]={'kind':'nine-slice-repeat','nativeSize':[32,24],'insets':[2,2,2,2],'minimumSize':[8,8],'frameOnly':True,'pieces':pieces,'nativeFrames':phase['nativeFrames']};phases.append(name)
    m['animations']['command-focus']={'phases':phases,'phaseNativeFrames':8,'cycleNativeFrames':32,'nativeFps':fm['nativeFps'],'originalMeaning':'Original selected command-cell pulse, also suitable for short touch feedback. Not a separately observed native depressed-button state.'}
    normal=m['parts']['command-skin-normal'];_,_,_,base=read_png(out/normal['path']);_,_,_,focus=read_png(out/m['parts'][phases[0]]['path']);pressed=bytes(focus[i*4+c] if focus[i*4+3] else base[i*3+c] for i in range(32*24) for c in range(3))
    emit('command-skin-pressed',32,24,pressed,extra={'recipe':'Original normal fill plus phase0 native red selection sprite; native original pixels assembled without recolouring.','stateScope':'Adaptation feedback assembled from original selected-cell art; original has no separate depressed command-button skin.'})
    m['modules']['command-button']={'kind':'presentation-state-recipes','states':{'normal':'command-skin-normal','disabled':'command-skin-disabled','pressed':'command-skin-pressed'},'frameModules':{'normal':'command-skin-normal','disabled':'command-skin-disabled'},'optionalCabinetFrame':'native-command-frame','focusAnimation':'command-focus','contentInset':8,'note':'For large touch buttons repeat the flat native fill and optionally place native-command-frame around it. Native red frame indicates active selection/press feedback. Disabled action routing is determined by native original handler.'}
    # Original16x16 arrow button and an exact90-degree orientation permutation.
    arrow=crop(rgb,[208,140,16,16]);emit('arrow-up-native',16,16,arrow,extra={'sourceFrame':'yard-idle.clean.rgb','sourceRect':[208,140,16,16]})
    back=b''.join(arrow[(x*16+(15-y))*3:(x*16+(15-y)+1)*3] for y in range(16) for x in range(16))
    emit('back-button-native',16,16,back,extra={'origin':'arrow-up-native','transform':'rotate90 counter-clockwise, exact source-pixel permutation; no resampling','meaning':'Back is a presentation adaptation using the original stat-arrow button shape.'})
    # A glyph-only version uses a declared source pixel geometry inside the
    # original arrow, not a black/gray colour-key over arbitrary chrome.
    arrow_geometry=[[(5,7)],[(4,5),(7,8)],[(3,4),(8,9)],[(2,3),(5,7),(9,10)],[(4,5),(7,8)],[(3,4),(8,9)],[(2,3),(5,7),(9,10)],[(4,8)],[(3,9)],[(2,10)]]
    mask=bytearray(16*16*4)
    for yy,runs in enumerate(arrow_geometry,2):
        for lo,hi in runs:
            for xx in range(lo,hi):
                at=yy*16+xx;mask[at*4:at*4+4]=arrow[at*3:at*3+3]+b'\xff'
    emit('arrow-up-glyph-native',16,16,mask,4,{'sourceFrame':'yard-idle.clean.rgb','sourceRect':[208,140,16,16],'alphaGeometry':{'sourceLocalY':2,'rowRuns':arrow_geometry}})
    backmask=b''.join(mask[(x*16+15-y)*4:(x*16+15-y+1)*4] for y in range(16) for x in range(16));emit('back-glyph-native',16,16,backmask,4,{'origin':'arrow-up-glyph-native','transform':'rotate90 counter-clockwise, exact source-pixel permutation.'})
    font=km['fonts']['ui'];atlas=copy('font-ui-native',kit/font['path'],{'origin':'data/shop-layout-kit/'+font['path'],'validation':font['validation']});m['fonts']['ui']={**font,'path':m['parts'][atlas]['path'],'digitsPath':None,'dollarPath':None}
    # Exact original8x8 UI glyph geometry. Pattern nibble9 is the white
    # glyph andC is the native black character-cell background; neither is
    # inferred by an RGB colour-key and neither is claimed nibblezero.
    vr=(ROOT/'.local/shop-layout-raw/menu-vram.bin').read_bytes();pal=(ROOT/'.local/shop-layout-raw/menu-palette.rgb').read_bytes();mask=bytearray(128*32*4)
    for code in range(32,96):
        gx=((code-32)%16)*8;gy=((code-32)//16)*8;tile=0x400+code
        for yy in range(8):
            for xx in range(8):
                b=vr[tile*32+yy*4+xx//2];n=b&15 if xx&1 else b>>4;assert n in (9,12)
                at=((gy+yy)*128+gx+xx)*4;mask[at:at+4]=pal[(16+n)*3:(16+n+1)*3]+bytes([255 if n==9 else 0])
    font_mask=emit('font-ui-native-mask',128,32,mask,4,{'nativeTileBase':1024,'paletteLane':1,'glyphNibble':9,'backgroundNibble':12,'alphaSource':'Exact native glyph nibble9; original cell-background nibbleC excluded. No RGB-key or recolour.','foregroundRgb':[255,255,255],'validation':'Opaque foreground pixels exactly match verified native WINDTRAP and642 glyphs from shop kit.'})
    m['fonts']['uiMask']={**m['fonts']['ui'],'path':m['parts'][font_mask]['path'],'transparent':True,'foregroundRgb':[255,255,255],'backgroundRgb':None,'glyphNibble':9,'backgroundNibble':12}
    for name in ['exit-enabled','repair-enabled','repair-disabled','stop-enabled','stop-disabled','upgrade-enabled']:
        copy(name,ROOT/'data/shop-ui-assets/buttons'/f'{name}.png',{'origin':'data/shop-ui-assets/buttons/'+name+'.png','stateScope':'Actual observed native command artwork; command serif font is baked into these original sprites.'})
    # Scene coverage is intentionally explicit while the native fixtures are
    # captured; an entry-point inventory is not an observed screenshot claim.
    for name,kind,evidence in [('boot','autoplay','Reset entry; pending native capture'),('title','interactive','4D4E stack return178D2'),('main-menu','interactive','4D4E stack return178D2'),('house-choice','interactive','poll4938'),('campaign-map','interactive','native campaign observer, captured separately'),('briefing','text-with-animation','264F8 ->1F3EA'),('victory','text-with-animation','outcome branch22AFC'),('defeat','text-with-animation','outcome branch22BDE'),('ending','autoplay','Final campaign outcome, pending capture'),('pause-options','interactive','4D4E stack return20F24'),('credits','autoplay','Credits action, pending capture')]:
        m['screens'][name]={'kind':kind,'status':'entrypoint-inventoried-capture-pending','evidence':evidence}
    # Additional actual completed-native captures are supplied by the offline
    # native recorder / campaign scene fixture tool. Their source pixels are
    # exported without resampling; scene-specific modular recipes follow.
    captures={};capture_index={}
    for raw_dir in [a.raw,ROOT/'.local/screen-options-raw',ROOT/'.local/screen-campaign-raw',ROOT/'.local/screen-houses-raw',ROOT/'.local/screen-outcomes-raw',ROOT/'.local/screen-starport-raw']+a.scene_raw:
        for meta_path in sorted(raw_dir.glob('*.json')) if raw_dir.exists() else []:
            meta=json.loads(meta_path.read_text());capture_id=meta.get('id',meta_path.stem);rgb_path=meta_path.with_suffix('.rgb')
            if not rgb_path.exists():continue
            pixels=rgb_path.read_bytes();w=meta.get('width',320);h=meta.get('height',224)
            if len(pixels)!=w*h*3:continue
            capture_index[capture_id]=(meta,pixels,meta_path)
            captures[capture_id]={'nativeFrame':meta.get('frame'),'rawSource':str(rgb_path.relative_to(ROOT)),'sourceRgbSha256':sha(pixels),'metadata':meta,'currentVdpRgbMismatchBytes':meta.get('currentVdpRgbMismatchBytes')}
    def raw(name,suffix):return capture_index[name][2].with_suffix('.'+suffix).read_bytes()
    def indexed(name,layer):
        assert capture_index[name][0].get('currentVdpRgbMismatchBytes')==0,'Current VDP layers must exactly reproduce the captured completed frame.'
        assert not capture_index[name][0].get('shadowHighlight'),'Layer export requires independently tested shadow/highlight handling.'
        indices=raw(name,layer+'.indices');pal=raw(name,'palette.rgb');pixels=bytearray(320*224*4)
        for i,v in enumerate(indices):pixels[i*4:i*4+4]=pal[(v&63)*3:(v&63)*3+3]+bytes([255 if v&15 else 0])
        return bytes(pixels)
    def layer_part(aid,name,layer,rect,opaque=False):
        rgba=indexed(name,layer);pixels=image_crop(rgba,320,rect,4)
        if opaque:pixels=bytes(v for i,v in enumerate(pixels) if i%4!=3)
        return emit(aid,rect[2],rect[3],pixels,3 if opaque else 4,{'capture':name,'sourceLayer':layer,'sourceRect':rect,'sourceRgbSha256':captures[name]['sourceRgbSha256'],'alphaSource':None if opaque else 'Original VDP layer nonzero4bpp nibble; no RGB-key.','phaseProof':'Exact current VDP recomposition equals completed native RGB frame (0 mismatched bytes).'},category='art')
    def reference(aid,name):
        meta,pixels,_=capture_index[name];return emit(aid,320,224,pixels,extra={'capture':name,'sourceRect':[0,0,320,224],'nativeFrame':meta['frame'],'role':'native-reference-frame'},category='references')
    title='title-menu-000040'
    if title in capture_index:
        reference('title-reference',title)
        layer_part('title-background',title,'plane-b',[0,0,320,224],True)
        layer_part('title-planet-nebula',title,'plane-b',[72,32,248,176],True)
        layer_part('title-logo',title,'plane-a',[39,71,255,36])
        layer_part('title-subtitle',title,'plane-a',[49,125,215,15])
        layer_part('title-license',title,'plane-a',[96,202,128,6])
        for i,label in enumerate(['start-game','options','tutorial']):layer_part('title-label-'+label,title,'plane-a',[128,160+i*8,80,8])
        layer_part('title-native-cursor',title,'sprites',[116,156,16,16])
        # The original shadowed native menu font lives in a second bank and
        # already has a black shadow; it remains readable on native gray.
        vr=raw(title,'vram.bin');pal=raw(title,'palette.rgb');atlas=bytearray(128*32*4);glyphs={}
        for code in range(32,96):
            tile=0x480+code;glyph=bytearray(8*8*4)
            for yy in range(8):
                for xx in range(8):
                    v=vr[tile*32+yy*4+xx//2];n=v&15 if xx&1 else v>>4;assert n in (0,1,13,15)
                    at=(yy*8+xx)*4;glyph[at:at+4]=pal[(48+n)*3:(49+n)*3]+bytes([255 if n else 0])
            glyphs[code]=bytes(glyph);gx=(code-32)%16*8;gy=(code-32)//16*8
            for yy in range(8):atlas[((gy+yy)*128+gx)*4:((gy+yy)*128+gx+8)*4]=glyph[yy*32:(yy+1)*32]
        plane=indexed(title,'plane-a')
        for i,ch in enumerate('START GAME'):assert image_crop(plane,320,[128+i*8,160,8,8],4)==glyphs[ord(ch)]
        fid=emit('font-ui-shadow-native',128,32,atlas,4,{'capture':title,'nativeTileBase':0x480,'paletteLane':3,'alphaSource':'Original4bpp zero nibble; D=white foreground,F=black shadow,1=native special64 glyph.','validation':'Every RGBA pixel of native START GAME exactly equals10 exported original glyph cells.'})
        m['fonts']['uiShadow']={**m['fonts']['uiMask'],'path':m['parts'][fid]['path'],'nativeTileBase':0x480,'paletteLane':3,'foregroundNibble':13,'glyphNibble':13,'glyphs':{str(code):{**m['fonts']['ui']['glyphs'][str(code)],'nativeTile':0x480+code} for code in range(32,96)},'shadowNibble':15,'backgroundNibble':0,'foregroundRgb':[255,255,255],'shadowRgb':[0,0,0],'advance':8,'specialCode64':'Native control glyph; not a claim of a standard@ sign.','validation':'Exact80x8 RGBA equality with original title menu START GAME.'}
        for key,bank,source_vram,source_pal,lane in [('textMask',0x400,(ROOT/'.local/shop-layout-raw/menu-vram.bin').read_bytes(),(ROOT/'.local/shop-layout-raw/menu-palette.rgb').read_bytes(),1),('textShadow',0x480,vr,pal,3)]:
            atlas=bytearray(128*48*4);glyphs_meta={}
            for code in range(32,127):
                tile=bank+code;gx=(code-32)%16*8;gy=(code-32)//16*8
                for yy in range(8):
                    for xx in range(8):
                        b=source_vram[tile*32+yy*4+xx//2];n=b&15 if xx&1 else b>>4
                        assert n in ((9,12) if bank==0x400 else (0,1,13,15))
                        alpha=255 if (n==9 if bank==0x400 else n!=0) else 0;at=((gy+yy)*128+gx+xx)*4
                        atlas[at:at+4]=source_pal[(lane*16+n)*3:(lane*16+n+1)*3]+bytes([alpha])
                glyphs_meta[str(code)]={'x':gx,'y':gy,'width':8,'height':8,'char':chr(code),'nativeTile':tile}
            fid=emit('font-'+key.lower()+'-native',128,48,atlas,4,{'nativeTileBase':bank,'paletteLane':lane,'sourceScope':'Original complete95 glyph bank range32..126; no generated characters.'})
            m['fonts'][key]={**m['fonts']['uiMask' if bank==0x400 else 'uiShadow'],'path':m['parts'][fid]['path'],'width':128,'height':48,'rows':6,'firstCode':32,'lastCode':126,'nativeTileBase':bank,'paletteLane':lane,'glyphs':glyphs_meta,'specialCode64':'Native control glyph; not a claim of a standard@sign.'}
        title_recipe={'status':'observed-modular-native-assets-ready','referencePart':'title-reference','nativeReferenceFrame':capture_index[title][0]['frame'],'background':'title-background','layers':[
          {'part':'title-background','sourceRect':[0,0,320,224],'nativeOrigin':[0,0],'responsiveRole':'Black space background with original planet/stars; preserve native art proportions.'},
          {'part':'title-logo','sourceRect':[39,71,255,36],'nativeOrigin':[39,71],'responsiveRole':'Independent centered title artwork.'},
          {'part':'title-subtitle','sourceRect':[49,125,215,15],'nativeOrigin':[49,125]},
          {'part':'title-license','sourceRect':[96,202,128,6],'nativeOrigin':[96,202]}],
          'nativeChoices':[{'id':label,'labelPart':'title-label-'+label,'sourceHitRect':[104,156+i*8,144,8],'originalPollReturn':0x178d2,'nativeIndex':i} for i,label in enumerate(['start-game','options','tutorial'])],
          'nativeArtworkWithoutButtonText':'title-background is original planeB; DUNE/subtitle/license are separate original planeA crops. No background pixels were painted over button text.',
          'animationRecipe':{'mode':'live-original-layers','source':'Current original title VDP planeB and logo/label sourceRect samples. Keep native palette/timing; do not replace original intro with a recorded loop.'}}
        m['screens']['title']={**m['screens']['title'],**title_recipe};m['screens']['main-menu']={**m['screens']['main-menu'],**title_recipe}
    boot='boot-000600'
    if boot in capture_index:
        reference('boot-publishers-reference',boot)
        layer_part('boot-starfield',boot,'plane-b',[0,0,320,224],True)
        layer_part('publisher-virgin',boot,'plane-a',[119,13,93,83])
        layer_part('publisher-westwood',boot,'plane-a',[60,123,200,43])
        layer_part('publisher-and',boot,'plane-a',[151,106,24,8])
        layer_part('publisher-copyright-virgin',boot,'plane-a',[64,176,191,16])
        layer_part('publisher-copyright-westwood',boot,'plane-a',[48,200,221,8])
        if 'boot-001020' in capture_index:layer_part('publisher-present','boot-001020','plane-a',[128,112,55,8])
        m['screens']['boot'].update({'status':'observed-modular-native-assets-ready','referencePart':'boot-publishers-reference','background':'boot-starfield','layers':[
          {'part':'publisher-virgin','nativeOrigin':[119,13]},{'part':'publisher-and','nativeOrigin':[151,106]},
          {'part':'publisher-westwood','nativeOrigin':[60,123]},{'part':'publisher-copyright-virgin','nativeOrigin':[64,176]},
          {'part':'publisher-copyright-westwood','nativeOrigin':[48,200]}],
          'animationRecipe':{'mode':'live-original-layers','source':'Original planeA publisher artwork over original planeB starfield; native fade palette/scroll remains authoritative.'}})
    options='pause-options'
    if options in capture_index:
        reference('pause-options-reference',options)
        layer_part('pause-options-original-background',options,'window',[0,0,320,224],True)
        layer_part('pause-options-helmet-lower',options,'window',[0,148,160,36],True)
        layer_part('pause-options-terrain-right',options,'window',[248,152,72,72],True)
        layer_part('pause-options-sky-sample',options,'window',[272,8,8,8],True)
        arrow=layer_part('menu-arrow-native',options,'sprites',[12,36,16,16]);_,_,_,pixels=read_png(out/m['parts'][arrow]['path'])
        rotated=b''.join(pixels[((15-y)*16+15-x)*4:((15-y)*16+15-x+1)*4] for y in range(16) for x in range(16))
        emit('back-menu-arrow-native',16,16,rotated,4,{'origin':'menu-arrow-native','transform':'rotate180, exact native source-pixel permutation; no interpolation.'})
        m['screens']['pause-options'].update({'status':'observed-modular-native-assets-ready','referencePart':'pause-options-reference','background':'pause-options-original-background',
          'nativeArtworkLimit':'Fixed OPTIONS/MUSIC IS/etc labels are baked into the WINDOW backdrop tile graphics. This original background is not falsely called label-free; no hidden helmet pixels were invented.',
          'clearDecorParts':['pause-options-helmet-lower','pause-options-terrain-right','pause-options-sky-sample'],
          'controls':[{'row':i,'sourceHitRect':[24,y,288,16],'valueHitRect':[168,y,144,16],'nativePollReturn':0x20f24} for i,y in enumerate([36,52,68,84,100,132,148,164])],
          'exitHitRect':[48,188,232,24],'nativeStartMeaning':'Exit Options/return to prior original game scene.',
          'animationRecipe':{'mode':'live-original-source-rects','source':'WINDOW backdrop fixed; current toggle/test values and active native pointer are live original sprites. Current native values/availability remain authoritative.'}})
        m['screens']['options']={**m['screens']['pause-options'],'controls':m['screens']['pause-options']['controls'][:6],'nativeMeaning':'Same original Options module from title with only six original rows; captured pause artwork is shared, title routing handled by native code.'}
    confirm='restart-confirm'
    if confirm in capture_index:
        reference('restart-confirm-reference',confirm)
        layer_part('confirmation-dialog-native',confirm,'sprites',[104,116,112,32])
        # Actual dialogue may be drawn in sprites over the unchanged WINDOW;
        # use the completed frame as source for this observed native bezel.
        original=indexed(confirm,'sprites');rect=[104,116,112,32];ps={}
        for key,r,repeat in [('tl',[104,116,4,4],None),('tr',[212,116,4,4],None),('bl',[104,144,4,4],None),('br',[212,144,4,4],None),('top',[160,116,1,4],'x'),('bottom',[160,144,1,4],'x'),('left',[104,132,4,1],'y'),('right',[212,132,4,1],'y'),('fill',[108,130,1,1],'xy')]:
            if key=='fill':assert image_crop(original,320,r,4)==b'\0\0\0\xff','Native dialog interior must remain opaque black.'
            ps[key]=emit('dialog-frame-'+key,r[2],r[3],image_crop(original,320,r,4),4,{'capture':confirm,'sourceRect':r,'repeat':repeat,'sourceLayer':'Original native sprite indices and palette, verified completed frame phase.'},category='chrome')
        m['modules']['dialog-frame']={'kind':'nine-slice-repeat','nativeSize':[112,32],'insets':[4,4,4,4],'minimumSize':[16,16],'pieces':ps,'originalMeaning':'Original blue/white beveled confirmation dialog, no generated border.'}
        m['screens']['confirmation']={'status':'observed-modular-native-assets-ready','referencePart':'restart-confirm-reference','background':'native-black','frameModule':'dialog-frame','nativeDialogRect':rect,'nativeChoices':[{'id':'yes','sourceHitRect':[96,124,64,28]},{'id':'no','sourceHitRect':[160,124,64,28]}],'nativePollReturn':0x21ae6,'nativeConfirmButton':'C','note':'The actual native YES/NO state remains authoritative; new touch boxes do not predetermine the choice.'}
    password='password'
    if password in capture_index:
        reference('password-reference',password)
        layer_part('password-original-background',password,'window',[0,0,320,224],True)
        layer_part('password-soldier-landscape',password,'window',[0,128,320,96],True)
        layer_part('password-sky-sample',password,'window',[272,8,8,8],True)
        m['screens']['password']={'status':'observed-native-assets-ready-legacy-only','referencePart':'password-reference','background':'password-original-background','nativePollReturn':0x21660,'keyboardRect':[84,52,160,48],'inputRect':[112,104,104,24],'legacyScope':'Extracted original art/coordinates only. Password UI replacement is a separate original-state/save integration; this asset pipeline does not add new codes or alter progression.'}
    # Clean original Option hero fragments: all rectangles are genuinely
    # free of baked static labels. They are cropped, never inpainted.
    if options in capture_index:
        for aid,rect in [('options-helmet-face',[112,48,64,80]),('options-helmet-lower',[0,144,176,48]),('options-desert-panorama',[0,144,320,48]),('options-landscape-right',[176,112,144,80])]:
            layer_part(aid,options,'window',rect,True)
        for key in ['options','pause-options']:
            m['screens'][key].update({'background':'native-black','referenceBackgroundPart':'pause-options-original-background','staticHeroPart':'options-helmet-face','heroSourceRect':[112,48,64,80],
              'clearDecorParts':['options-helmet-face','options-helmet-lower','options-desert-panorama','options-landscape-right'],
              'artRects':[{'sourceRect':[112,48,64,80],'role':'helmet-hero','live':True},{'sourceRect':[0,144,320,48],'role':'desert-panorama','live':True}],
              'heroRule':'Keep native proportions/integer scale. This64x80 helmet fragment contains no text; native black/metal/glass may fill the new layout.'})
    picker='house-picker-000032'
    m['houses']={}
    if picker in capture_index:
        reference('house-picker-reference',picker)
        layer_part('house-choice-heading',picker,'window',[96,32,136,16])
        houses=[]
        for house,name,x in [(1,'ATREIDES',32),(2,'ORDOS',120),(0,'HARKONNEN',208)]:
            full=layer_part('house-'+str(house)+'-emblem',picker,'window',[x,64,80,64])
            crest=layer_part('house-'+str(house)+'-crest',picker,'window',[x+8,72,64,48])
            caption=layer_part('house-'+str(house)+'-caption',picker,'window',[x,136,80,16])
            item={'houseId':house,'name':name,'part':full,'crestPart':crest,'captionPart':caption,'portraitPart':None,'sourceHitRect':[x,32,80,176]}
            houses.append(item);m['houses'][str(house)]=dict(item)
        m['screens']['house-choice'].update({'status':'observed-modular-native-assets-ready','referencePart':'house-picker-reference','background':'native-black','headingPart':'house-choice-heading','houses':houses,
          'artRects':[{'sourceRect':[x,64,80,88],'role':'house-'+str(h),'live':True} for h,x in [(1,32),(2,120),(0,208)]],
          'nativePoll':0x4938,'nativeColumnOrder':[1,2,0],'layoutRule':'Keep emblems/captions at native proportions; arrange three independent house cards responsively. Original IDs0H/1A/2O are unchanged.'})
    def background_rgb(name):
        # Literal original vdp_render_pixels background priority, with sprites
        # absent. This retrieves original art hidden behind the native actor;
        # no pixel content is inferred or generated.
        meta=capture_index[name][0];assert meta.get('currentVdpRgbMismatchBytes')==0 and not meta.get('shadowHighlight')
        aa=raw(name,'plane-a.indices');bb=raw(name,'plane-b.indices');ww=raw(name,'window.indices');regs=raw(name,'registers.bin');pal=raw(name,'palette.rgb');result=bytearray(320*224*3)
        horizontal=(regs[17]&31)*16;vertical=(regs[18]&31)*8
        for yy in range(224):
            for xx in range(320):
                i=yy*320+xx;window_at=(xx>=horizontal if regs[17]&128 else xx<horizontal) or (yy>=vertical if regs[18]&128 else yy<vertical)
                a0=ww[i] if window_at else aa[i];b0=bb[i];colour=regs[7]&63
                if b0 and not(b0&128):colour=b0&63
                if a0 and not(a0&128):colour=a0&63
                if b0&128:colour=b0&63
                if a0&128:colour=a0&63
                result[i*3:i*3+3]=pal[colour*3:colour*3+3]
        return bytes(result)
    brief='campaign-briefing-000064'
    if brief in capture_index:
        reference('briefing-reference',brief)
        bg=background_rgb(brief);rect=[72,48,248,104]
        emit('campaign-map-native',248,104,crop(bg,rect),extra={'capture':brief,'sourceRect':rect,'sourceLayer':'Original VDP background priority with native sprites omitted; retrieves actual ROM map art hidden behind advisor.','scope':'Observed first Harkonnen briefing map, original faction colouring; not a claimed dynamic campaign ownership map.'},category='art')
        layer_part('advisor-0-portrait',brief,'sprites',[0,64,144,160])
        for aid,rect in [('story-button-proceed',[193,168,80,16]),('story-button-advice',[193,192,80,16])]:layer_part(aid,brief,'sprites',rect)
        m['houses'].setdefault('0',{'houseId':0,'name':'HARKONNEN'})['portraitPart']='advisor-0-portrait'
        story={'status':'observed-modular-native-assets-ready','referencePart':'briefing-reference','background':'native-black','staticMapPart':'campaign-map-native','portraitRect':[0,64,144,160],
          'textRect':[16,16,288,40],'artRects':[{'sourceRect':[0,64,144,160],'role':'advisor','live':True},{'sourceRect':[72,48,248,104],'role':'campaign-map','live':True,'note':'Full RGB map rectangle overlaps the native actor. Use staticMapPart to avoid a duplicate actor after separating layout.'}],
          'controls':[{'id':'proceed','part':'story-button-proceed','sourceHitRect':[184,164,96,24]},{'id':'advice','part':'story-button-advice','sourceHitRect':[184,188,96,24]}],
          'animationRecipe':{'mode':'live-original-frame','portraitRect':[0,64,144,160],'rule':'Sample the current completed native frame. Original character timers, mouth/eyes and palette remain authoritative; no recorded loop replaces them.'}}
        m['screens']['briefing'].update(story)
        m['screens']['campaign-map'].update({'status':'observed-modular-native-assets-ready','background':'campaign-map-native','staticHeroPart':'campaign-map-native','houses':m['houses'],'sourceScope':'Original first-mission strategic map artwork only; progress and native allowed missions come from campaign state, never from this static illustration.'})
    confirm_house='house-confirm-000008'
    if confirm_house in capture_index:
        reference('house-confirm-reference',confirm_house)
        for aid,rect in [('story-button-yes',[193,168,80,16]),('story-button-no',[193,192,80,16])]:layer_part(aid,confirm_house,'sprites',rect)
        m['screens']['house_briefing']={'status':'observed-modular-native-assets-ready','referencePart':'house-confirm-reference','background':'native-black','staticMapPart':'campaign-map-native','portraitRect':[0,64,144,160],'textRect':[16,16,288,40],
          'artRects':[{'sourceRect':[0,64,144,160],'role':'advisor','live':True}],
          'controls':[{'id':'yes','part':'story-button-yes','sourceHitRect':[184,164,96,24]},{'id':'no','part':'story-button-no','sourceHitRect':[184,188,96,24]}],
          'animationRecipe':{'mode':'live-original-frame','portraitRect':[0,64,144,160]}}
    # All three advisors were reached through the real picker -> YES flow.
    # Their live union is measured over192 completed original frames, not
    # guessed from one static portrait or manufactured as a repeating movie.
    advisor_rect=[0,80,144,144];advisor_variants={}
    for house in range(3):
        name='house-'+str(house)+'-briefing'
        if name not in capture_index:continue
        meta=capture_index[name][0];assert meta['house']==house and meta.get('assetDescriptor',-1)<0
        aid=layer_part('advisor-'+str(house)+'-portrait',name,'sprites',advisor_rect)
        frames=[];distinct={};bounds=[]
        for i in range(64):
            sample='house-'+str(house)+'-portrait-'+str(i).zfill(3)
            if sample not in capture_index:continue
            indices=raw(sample,'sprites.indices');points=[(at%320,at//320) for at,v in enumerate(indices) if at%320<176 and v&15]
            if points:
                b=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points)+1,max(y for x,y in points)+1];bounds.append(b)
                assert b[0]>=0 and b[1]>=80 and b[2]<=144 and b[3]<=224,(house,sample,b)
            rgba=image_crop(indexed(sample,'sprites'),320,advisor_rect,4);digest=sha(rgba)
            distinct.setdefault(digest,len(distinct));frames.append({'sourceNativeFrame':capture_index[sample][0]['frame'],'state':distinct[digest]})
        animation={'mode':'live-original-frame','sourceRect':advisor_rect,'observedNativeFrames':len(frames),'observedDistinctStates':len(distinct),
          'observedStates':[{'index':index,'rgbaSha256':digest} for digest,index in distinct.items()],'observedTimeline':frames,
          'timingScope':'Observed natural intro frames only; no fixed-period blink/mouth loop is claimed or substituted. The live original core provides every displayed animation frame.'}
        m['animations']['advisor-portrait-'+str(house)]=animation
        advisor_variants[str(house)]={'houseId':house,'portraitPart':aid,'portraitRect':advisor_rect,'animation':'advisor-portrait-'+str(house),'referenceCapture':name}
        m['houses'].setdefault(str(house),{'houseId':house}).update(advisor_variants[str(house)])
    for key in ['house_briefing','briefing']:
        if key in m['screens'] and advisor_variants:
            sc=m['screens'][key];sc['portraitRect']=advisor_rect;sc['houseVariants']=advisor_variants
            sc['artRects']=[{**a,'sourceRect':advisor_rect} if a['role']=='advisor' else a for a in sc.get('artRects',[])]
            sc['animationRecipe']={'mode':'live-original-frame','portraitRect':advisor_rect,'houseVariants':advisor_variants,'sourceRule':'Current completed original RGB supplies native advisor animation; static RGBA portraits are for pre-engine front-end decoration only.'}
    outcome_scope='Controlled offline outcome conditions: M1 victory via original quota checker, defeat/final victory via original Building_Free for enemy/player buildings. Subsequent movie/debrief/stats/ending/credits all executed the original branches without jumping into scene PCs. This is not a claim of player-earned campaign completion.'
    m['outcomeFixtureScope']=outcome_scope
    movie_cases={'victory_movie':'house1-mission01-victory-movie-000008','defeat_movie':'house1-mission01-defeat-movie-000008'}
    for scene,name in movie_cases.items():
        if name not in capture_index:continue
        reference(scene+'-reference',name);rect=[8,40,304,120];pixels=crop(capture_index[name][1],rect)
        emit(scene+'-preview',304,120,pixels,extra={'capture':name,'sourceRect':rect,'sourceLayer':'Actual completed native frame, including original effects.','fixtureScope':outcome_scope},category='art')
        m['screens'][scene]={'status':'observed-modular-native-assets-ready','referencePart':scene+'-reference','background':'native-black','staticHeroPart':None,'previewPart':scene+'-preview','sourceRect':rect,'movieRect':rect,'portraitRect':None,'textRect':None,
          'artRects':[{'sourceRect':rect,'role':'native-movie','live':True}],
          'controls':[{'id':'continue','nativeButton':'C','meaning':'Use original scene continuation; native readiness stays authoritative.'}],
          'animationRecipe':{'mode':'live-original-frame','sourceRect':rect,'rule':'Use every current completed original frame. This PNG is a single review/preview image, never a replacement loop.'},'fixtureScope':outcome_scope}
    for scene,name in [('victory','house1-mission01-victory-000008'),('defeat','house1-mission01-defeat-000008')]:
        if name not in capture_index:continue
        reference(scene+'-reference',name)
        m['screens'][scene]={'status':'observed-modular-native-assets-ready','referencePart':scene+'-reference','background':'native-black','portraitRect':advisor_rect,'textRect':[16,16,288,40],'houseVariants':advisor_variants,
          'artRects':[{'sourceRect':advisor_rect,'role':'advisor','live':True},{'sourceRect':[144,48,176,104],'role':'visible-map-right','live':True,'optional':True}],
          'controls':[{'id':'continue','nativeButton':'C','meaning':'Original text-page continuation.'}],
          'animationRecipe':{'mode':'live-original-frame','portraitRect':advisor_rect},'fixtureScope':outcome_scope}
    result='house1-mission01-victory-results-000008';final_result='house1-mission09-victory-results-000008'
    if result in capture_index:
        reference('results-reference',result)
        layer_part('results-desert-background',result,'plane-b',[0,0,320,224],True)
        layer_part('results-soldier-scene',result,'plane-b',[0,128,320,96],True)
        layer_part('native-gold-sky',result,'plane-b',[0,0,8,8],True);m['parts']['native-gold-sky'].update({'role':'fill','repeat':'xy'})
        m['screens']['results']={'status':'observed-modular-native-assets-ready','referencePart':'results-reference','background':'native-black','nativeBackgroundPart':'results-desert-background','backgroundFillPart':'native-gold-sky','staticHeroPart':None,'previewDecorPart':'results-soldier-scene','sourceRect':[0,16,320,192],'portraitRect':None,'textRect':[24,24,272,176],
          'artRects':[{'sourceRect':[0,0,320,224],'role':'native-results-background','live':False,'part':'results-desert-background'}],
          'controls':[{'id':'continue','nativeButton':'C','meaning':'Continue only after original result state is ready.'}],
          'nativeValuesRule':'Use the live original statistics/rank/timer. This asset pipeline never calculates or invents scores. The clean planeB contains no score labels/values.',
          'fixtureScope':outcome_scope}
        vr=raw(result,'vram.bin');pal=raw(result,'palette.rgb');assert rom[0x50c34+32*32:0x50c34+127*32]==vr[(0x500+32)*32:(0x500+127)*32]
        atlas=bytearray(128*48*4);glyphs={};glyphs_meta={}
        for code in range(32,127):
            glyph=bytearray(8*8*4);tile=0x500+code;gx=(code-32)%16*8;gy=(code-32)//16*8
            for yy in range(8):
                for xx in range(8):
                    b=vr[tile*32+yy*4+xx//2];n=b&15 if xx&1 else b>>4;at=(yy*8+xx)*4;glyph[at:at+4]=pal[(32+n)*3:(33+n)*3]+bytes([255 if n else 0])
            glyphs[code]=bytes(glyph)
            for yy in range(8):atlas[((gy+yy)*128+gx)*4:((gy+yy)*128+gx+8)*4]=glyph[yy*32:(yy+1)*32]
            glyphs_meta[str(code)]={'x':gx,'y':gy,'width':8,'height':8,'char':chr(code),'nativeTile':tile}
        assert image_crop(indexed(result,'plane-a'),320,[104,24,8,8],4)==glyphs[48]
        fid=emit('font-statistics-native',128,48,atlas,4,{'capture':result,'nativeTileBase':0x500,'paletteLane':2,'sourceRomGlyphBase':0x50c34,'validation':'All95 glyphs exactly equal original ROM; rendered native SCORE zero cell equals exported0 RGBA pixel-for-pixel.','alphaSource':'Original4bpp zero nibble; native yellow8 and blackF shadow retained.'})
        m['fonts']['statsValue']={**m['fonts']['textShadow'],'path':m['parts'][fid]['path'],'nativeTileBase':0x500,'paletteLane':2,'glyphNibble':8,'foregroundNibble':8,'shadowNibble':15,'sourceRomGlyphBase':0x50c34,'foregroundRgb':[255,255,0],'glyphs':glyphs_meta,'validation':'ROM0x50C34+ASCII*32 full95 glyph identity; exact native SCORE0 cell equality.','specialCode64':'Native control glyph; some unused control symbols have uninitialized palette colours. Use native text/numeric value strings only.'}
    if final_result in capture_index:
        layer_part('results-final-tanks-background',final_result,'plane-b',[0,0,320,224],True)
        layer_part('results-final-tanks-scene',final_result,'plane-b',[0,104,320,120],True)
        m['screens']['results']['campaignCompleteVariant']={'background':'native-black','nativeBackgroundPart':'results-final-tanks-background','staticHeroPart':None,'previewDecorPart':'results-final-tanks-scene','sourceScope':'Actual original final-mission result background.'}
    password_display='house1-mission01-next-password-000008'
    if password_display in capture_index:
        reference('password-display-reference',password_display)
        layer_part('password-display-desert-background',password_display,'plane-b',[0,0,320,224],True)
        m['screens']['password_display']={'status':'observed-modular-native-assets-ready','referencePart':'password-display-reference','background':'native-black','nativeBackgroundPart':'password-display-desert-background','backgroundFillPart':'native-gold-sky','staticHeroPart':None,'previewDecorPart':'results-soldier-scene','sourceRect':[0,0,320,224],'portraitRect':None,'textRect':[48,48,224,64],
          'artRects':[{'sourceRect':[0,128,320,96],'role':'native-desert-soldier','live':True}],
          'controls':[{'id':'continue','nativeButton':'C'}],'fixtureScope':outcome_scope,'nativeValuesRule':'Native code/password/progression fields are read from original state. No code is created by this art pipeline.'}
    ending_variants={}
    for house in range(3):
        name='house'+str(house)+'-ending-000008';credits='house'+str(house)+'-credits-000008'
        if name not in capture_index:continue
        aid=layer_part('ending-planet-house-'+str(house),name,'plane-b',[0,0,320,224],True)
        label=layer_part('ending-label-house-'+str(house),name,'plane-a',[128,212,56,8])
        ending_variants[str(house)]={'houseId':house,'background':aid,'endingLabelPart':label,'sourceRect':[0,0,320,224]}
        m['houses'].setdefault(str(house),{'houseId':house})['endingBackgroundPart']=aid
        if house==1:reference('ending-reference',name)
        if credits in capture_index and house==1:reference('credits-reference',credits)
        # Exact final map ownership/colours are separate optional decorations;
        # never use the first-map illustration as a simulation of completion.
        debrief='house'+str(house)+'-mission09-victory-000008'
        if debrief in capture_index:
            bg=background_rgb(debrief);rect=[72,48,248,104];emit('campaign-final-map-house-'+str(house),248,104,crop(bg,rect),extra={'capture':debrief,'sourceRect':rect,'sourceLayer':'Original completed-phase background planes, native sprites omitted.','fixtureScope':outcome_scope},category='art')
    if ending_variants:
        m['screens']['ending']={'status':'observed-modular-native-assets-ready','referencePart':'ending-reference','background':'native-black','nativePlanetBackgroundPart':ending_variants['1']['background'],'houseVariants':ending_variants,'portraitRect':None,'textRect':None,
          'artRects':[{'sourceRect':[0,0,320,224],'role':'native-ending-planet','live':True}],
          'controls':[{'id':'continue','nativeButton':'C','meaning':'Original ending/credits timing and continuation.'}],
          'animationRecipe':{'mode':'live-original-frame','sourceRect':[0,0,320,224],'rule':'Native palette recolours the planet for the winning house. These are3 actual captures; no colour replacement was applied.'},'fixtureScope':outcome_scope}
        m['screens']['credits']={'status':'observed-modular-native-assets-ready','referencePart':'credits-reference','background':'native-black','nativePlanetBackgroundPart':ending_variants['1']['background'],'houseVariants':ending_variants,'portraitRect':None,'textRect':[0,0,320,224],
          'sourceRect':[0,0,320,224],'artRects':[{'sourceRect':[0,0,320,224],'role':'native-scrolling-credits','live':True}],
          'controls':[{'id':'continue','nativeButton':'C','meaning':'Only the original credit continuation/skip behavior, if ready.'}],
          'animationRecipe':{'mode':'live-original-frame','sourceRect':[0,0,320,224],'rule':'Preserve the original full scrolling credits composition and timing. Do not substitute a fixed text crop or a recorded clip.'},'fixtureScope':outcome_scope}
    if 'statsValue' in m['fonts']:
        stats_vram=raw(result,'vram.bin');title_vram=raw(title,'vram.bin')
        assert stats_vram[0x2f5*32:0x2f6*32]==title_vram[(0x480+58)*32:(0x481+58)*32]
        m['fonts']['statsValue']['glyphOverrides']={'58':{'font':'uiShadow','nativeTile':0x2f5,'sourceRect':[256,24,8,8],'reason':'The original clock uses this static white colon between yellow digits. Its4bpp pattern exactly equals uiShadow colon; preserve original white punctuation without recolouring.'}}
    starport='starport-000001'
    if starport in capture_index:
        assert capture_index[starport][0].get('currentVdpRgbMismatchBytes')==0
        frame=capture_index[starport][1]
        for aid,rect,rows in [('starport-radar-native',[40,8,88,16],[(0,88)]*16),('starport-bar-bank-native',[272,36,16,48],([(0,16)]*7+[(0,0)])*6)]:
            x,y,w,h=rect;rgb=crop(frame,rect);rgba=bytearray(w*h*4)
            for yy,(lo,hi) in enumerate(rows):
                for xx in range(w):
                    at=yy*w+xx;rgba[at*4:at*4+4]=rgb[at*3:at*3+3]+bytes([255 if lo<=xx<hi else 0])
            emit(aid,w,h,rgba,4,{'capture':starport,'sourceRect':rect,'sourceLayer':'Actual completed original Starport frame, literal RGB.','alphaGeometry':{'rowRuns':rows,'meaning':'Radar is an intentionally opaque rectangular black plot; the bank preserves six original7px recessed slots and omits only1px exterior body gaps.'},'animationMode':'live-original-frame','timingRule':'Copy current original RGB inside this fixed native contour. No recorded pseudo-random animation is replayed.'},category='chrome')
        m['starportChrome']={'nativeContext':3,'radarPart':'starport-radar-native','bankPart':'starport-bar-bank-native','radarSourceRect':[40,8,88,16],'bankSourceRect':[272,36,16,48],
          'nativeSlotCount':6,'warning':'Yard radar/lamps/vents sourceRects refer to different Starport artwork. Never sample those Yard regions from a Starport frame.',
          'compatibleSharedRects':{'portrait':[160,40,96,56],'name':[160,104,96,8]},
          'cellBackgroundProof':{'enabledRgb':[145,145,182],'disabledCommandRgb':[36,36,72],'nativeSamples':[[34,74],[66,74],[98,74],[34,98]],'renderRule':'Keep the accepted shared frame static, sample only correctly mapped Starport decorations live. Expanded native unit-cell padding must match original plate fill, not the gray outer Starport cabinet.'}}
    native_font=(ROOT/'.local/shop-layout-raw/menu-vram.bin').read_bytes();font_start=0x4f6c8
    assert rom[font_start+32*32:font_start+127*32]==native_font[(0x400+32)*32:(0x400+127)*32]
    for code in range(97,123):assert native_font[(0x400+code)*32:(0x401+code)*32]==native_font[(0x400+code-32)*32:(0x401+code-32)*32]
    for key in ['ui','uiMask','textMask']:
        if key in m['fonts']:m['fonts'][key].update({'sourceRomGlyphBase':font_start,'romProof':'All95 original glyph patterns32..126 exactly equal ROM bytes at0x4F6C8+ASCII*32.','lowercaseRule':'Original lowercase ASCII codes97..122 contain the same uppercase letter patterns65..90; this is preserved exactly.'})
    for item in m['screens'].get('house-choice',{}).get('houses',[]):
        item.update({k:v for k,v in m['houses'].get(str(item['houseId']),{}).items() if k in ['portraitPart','portraitRect']})
        item['sourcePoint']=[72 if item['houseId']==1 else 160 if item['houseId']==2 else 248,100]
    for scene in ['briefing','house_briefing']:
        for item in m['screens'].get(scene,{}).get('controls',[]):item['sourcePoint']=[232,172 if item['id'] in ['proceed','yes'] else 196]
    # Exact scene-name contract consumed by game-ui.mjs. Each entry has the
    # same fields, even when a natural capture is still explicitly pending.
    aliases={'house':'house-choice','campaign':'campaign-map','main':'main-menu','house_choice':'house-choice','main_menu':'main-menu','pause':'pause-options','confirm':'confirmation','password_display':'password'}
    for target,source_name in aliases.items():
        if source_name in m['screens'] and target not in m['screens']:m['screens'][target]={**m['screens'][source_name],'aliasOf':source_name}
    for key in ['house_briefing','briefing','victory_movie','victory','defeat_movie','defeat','results','password_display','ending','credits','confirm','options','pause']:
        m['screens'].setdefault(key,{'status':'natural-capture-pending'})
    for entry in m['screens'].values():
        for field,default in [('background',None),('staticHeroPart',None),('portraitRect',None),('textRect',None),('artRects',[]),('controls',[])]:entry.setdefault(field,default)
    evidence_path=ROOT/'.local/screen-assets-evidence/captures.json';evidence_path.parent.mkdir(parents=True,exist_ok=True)
    evidence_path.write_text(json.dumps(captures,ensure_ascii=False,indent=2)+'\n')
    used_captures={p['capture'] for p in m['parts'].values() if 'capture' in p}
    m['evidence']={'captureIndex':str(evidence_path.relative_to(ROOT)),'captureIndexSha256':sha(evidence_path.read_bytes()),'actualSourceCaptures':len(captures),'shippingRule':'Only referenced canonical captures are in the shipping manifest. Complete raw source index and oracle captures stay local; no duplicate movie frames are shipped.'}
    m['captures']={key:value for key,value in captures.items() if key in used_captures};m['coverage']={'actualSourceCaptures':len(captures),'screenAssetsReady':[n for n,s in m['screens'].items() if s['status']=='observed-modular-native-assets-ready'],'note':'Captures are retained as local evidence metadata; only canonical reference frames and modular artwork are shipped. Pending screens are not claimed complete.'}
    # This package owns its generated PNG outputs; remove obsolete generated
    # reference frames from prior extraction runs, never any source material.
    paths={p['path'] for p in m['parts'].values()}
    for old in out.rglob('*.png'):
        if str(old.relative_to(out)) not in paths:old.unlink()
    m['extractorSha256']=sha(Path(__file__).read_bytes());m['nativeExtractorSha256']=sha((ROOT/'tools/extract_screen_assets_native.c').read_bytes());m['coverage']['pendingNativeArt']= [k for k,v in m['screens'].items() if not v['status'].startswith('observed')];m['coverage']['legacyOnly']=['password'];m['pngCount']=len(list(out.rglob('*.png')));m['pngBytes']=sum(p.stat().st_size for p in out.rglob('*.png'))
    (out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    (out/'README.md').write_text('''# Native Sega USA screen assets

This is a separate original-pixel art package for the responsive interface.
No ROM, original gameplay, scenario, balance, live runtime or frozen shop kit
was modified by this extraction. The source ROM/generated-C hashes are pinned
in manifest.json; the normal95-glyph bank is additionally verified against
literal ROM bytes at0x4F6C8, the statistics font at0x50C34.

## Ready native screen pieces

- Boot: separate Virgin/Westwood logos, copyright artwork and starfield.
- Title/main: planet/starfield planeB, separate DUNE logo/subtitle/license and
  native labels. The background contains no native menu-button text.
- Houses: three original emblems/crests/nameplates in original ID order
  0Harkonnen,1Atreides,2Ordos; three advisor RGBA portraits.
- House/mission briefings and outcomes: original map pieces, gold YES/NO and
  PROCEED/ADVICE buttons, native advisor LIVE frame recipes.
- Victory/defeat movies: native304x120 previews and LIVE original frame crops.
- Results: clean soldier/tank planeB backgrounds and native yellow-value font.
- Options/pause: truly label-free helmet/landscape fragments. The full original
  WINDOW backdrop is also retained as reference and honestly marked as having
  baked labels; no hidden helmet pixels were invented or inpainted.
- Confirmation: original blue/white sprite bezel with native-index alpha,
  reusable4px corners/edges and verified opaque-black interior.
- Ending/credits: three actually captured red/blue/green planets, original
  THE END label and full LIVE scrolling-credit recipe. No recorded movie loop
  is substituted for native timing.
- Starport: a separate live native88x16 radar plot and16x48 six-slot green
  bank. Their contours/sourceRects differ from the Yard lamps and radar; do not
  sample Yard regions from a Starport frame or replay a recorded blink loop.
- The legacy password keyboard/art is retained as reference; the post-result
  password display is a different native scene and has its own recipe.

All exact native scene-name keys have background, staticHeroPart, portraitRect,
textRect, artRects and controls fields. Nulls are intentional. Movie sourceRect
is[8,40,304,120]; advisor portraitRect is[0,80,144,144], proven to contain every
actor pixel over192 completed native frames across all three houses. Results
have no staticHeroPart: preserve live values until a native-stats table is ready.
Credits keep their whole[0,0,320,224] source so names cannot be clipped as they
scroll. Native continuation/availability remains authoritative.

## Native UI pieces

command-skin-normal/disabled modules use the genuine original1px command bevel.
The pressed preview is explicitly normal native fill plus the original red
selection frame, not a claim of a separate original depressed-button image.
command-focus0..3 retain the original8-frame colour pulse. back-menu-arrow-native
is the original silver pointer turned180degrees by a lossless pixel permutation.

Fonts ui/Mask/Shadow retain their native8px patterns; textMask/textShadow extend
through ASCII126. statsValue is the genuine original yellow statistics font.
Native lowercase codes contain uppercase visual forms and remain unchanged.
Some original control glyphs (notably64) are not standard ASCII punctuation;
never invent replacement characters or recolour these font pixels.

## Reproduction

Requires the user-supplied USA ROM, pinned generated original source, original
native CPU fixture and existing frozen shop extraction evidence in this workspace.

```sh
clang -std=c11 -O1 tools/extract_screen_assets_native.c -o .local/extract-screen-assets -lm
mkdir -p .local/screen-assets-phase-raw .local/screen-options-raw .local/screen-campaign-raw .local/screen-houses-raw .local/screen-outcomes-raw
.local/extract-screen-assets --boot .local/screen-assets-phase-raw 2400 60
.local/extract-screen-assets --fixture .local/screen-assets-phase-raw/boot-poll-0178d2.cpu.bin .local/screen-assets-phase-raw title-menu 64 1
.local/extract-screen-assets --options ../dune-web/data/evidence/mission-atreides-01.cpu.bin .local/screen-options-raw
```

The native campaign fixture tools tools/test_em_web_campaign.c and
 tools/capture_campaign_scenes.c produce .local/campaign-fixtures/ and
.local/campaign-scenes/. Use the recorder --fixture mode for house-picker64frames,
house-confirm16frames, campaign-briefing96frames (stride1) in screen-campaign-raw.
Use --houses with the natural house-picker.cpu.bin to reproduce all three
picker->YES advisor samples. Capture each outcome CPU with --fixture for16frames,
stride8, preserving its basename as prefix in screen-outcomes-raw. Then run:

```sh
python3 tools/extract_screen_assets.py
```

Every indexed layer used for modular artwork must exactly recompose the completed
original frame (zero mismatched RGB bytes). Alpha comes from native4bpp indices
or explicitly documented source geometry, never an RGB colour key. Complex art
keeps its proportions; only declared straight strips/flat fills may repeat.
Raw capture/index evidence stays in.local/screen-assets-evidence and is not
shipped as hundreds of duplicate frames.

Outcome captures use controlled offline setup (original quota checker or
original Building_Free), followed by the original win/lose/movie/debrief/stats/
ending/credits branches without scene-PC jumps. They prove native art and state
rendering; they are not claims of player-earned campaign completion. Individual
text pages, every possible score/rank, and every alternate outcome/house/mission
combination are not separately claimed as a complete screenshot matrix.
''',encoding='utf8')
    print(f'Exported {m["pngCount"]} PNGs / {m["pngBytes"]} bytes; {len(captures)} actual source captures -> {out}')
if __name__=='__main__':main()
