/* Host presentation differential with actual authored map CPU, real YMFM,
 * and the actual expanded-world software raster. SDL's event/audio boundary
 * uses the existing deterministic stand-in; no physical-device timing claim. */
#define main legacy_host_audio_main
#include "test_em_web_host_audio.c"
#undef main
static CPU map_fixture,map_reference,render_before,expected_states[121];
static int expected_geometry[121][6],expected_advanced[121];
static unsigned partial_callbacks,partial_pixel_changes;
static uint8_t map_ym[2048],expected_ym[2048],actual_ym[2048];
static size_t map_ym_n;
static uint64_t raster_builds,pixel_hash,expected_pixels[121];
static unsigned poll_pause,poll_calls;
static uint64_t image_hash(const DuneView*v){
 uint64_t result=1469598103934665603ull;
 for(size_t i=0;i<(size_t)v->width*v->height*3;i++)result=(result^v->pixels[i])*1099511628211ull;
 for(size_t i=0;i<320*224*4;i++)result=(result^v->ui[i])*1099511628211ull;
 return result;
}
static int raster(SDLHost*h,CPU*c){
 if(!dune_view_map(c))return 1;
 render_before=*c;DuneLayout p=dune_view_host_layout(h,c,412,915);
 check(dune_view_build(&h->dune_view,c,&p),"actual expanded-world raster completes");
 check(!memcmp(&render_before,c,sizeof *c),"actual raster changes zero native CPU/device bytes");
 ++raster_builds;pixel_hash=image_hash(&h->dune_view);
 return 1;
}
static void poll_input(SDLHost*h,CPU*c){(void)c;++poll_calls;if(poll_pause){poll_pause=0;h->paused=1;}}
/* This is the immediately preceding batched host callback, before map-only
 * presentation deferral. Its two services poll input/audio just as before. */
static void previous_callback(void){
 if(!em_window)return;double now=emscripten_get_now();
 if(em_web_hidden){em_web_clock_due(&em_web_clock,now,vdp_master_frequency(&em_cpu.vdp),1);return;}
 check(em_web_service(),"previous pre-service");
 if(em_cpu.fault||(em_cpu.halted&&!machine_can_wake(&em_cpu))){sdl_host_stop(&em_host,&em_cpu);em_web_clock_reset(&em_web_clock,now);return;}
 uint32_t hz=vdp_master_frequency(&em_cpu.vdp);uint64_t due=em_web_clock_due(&em_web_clock,now,hz,em_host.paused);
 if(em_host.paused||!due)return;uint64_t budget=hz/15u;if(due<budget)budget=due;
 uint64_t start=em_cpu.master_cycles,target=start+budget;
 while(em_cpu.master_cycles<target){if(em_cpu.fault||(em_cpu.halted&&!machine_can_wake(&em_cpu)))break;dune_mouse_observe(&em_host.dune_mouse,&em_cpu);machine_step(&em_cpu);}
 em_web_clock_consume(&em_web_clock,em_cpu.master_cycles-start);check(em_web_service(),"previous final-service");
 if(em_host.paused)em_web_clock_reset(&em_web_clock,emscripten_get_now());
}
static void release_world(void){free(em_host.dune_view.pixels);free(em_host.dune_view.ui);free(em_host.dune_view.shadow);}
static void load_map(void){
 em_cpu=map_fixture;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.reason=NULL;em_cpu.fault=0;memset(em_cpu.pad_buttons,0,sizeof em_cpu.pad_buttons);
 em_cpu.audio.fm=genesis_ymfm_load_state(map_ym,map_ym_n);check(em_cpu.audio.fm!=NULL,"real authored map chip restored");
 em_cpu.audio_mode=AUDIO_ON;em_cpu.audio.wav=NULL;em_cpu.audio.read=em_cpu.audio.count=0;em_cpu.audio.playback=1;
 memset(&em_host,0,sizeof em_host);em_host.audio_device=1;em_host.dune_volume=100;em_host.dune_mouse.enabled=1;em_host.dune_mouse.context=1;em_host.dune_mouse.camera_hold=1;
 em_host.last_frame=em_cpu.vdp.rendered_frames;now_ms=0;em_window=1;em_web_hidden=0;em_web_canvas_visible_flag=1;em_web_canvas_deferred=0;em_web_audio_external=0;
 em_web_clock_reset(&em_web_clock,0);services=presents=queued_frames=0;pcm_hash=1469598103934665603ull;pcm_frames=0;raster_builds=0;test_present_hook=raster;
 test_service_hook=poll_input;poll_calls=poll_pause=0;
 check(dune_view_map(&em_cpu),"actual authored map context");
}
static void camera(unsigned i){
 DuneView*v=&em_host.dune_view;v->camera_valid=1;v->camera_x=dune_word(&em_cpu,0xe3ec)+(int)(i%20)*3;v->camera_y=dune_word(&em_cpu,0xe3ee)+(int)(i%15)*2;
 v->frame=UINT64_MAX;em_host.last_frame=UINT64_MAX;
}
int main(void){
 FILE*f=fopen(".local/demo-fixture-harkonnen/demo.cpu.bin","rb");check(f&&fread(&map_fixture,sizeof map_fixture,1,f)==1,"actual authored red map source");fclose(f);
 f=fopen(".local/demo-fixture-harkonnen/demo.ym.bin","rb");check(f!=NULL,"actual paired map YM state");map_ym_n=fread(map_ym,1,sizeof map_ym,f);fclose(f);
 uint64_t wanted_pcm=0,wanted_frames=0,old_builds=0;unsigned old_polls=0;size_t ym_n=0;
 for(unsigned mode=0;mode<2;mode++){
  load_map();
  for(unsigned i=1;i<=120;i++){
   queued_frames=queued_frames>800?queued_frames-800:0;now_ms=i*1000.0/60;camera(i);
   uint64_t builds=raster_builds,rendered_before=em_cpu.vdp.rendered_frames;if(mode)em_web_main_loop_iter();else previous_callback();
   check(!em_cpu.fault,"actual original map machine remains healthy");
   if(mode){
    check(raster_builds==builds+1,"pan produces exactly one expensive expanded raster per callback");
    CPU copy=em_cpu;normalize(&copy);
    check(!memcmp(&copy,&expected_states[i],sizeof copy),"complete native CPU/device state matches preceding callback at EVERY matched cycle boundary");
    DuneView oracle={0},*visible=&em_host.dune_view;DuneLayout p=dune_view_layout(&em_cpu,412,915,visible->zoom);
    p.left=visible->left;p.top=visible->top;oracle.cursor_valid=visible->cursor_valid;oracle.cursor_hidden=visible->cursor_hidden;oracle.cursor_x=visible->cursor_x;oracle.cursor_y=visible->cursor_y;
    render_before=em_cpu;check(dune_view_build(&oracle,&em_cpu,&p),"direct unchanged original renderer accepts final native CPU/layout");
    check(image_hash(&oracle)==pixel_hash,"EVERY final world/HUD pixel equals direct unchanged renderer of final native CPU/layout");
    check(!memcmp(&render_before,&em_cpu,sizeof em_cpu),"direct pixel oracle mutates zero native CPU/device bytes");
    free(oracle.pixels);free(oracle.ui);free(oracle.shadow);
    check(expected_advanced[i]==(em_cpu.vdp.rendered_frames!=rendered_before),"both callback policies cross identical native VDP boundaries");
    if(expected_advanced[i])check(pixel_hash==expected_pixels[i],"old/new visible pixels match whenever the native VDP completed a frame");
    else{++partial_callbacks;if(pixel_hash!=expected_pixels[i])++partial_pixel_changes;printf("INFO callback%u has no VBlank: rendered%llu->%llu; old pre-step/new final-step source, same native CPU and direct-original RGB oracle\n",i,(unsigned long long)rendered_before,(unsigned long long)em_cpu.vdp.rendered_frames);}
   }else{
    expected_pixels[i]=pixel_hash;expected_states[i]=em_cpu;normalize(&expected_states[i]);expected_advanced[i]=em_cpu.vdp.rendered_frames!=rendered_before;
    DuneView*d=&em_host.dune_view;int g[]={d->left,d->top,(int)d->width,(int)d->height,d->camera_x,d->camera_y};memcpy(expected_geometry[i],g,sizeof g);
   }
  }
  CPU actual=em_cpu;normalize(&actual);
  if(!mode){map_reference=actual;wanted_pcm=pcm_hash;wanted_frames=pcm_frames;old_builds=raster_builds;old_polls=services;ym_n=genesis_ymfm_state_size(em_cpu.audio.fm);check(ym_n<=sizeof expected_ym&&genesis_ymfm_save_state(em_cpu.audio.fm,expected_ym,ym_n),"save actual reference chip");}
  else{
   check(!memcmp(&actual,&map_reference,sizeof actual),"all original CPU/device bytes identical at matched native cycles");
   check(pcm_hash==wanted_pcm&&pcm_frames==wanted_frames,"every original stereo PCM byte retained exactly once");
   check(genesis_ymfm_save_state(em_cpu.audio.fm,actual_ym,ym_n)&&!memcmp(expected_ym,actual_ym,ym_n),"actual YMFM chip state byte-identical");
   check(old_builds==240-partial_callbacks&&raster_builds==120&&old_polls==240&&services==240&&poll_calls==240,"two input/audio polls retained while expensive pan rasters halve");
   check(!em_web_canvas_deferred,"presentation deferral never leaks out of callback");
   printf("PASS120actual map-pan callbacks: expanded rasters%llu->%llu, input/audio services%u->%u; direct-original RGB/HUD pixels at every final source; CPU%zuB, PCM%llu frames and YMFM%zuB identical\n",(unsigned long long)old_builds,(unsigned long long)raster_builds,old_polls,services,sizeof actual,(unsigned long long)pcm_frames,ym_n);printf("PASS partial-native-frame source sampling: %u callbacks, %u expected old-pre/new-final pixel boundary differences; completed-native-frame pixels unchanged\n",partial_callbacks,partial_pixel_changes);
  }
  genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;release_world();
 }
 /* No due cycles still exposes an invalidated camera once, while paused and
  * explicitly hidden cases retain their previous presentation semantics. */
 load_map();camera(1);em_web_main_loop_iter();check(raster_builds==1&&services==2&&em_cpu.master_cycles==map_fixture.master_cycles&&!em_web_canvas_deferred,"no-due map callback presents camera once without native advancement");
 unsigned s=services;em_host.paused=1;camera(2);em_web_main_loop_iter();check(raster_builds==2&&services==s+1&&!em_web_canvas_deferred,"already paused map keeps one original service/presentation");
 s=services;uint64_t r=raster_builds;em_web_hidden=1;camera(3);em_web_main_loop_iter();check(raster_builds==r&&services==s&&!em_web_canvas_deferred,"hidden callback performs no canvas/input/audio work");
 em_web_hidden=0;em_host.paused=0;em_host.stopped=1;camera(4);em_web_clock_reset(&em_web_clock,now_ms);em_web_main_loop_iter();check(raster_builds==r+1&&services==s+1&&!em_web_canvas_deferred,"stopped no-due map retains one original display pass");
 genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;release_world();puts("PASS no-due, paused, hidden and stopped presentation branches");
 load_map();camera(1);now_ms=1000.0/60;poll_pause=1;uint64_t native_cycles=em_cpu.master_cycles;em_web_main_loop_iter();check(poll_calls==2&&presents==1&&raster_builds==1&&em_host.paused&&em_cpu.master_cycles==native_cycles&&!em_web_canvas_deferred,"pre-service pause input is consumed before any simulation and still presents once");genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;release_world();
 load_map();camera(1);em_cpu.halted=1;em_cpu.sr=0x2700;native_cycles=em_cpu.master_cycles;em_web_main_loop_iter();check(em_host.stopped&&services==2&&presents==1&&raster_builds==1&&em_cpu.master_cycles==native_cycles&&!em_web_canvas_deferred,"unwakeable map halt still presents exactly once before original stop");genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;release_world();
 load_map();camera(1);em_cpu.fault=1;em_cpu.reason="fixture fault guard";native_cycles=em_cpu.master_cycles;em_web_main_loop_iter();check(em_host.stopped&&services==1&&presents==1&&em_cpu.master_cycles==native_cycles&&!em_web_canvas_deferred,"existing fault path retains original single presentation and stop");genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;release_world();
 load();test_service_hook=NULL;test_present_hook=raster;em_host.last_frame=UINT64_MAX;now_ms=1000.0/60;check(!dune_view_map(&em_cpu),"genuine frontend non-map reference");em_web_main_loop_iter();check(services==2&&presents==2&&!em_web_canvas_deferred,"non-map original presentation cadence is untouched");genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;
 puts("PASS pre-step input pause, halted/fault stop, and unchanged non-map presentation cadence");
 return 0;
}
