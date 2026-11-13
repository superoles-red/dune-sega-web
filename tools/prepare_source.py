#!/usr/bin/env python3
"""Patch browser host/input adapters. Original Sega instructions/data stay identical."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
base=(ROOT/'.local/source/build/dune-base.c').read_text()
identity=json.loads((ROOT/'docs/source-identity.json').read_text())
assert hashlib.sha256(base.encode()).hexdigest()==identity['generatedSourceSha256']
s=base
# Music/SFX percentages belong only to host output, never to CPU/save state or
# original driver commands. GEMS physical-voice flags preserve the source class
# through voice stealing, logical-channel reuse, DAC playback and release tails.
needle='static void audio_sync(CPU *c);'
assert s.count(needle)==2
s=s.replace(needle,'#include "em_web_audio_levels.h"\n'+needle,1)
needle='for(unsigned i=0;i<3;++i)output+=(p->polarity&(1u<<i) ? 1:-1)*amplitude[p->volume[i]&15];'
assert s.count(needle)==1
s=s.replace(needle,'for(unsigned i=0;i<3;++i)output+=em_web_audio_level_sample((p->polarity&(1u<<i) ? 1:-1)*amplitude[p->volume[i]&15],em_web_audio_psg_levels[i]);',1)
needle='output+=(p->noise_lfsr&1 ? 1:-1)*amplitude[p->volume[3]&15];'
assert s.count(needle)==1
s=s.replace(needle,'output+=em_web_audio_level_sample((p->noise_lfsr&1 ? 1:-1)*amplitude[p->volume[3]&15],em_web_audio_psg_levels[3]);',1)
needle='if(!a->initialized && !audio_init(c,NULL))return;'
assert s.count(needle)==1
s=s.replace(needle,needle+'\n    em_web_audio_levels_sync(c);',1)
# Keep the original per-pixel compositor as an oracle and wide-call fallback.
# The browser fast path only reuses immutable scanline/tile/palette values;
# VDP timing, state, sprites and every translated game instruction stay intact.
needle='static void vdp_render_pixels(VDP *v,unsigned width,unsigned height,const uint8_t *sprites,uint8_t *frame) {'
assert s.count(needle)==1
s=s.replace(needle,needle.replace('vdp_render_pixels(', 'vdp_render_pixels_reference('),1)
# Keep a read-only VDP snapshot at the exact completed-frame boundary. Native
# instructions, the live VDP, the frame and all game state remain untouched.
needle='static void vdp_render(CPU *c) {'
assert s.count(needle)==1
s=s.replace(needle,'#include "em_web_raster.h"\n#include "em_web_frame.h"\n'+needle,1)
needle='    ++v->rendered_frames;'
assert s.count(needle)==1
s=s.replace(needle,needle+'\n    em_web_frame_capture(c);',1)
# The browser composes every non-battle screen itself. Never let an unfinished
# native menu/title frame leak through the full-screen SDL canvas underneath it.
# Completed VDP RGB remains intact and is still the UI's authoritative source.
needle='static int dune_view_draw(SDLHost *h,CPU *c){'
assert s.count(needle)==1
s=s.replace(needle,'''static int em_web_original_video;
static int em_web_campaign_world_visible(const CPU *c);
static int em_web_campaign_battle_presentation(const CPU *c);
static int em_web_campaign_world_hold(const CPU *c);
static SDLHost *em_web_last_world_host;static DuneLayout em_web_last_world_layout;
static int em_web_last_world_w,em_web_last_world_h;
'''+needle,1)
needle='    DuneLayout p=dune_view_map(c)?dune_view_host_layout(h,c,w,hg):dune_view_layout(c,w,hg,h->dune_view.zoom);'
start=s.index('static int dune_view_draw(SDLHost *h,CPU *c){')
end=s.index('\nstatic ',start+20)
segment=s[start:end]
assert segment.count(needle)==1
segment=segment.replace(needle,'''    if(!em_web_original_video && !em_web_campaign_world_visible(c)){
        if(SDL_SetRenderDrawColor(h->renderer,0,0,0,255) || SDL_RenderClear(h->renderer))return sdl_host_error(h,"Dune UI transition clear failed");
        if(em_web_campaign_world_hold(c)&&em_web_last_world_host==h&&h->dune_world&&h->dune_hud&&em_web_last_world_w>0&&em_web_last_world_h>0){
            DuneLayout *last=&em_web_last_world_layout;float sx=(float)w/em_web_last_world_w,sy=(float)hg/em_web_last_world_h;
            SDL_FRect world={0,0,(float)(h->dune_width*last->world_scale)*sx,(float)(h->dune_height*last->world_scale)*sy};
            SDL_Rect top={0,0,320,144},bottom={0,144,320,80};
            SDL_FRect t={(float)(em_web_last_world_w-320*last->ui_scale)*sx,0,(float)(320*last->ui_scale)*sx,(float)(144*last->ui_scale)*sy};
            SDL_FRect b={t.x,(float)(em_web_last_world_h-80*last->ui_scale)*sy,t.w,(float)(80*last->ui_scale)*sy};
            if(SDL_RenderCopyF(h->renderer,h->dune_world,NULL,&world)||SDL_RenderCopyF(h->renderer,h->dune_hud,&top,&t)||SDL_RenderCopyF(h->renderer,h->dune_hud,&bottom,&b))return sdl_host_error(h,"Dune held world draw failed");
        }
        h->last_frame=v->rendered_frames;SDL_RenderPresent(h->renderer);return 1;
    }
'''+needle,1)
segment=segment.replace('    DuneLayout p=dune_view_map(c)?', '    int adapted=dune_view_map(c)||(!em_web_original_video&&em_web_campaign_battle_presentation(c));\n    DuneLayout p=adapted?')
segment=segment.replace('    if(!dune_view_map(c)){','    if(!adapted){',1)
segment=segment.replace('        dune_view_pointer(h,c);','        if(dune_view_map(c))dune_view_pointer(h,c);',1)
needle='    if(!dune_cpu_draw(h,c))'
assert segment.count(needle)==1
segment=segment.replace(needle,'    if(adapted){em_web_last_world_host=h;em_web_last_world_layout=p;em_web_last_world_w=w;em_web_last_world_h=hg;}\n'+needle,1)
s=s[:start]+segment+s[end:]
# HTML menus and building screens already compose the authoritative native RGB.
# Skip only the hidden SDL canvas upload/present; service/input/audio keep running.
service_start=s.index('__attribute__((noinline, used)) int sdl_host_service(')
s=s[:service_start]+'static int em_web_canvas_presentable(void);\n'+s[service_start:]
needle='if (redraw || h->last_frame!=c->vdp.rendered_frames)'
assert s.count(needle)==1
s=s.replace(needle,'if (em_web_canvas_presentable() && (redraw || h->last_frame!=c->vdp.rendered_frames))',1)
# Forward declarations allow the instruction loop to call later input adapters.
a=s.index('static void em_main_loop_iter(void) {')
b=s.index('\n#endif\n\n__attribute__((noinline, used)) int run_main',a)
s=s[:a]+'''#define EM_WEB_MODERN_INPUT 1
static void em_web_selection_observe(void);
static int em_web_menus_observe(DuneMouse *m,CPU *c);
static int em_web_menu_select_observe(DuneMouse *m,CPU *c);
static int em_web_campaign_observe(CPU *c);
#include "em_web_host.h"
EMSCRIPTEN_KEEPALIVE int dune_web_audio_levels(int music,int sound){return em_web_audio_levels_set(music,sound);}
#include "em_web_camera.h"
#include "em_web_selection.h"
#include "em_web_menus.h"
#include "em_web_menu_select.h"
#include "em_web_building_ui.h"
#include "em_web_training.h"
#include "em_web_campaign.h"
'''+s[b:]
# A preview is persistent UI intent, not a mouse-hover state. Reset it on an
# actual successful state load; ordinary SDL leave/focus events may reset the
# pointer without discarding the item information the player is reading.
needle='static CPU em_cpu;'
assert s.count(needle)==1
s=s.replace(needle,needle+'\nstatic void em_web_menu_select_reset_state(void);\nstatic void em_web_campaign_after_load(CPU *c);\nstatic void em_web_audio_flush(void);',1)
# The visible camera is controlled only by drag/pinch, independently of the
# small native camera which the original mouse adapter needs for offscreen input.
needle='if(!m->camera_hold && !v->pointer_valid){'
assert s.count(needle)==1;s=s.replace(needle,'if(0){',1)
needle='}else if(!m->count && (m->pan_x || m->pan_y)){'
assert s.count(needle)==1;s=s.replace(needle,'}else if(0){',1)
# Disable edge-hover scrolling, retaining pointer positioning for native menus
# and the original building-placement ghost.
a=s.index('static void dune_view_pointer(')
b=s.index('static int dune_view_event(',a)
segment=s[a:b]
c=segment.index('    if(world && h->window){')
brace=segment.index('{',c);depth=1;d=brace+1
while depth:
 if segment[d]=='{':depth+=1
 elif segment[d]=='}':depth-=1
 d+=1
segment=segment[:c]+'    /* No edge-hover scrolling. Drag/pinch own presentation movement. */\n'+segment[d:]
s=s[:a]+segment+s[b:]
# Native menus keep their original aspect ratio; building screens alone
# are recomposed in portrait. This shared layout also owns pointer projection.
s=s.replace('static DuneLayout dune_view_layout(', '#include "em_web_present.h"\n#include "em_web_portrait.h"\nstatic DuneLayout dune_view_layout(',1)
needle='p.ui_x=(w-c->vdp.frame_width*p.ui_scale)/2;p.ui_y=(h-c->vdp.frame_height*p.ui_scale)/2;'
assert s.count(needle)==1
s=s.replace(needle,needle+"\n    if(h>w && (dune_mouse_context(c)==2 || dune_mouse_context(c)==3))p.ui_y=h-c->vdp.frame_height*p.ui_scale;",1)
# Reuse the original sprite traversal on a shadow CPU. Menu passes preserve
# the native focus frame (BF86 / Starport BFC6) on the selected button.
needle='static int dune_view_sprites(DuneView *v,const CPU *source,int left,int top,uint8_t *sprites,int ui){'
assert s.count(needle)==1
s=s.replace(needle,'#include "em_web_ready.h"\n'+needle,1)
needle='CPU *c=v->shadow;memcpy(c,source,sizeof *c);c->audio_mode=AUDIO_STUB;'
assert s.count(needle)==1
s=s.replace(needle,needle+'\n    if(ui<2 && !em_web_ready_overlay(c,source,em_web_cursor_preview(source))){memcpy(c,source,sizeof *c);c->audio_mode=AUDIO_STUB;}',1)
needle='        if(at==dune_word(c,0xbf18)){'
assert s.count(needle)==1
s=s.replace(needle,'        em_web_frame_project_flyover(c,source,at,v->left,v->top,v->width,v->height,ui);\n'+needle,1)
needle='    uint8_t sprites[320*224];\n    for(unsigned by=0;by<v->height;'
assert s.count(needle)==1
s=s.replace(needle,'    v->left=p->left;v->top=p->top;\n'+needle,1)
needle='c->ram[at+4]=2;at=dune_word(c,at+14);'
assert s.count(needle)==1
s=s.replace(needle,'em_web_ready_freeze_sprite(c,source,at);at=dune_word(c,at+14);',1)
needle='unsigned head=dune_word(c,0xf3ac),at=head;'
assert s.count(needle)==1
s=s.replace(needle,'unsigned head=dune_word(c,ui>=2?0xf5b4:0xf3ac),at=head;',1)
needle='if(at==dune_word(c,0xbf18)){'
assert s.count(needle)==1
s=s.replace(needle,"""if(ui>=2){
            /* Keep the original red selection frame on the active menu cell.
             * Ordinary map cursors remain hidden in the separate map path. */
        }else if(at==dune_word(c,0xbf52)){
            c->ram[at+7]|=0x80;
        }else if(at==dune_word(c,0xbf18)){""",1)
needle='int hide_cursor=d->pointer_valid && !h->dune_mouse.point_world;'
assert s.count(needle)==1
s=s.replace(needle,'int hide_cursor=!em_web_cursor_preview(c);',1)
# The original completed VDP frame already includes the menu focus and every
# animation at the correct raster phase. Menus need no shadow sprite replay
# now that their focus is visible again; live mid-frame RAM can be one update
# ahead of the last displayed sprite list.
needle='static int dune_view_build(DuneView *v,const CPU *c,const DuneLayout *p){'
assert s.count(needle)==1
helper="""#include "em_web_world_raster.h"
static const uint8_t *em_web_menu_frame(DuneView *v,const CPU *c){
    (void)v;
    return c->vdp.frame;
}
"""
s=s.replace(needle,helper+needle,1)
# Widen only the expanded-world presentation buffer to opaque RGBA. The native
# VDP frame/exports and separate native-menu texture remain their original RGB.
# Every replacement names the exact world allocation, coordinate or texture;
# no global pixel-stride substitution can touch an original frame or HUD.
needle='size_t size=(size_t)p->world_width*p->world_height*3;'
assert s.count(needle)==1
s=s.replace(needle,'size_t size=(size_t)p->world_width*p->world_height*4;',1)
# The original chunk bounds, shadow CPU copy/sprite traversal and all source
# RGB values are unchanged; the new fourth byte is always opaque255.
needle='''        for(unsigned y=0;y<bh;++y)for(unsigned x=0;x<bw;++x){
            unsigned a,b;int wx=p->left+bx+x,wy=p->top+by+y;
            dune_view_terrain(c,wx,wy,&a,&b);
            unsigned s=sprites[(y+16)*320+x+32];
            uint8_t *out=v->pixels+((by+y)*v->width+bx+x)*3;
            if(wx<0 || wy<0 || wx>=2048 || wy>=2048)memset(out,0,3);
            else dune_view_rgb(&v->shadow->vdp,a,b,s,out);
        }'''
assert s.count(needle)==1
s=s.replace(needle,'''        em_web_world_raster_chunk(c,&v->shadow->vdp,
            p->left+(int)bx,p->top+(int)by,bw,bh,
            sprites+16*320+32,320,v->pixels+((size_t)by*v->width+bx)*4,(size_t)v->width*4);''',1)
needle='memcpy(v->pixels+((unsigned)yy*v->width+(unsigned)xx)*3,c->vdp.frame+at*3,3);'
assert s.count(needle)==1
s=s.replace(needle,'{uint8_t *out=v->pixels+((unsigned)yy*v->width+(unsigned)xx)*4;memcpy(out,c->vdp.frame+at*3,3);out[3]=255;}',1)
needle='SDL_CreateTexture(h->renderer,SDL_PIXELFORMAT_RGB24,SDL_TEXTUREACCESS_STREAMING,d->width,d->height)'
assert s.count(needle)==1
s=s.replace(needle,'SDL_CreateTexture(h->renderer,SDL_PIXELFORMAT_RGBA32,SDL_TEXTUREACCESS_STREAMING,d->width,d->height)',1)
needle='if(!h->dune_world)return sdl_host_error(h,"Dune world texture failed");'
assert s.count(needle)==1
s=s.replace(needle,'if(!h->dune_world || SDL_SetTextureBlendMode(h->dune_world,SDL_BLENDMODE_NONE))return sdl_host_error(h,"Dune world texture failed");',1)
needle='SDL_UpdateTexture(h->dune_world,NULL,d->pixels,d->width*3)'
assert s.count(needle)==1
s=s.replace(needle,'SDL_UpdateTexture(h->dune_world,NULL,d->pixels,d->width*4)',1)
needle='SDL_UpdateTexture(h->texture,NULL,v->frame,v->frame_width*3)'
assert s.count(needle)==1
s=s.replace(needle,'SDL_UpdateTexture(h->texture,NULL,em_web_menu_frame(&h->dune_view,c),v->frame_width*3)',1)
needle='if(!dune_cpu_draw(h,c))return sdl_host_error(h,"Dune CPU overlay failed");'
assert s.count(needle)==1
s=s.replace(needle,"""if(dune_view_map(c)){
        EmWebMinimap m=em_web_native_minimap(c);
        if(m.visible){
            EmWebMiniRect r=em_web_minimap_view(m,p.left,p.top,p.world_width,p.world_height);
            float scale=(float)p.ui_scale;
            float x=(float)(w-320*p.ui_scale)+(float)(m.x+r.x)*scale;
            float y=(float)(hg-224*p.ui_scale)+(float)(m.y+r.y)*scale;
            float thick=scale<1?1:scale;
            float rw=(float)r.w*scale,rh=(float)r.h*scale;
            float cw=fminf(3*scale,(rw+thick)/2),ch=fminf(3*scale,(rh+thick)/2);
            SDL_FRect lines[8]={{x,y,cw,thick},{x+rw-cw,y,cw,thick},
                {x,y+rh-thick,cw,thick},{x+rw-cw,y+rh-thick,cw,thick},
                {x,y,thick,ch},{x+rw-thick,y,thick,ch},
                {x,y+rh-ch,thick,ch},{x+rw-thick,y+rh-ch,thick,ch}};
            SDL_SetRenderDrawColor(h->renderer,220,228,240,255);
            if(SDL_RenderFillRectsF(h->renderer,lines,8))return sdl_host_error(h,"Dune minimap viewport failed");
            SDL_SetRenderDrawColor(h->renderer,0,0,0,255);
        }
    }
    if(!dune_cpu_draw(h,c))return sdl_host_error(h,"Dune CPU overlay failed");""",1)
# Portrait menu uses three original live framebuffer crops. Input shares the
# same transform; black gaps have no invisible old click targets.
needle='if(!dune_view_map(c)){\n        *x=(int)((px-p.ui_x)/p.ui_scale);'
assert s.count(needle)==1
s=s.replace(needle,"""if(!dune_view_map(c)){
        EmWebPortraitLayout portrait;
        if(em_web_portrait_layout(dune_mouse_context(c),ww,wh,w,hg,&portrait))return em_web_portrait_hit(&portrait,px,py,x,y);
        *x=(int)((px-p.ui_x)/p.ui_scale);""",1)
needle='if(SDL_UpdateTexture(h->texture,NULL,em_web_menu_frame(&h->dune_view,c),v->frame_width*3) || SDL_RenderCopyF(h->renderer,h->texture,NULL,&to))return sdl_host_error(h,"Dune native draw failed");'
assert s.count(needle)==1
s=s.replace(needle,"""if(SDL_UpdateTexture(h->texture,NULL,em_web_menu_frame(&h->dune_view,c),v->frame_width*3))return sdl_host_error(h,"Dune native upload failed");
        EmWebPortraitLayout portrait;
        if(em_web_portrait_layout(dune_mouse_context(c),window_w,window_h,w,hg,&portrait)){
            for(int i=0;i<portrait.count;++i){
                EmWebPortraitRegion *r=&portrait.regions[i];
                SDL_Rect from={r->src.x,r->src.y,r->src.w,r->src.h};
                SDL_FRect dest={(float)r->dst.x,(float)r->dst.y,(float)r->dst.w,(float)r->dst.h};
                if(SDL_RenderCopyF(h->renderer,h->texture,&from,&dest))return sdl_host_error(h,"Dune portrait draw failed");
            }
        }else if(SDL_RenderCopyF(h->renderer,h->texture,NULL,&to))return sdl_host_error(h,"Dune native draw failed");""",1)
s=s.replace('#define DUNE_SAVESTATE_VERSION 1','#define DUNE_SAVESTATE_VERSION 2',1)
s=s.replace('if (!em_window || size < (int)sizeof(DuneSaveState)) return 0;', 'if (!em_window || size < (int)sizeof(DuneSaveState) || size > (int)sizeof(g_dune_state_buffer)) return 0;',1)
s=s.replace('if ((int)s->total_size > size) return 0;','if (s->total_size != (uint32_t)size || s->ym_size > sizeof(g_dune_state_buffer)-sizeof(*s) || sizeof(*s)+s->ym_size != (size_t)size) return 0;',1)
s=s.replace('em_host.last_frame = 0;\n    return 1;', '''em_host.last_frame = UINT64_MAX;
    em_host.stopped = 0;
    if(em_host.audio_device)SDL_ClearQueuedAudio(em_host.audio_device);
    em_host.audio_running = 0;
    em_web_audio_flush();
    dune_mouse_reset(&em_host.dune_mouse);
    em_web_menu_select_reset_state();
    em_web_campaign_after_load(&em_cpu);
    em_host.dune_view.camera_valid = 0;
    em_host.dune_view.frame = UINT64_MAX;
    return 1;''',1)
needle='em_cpu.audio.next_sample = em_cpu.master_cycles;'
assert s.count(needle)==1
s=s.replace(needle,'em_cpu.audio.sample_index=em_cpu.master_cycles*AUDIO_RATE/vdp_master_frequency(&em_cpu.vdp)+1;\n    em_cpu.audio.next_sample=em_cpu.audio.sample_index*vdp_master_frequency(&em_cpu.vdp)/AUDIO_RATE;',1)
marker='static const uint8_t rom_data[] = {'
assert s.split(marker,1)[1]==base.split(marker,1)[1]
(ROOT/'.local/source/build/dune-web.c').write_text(s)
# Keep pinned source inputs untouched. The build compiles this prepared adapter
# with the original YMFM include directory, rather than modifying vendor files.
audio=(ROOT/'.local/source/genesis_recompiler/audio_ymfm.cpp').read_text()
needle='class GenesisYM final : public ymfm::ymfm_interface {'
assert audio.count(needle)==1
audio=audio.replace(needle,(ROOT/'tools/em_web_audio_levels_cpp.h').read_text()+'\n'+needle,1)
needle='ymfm::ym2612 chip;'
assert audio.count(needle)==1
audio=audio.replace(needle,'DuneOutputYM2612 chip;',1)
needle='int32_t((int64_t(current.data[i])-previous.data[i])*fraction/144);'
assert audio.count(needle)==1
audio=audio.replace(needle,needle+'\n        for(unsigned i=0;i<2;++i)stereo[i]=chip.level_output(i,fraction,stereo[i]);',1)
needle='extern "C" void genesis_ymfm_destroy(void *chip)'
assert audio.count(needle)==1
audio=audio.replace(needle,'''extern "C" void genesis_ymfm_output_levels(void *chip,const unsigned levels[6]) {
    if(!chip||!levels)return;
    auto &g=*static_cast<GenesisYM*>(chip);
    bool changed=false;
    for(unsigned c=0;c<6;++c){
        unsigned value=levels[c];
        switch(value){
            case 0:case 10:case 25:case 50:case 100:break;
            default:value=100;
        }
        changed|=g.chip.levels[c]!=value;
        g.chip.levels[c]=value;
    }
    if(changed){g.chip.common_level=int(g.chip.levels[0]);for(unsigned c=1;c<6;++c)if(g.chip.levels[c]!=g.chip.levels[0])g.chip.common_level=-1;}
}
'''+needle,1)
(ROOT/'.local/source/build/dune-web-audio.cpp').write_text(audio)
headers={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'tools').glob('em_web_*.h'))}
report={'baseSourceSha256':identity['generatedSourceSha256'],'patchedSourceSha256':hashlib.sha256(s.encode()).hexdigest(),'patchedAudioSourceSha256':hashlib.sha256(audio.encode()).hexdigest(),'originalRomAndInstructionHandlersUnchanged':True,'adapterHeaders':headers,'patchScope':['browser clock and pause','map-only single presentation per browser callback','exact-pixel scanline VDP raster; original oracle/fallback retained','drag camera; no edge hover','CSS pointer and pinch projection','single native selection, pure clear and contextual B; original building placement','preview then confirm native purchases; direct commands; original active menu focus; hidden ordinary map cursor and three-part portrait menu','output-only independent music/SFX levels; original GEMS physical voice ownership, PCM source clocks and save ABI retained','bounded v2 save validation and renderer reset']}
(ROOT/'docs/build-source.json').write_text(json.dumps(report,indent=2)+'\n')
print('Prepared host/input patches; original translated instructions and ROM unchanged.')
