/* Input-only latency regression on a genuine authored red-demo CPU + YMFM.
 * No original instructions, entity fields, prices or clocks are patched.
 * The local legacy observer is the preceding shipping implementation, retained
 * as a positive control for the hidden-camera traversal delay. */
#define GENESIS_NO_MAIN
#define GENESIS_AUDIO
#include "../.local/source/build/dune-base.c"
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
static CPU em_cpu,original,fixture,cpu_before,noinput_reference,matched_input_reference;
static struct {int paused,stopped;DuneMouse dune_mouse;}em_host;
static int em_window=1;
#include "em_web_world_intent.h"
#include "em_web_selection.h"
static EmWebWorldIntent legacy;
static unsigned legacy_mode,dispatches,returns,last_tile;
static uint64_t popped_frame,dispatch_frame;
static uint8_t reference_pcm[1024*1024],actual_pcm[1024*1024];
static size_t pcm_bytes;
static void check(int value,const char*message){if(value)return;fprintf(stderr,"FAIL %s pc%x frame%llu mode%u fault%s\n",message,em_cpu.pc,(unsigned long long)em_cpu.vdp.frames,legacy_mode,em_cpu.reason?em_cpu.reason:"none");exit(1);}
/* Exact former observer logic; its host target is still locked through native
 * A, but q.world requires DuneMouse to walk the small native camera first. */
static void legacy_observe(DuneMouse*m,const CPU*c){
 EmWebWorldIntent*s=&legacy;if(!s->active)return;
 if(s->owner!=c||c->fault||!m->enabled||c->pad_buttons[0]||dune_mouse_context(c)!=1||c->steps<s->steps||c->master_cycles<s->cycles||m->clicks<s->clicks||(!m->count&&m->clicks==s->clicks)){s->active=0;return;}
 s->steps=c->steps;s->cycles=c->master_cycles;
 if(c->pc==0x27b80&&m->clicks>s->clicks){s->active=0;return;}
 m->point_world=1;m->wx=s->wx;m->wy=s->wy;m->dirty=1;
 if(m->tile_valid){m->tile_wx=s->wx;m->tile_wy=s->wy;}
 if(m->count){DuneClick*q=&m->queue[m->head];q->world=1;q->wx=s->wx;q->wy=s->wy;}
}
static void reset(void){
 em_cpu=fixture;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.reason=NULL;em_cpu.fault=0;em_cpu.audio_mode=AUDIO_MUTE;em_cpu.audio.fm=NULL;memset(em_cpu.pad_buttons,0,sizeof em_cpu.pad_buttons);
 memset(&em_host,0,sizeof em_host);em_host.dune_mouse.enabled=1;dune_web_selection_reset();memset(&legacy,0,sizeof legacy);dispatches=returns=last_tile=0;popped_frame=dispatch_frame=0;
}
static void step(void){
 DuneMouse*m=&em_host.dune_mouse;int active=legacy_mode?legacy.active:em_web_world_intent.active;if(active)cpu_before=em_cpu;
 if(legacy_mode)legacy_observe(m,&em_cpu);else em_web_world_intent_observe(m,&em_cpu);
 if(active)check(!memcmp(&cpu_before,&em_cpu,sizeof em_cpu),"active world-intent observation changes zero CPU bytes");
 em_web_selection_observe();uint64_t clicks=m->clicks;dune_mouse_observe(m,&em_cpu);
 if(m->clicks>clicks)popped_frame=em_cpu.vdp.frames;
 if(em_cpu.pc==0x27b80){++dispatches;dispatch_frame=em_cpu.vdp.frames;last_tile=em_cpu.d[3]&4095;}
 if(em_cpu.pc==0xe57a)++returns;
 machine_step(&em_cpu);check(!em_cpu.fault,"original machine execution");
}
static void frames(unsigned n){uint64_t end=em_cpu.vdp.frames+n;while(em_cpu.vdp.frames<end)step();}
static void queue(int x,int y){
 DuneMouse*m=&em_host.dune_mouse;cpu_before=em_cpu;
 if(legacy_mode){unsigned count=m->count;uint64_t clicks=m->clicks;dune_mouse_world_click(m,&em_cpu,x,y,DUNE_CLICK_SELECT);check(m->count==count+1,"legacy edge queued");legacy=(EmWebWorldIntent){&em_cpu,1,x,y,clicks,em_cpu.steps,em_cpu.master_cycles,0};}
 else check(em_web_world_intent_queue(m,&em_cpu,x,y),"shipping edge queued");
 check(!memcmp(&cpu_before,&em_cpu,sizeof em_cpu),"queue changes zero CPU bytes");
}
typedef struct{unsigned delay,pop_delay,tile,unit,building,kind,action,actor,target,target_kind,source;uint32_t camera_x,camera_y;}Result;
static Result click(int x,int y){
 uint64_t frame=em_cpu.vdp.frames;unsigned a=dispatches,r=returns,saw_dispatch=0,return_at_dispatch=r;queue(x,y);uint64_t end=frame+240;
 while(em_cpu.vdp.frames<end){step();if(!saw_dispatch&&dispatches>a){saw_dispatch=1;return_at_dispatch=returns;}if(saw_dispatch&&returns>return_at_dispatch&&!em_host.dune_mouse.count&&!em_host.dune_mouse.stage)break;}
 check(dispatches==a+1&&saw_dispatch&&returns>return_at_dispatch,"exactly one original A completes");
 check(last_tile==(unsigned)(y/32*64+x/32),"original A receives exact requested tile");
 return (Result){dispatch_frame-frame,popped_frame-frame,last_tile,dune_long(&em_cpu,0xc25c),dune_long(&em_cpu,0xc578),em_web_selection.order_kind,em_web_selection.order_action,em_web_selection.order_actor,em_web_selection.order_target,em_web_selection.order_target_kind,em_web_selection.order_source,dune_word(&em_cpu,0xe3ec),dune_word(&em_cpu,0xe3ee)};
}
static void same_action(Result a,Result b){check(a.tile==b.tile&&a.unit==b.unit&&a.building==b.building&&a.kind==b.kind&&a.action==b.action&&a.actor==b.actor&&a.target==b.target&&a.target_kind==b.target_kind&&a.source==b.source,"fast and legacy paths retain original selector/action/actor/target");}
static void case_at(const char*name,int x,int y,unsigned kind){
 Result reference={0};for(legacy_mode=1;;legacy_mode=0){reset();unsigned cx=dune_word(&em_cpu,0xe3ec),cy=dune_word(&em_cpu,0xe3ee);if(kind==1||kind==2){click(560,944);check(dune_long(&em_cpu,0xc25c)==0xff0000+0x1000+37*140,"original Devastator selected");frames(10);}if(kind==3){click(424,1032);frames(10);click(424,1032);frames(10);check(dune_word(&em_cpu,0xdc4c),"original Palace armed");}
  Result actual=click(x,y);if(legacy_mode){reference=actual;if(!strcmp(name,"near-building"))matched_input_reference=em_cpu;continue;}
  same_action(reference,actual);check(actual.delay<=4&&actual.delay<=reference.delay,"visible world tap dispatched within four native frames");check(actual.camera_x==cx&&actual.camera_y==cy,"fast tap does not move hidden native camera");
  if(!strcmp(name,"near-building"))check(!memcmp(&matched_input_reference,&em_cpu,sizeof em_cpu),"matched-tick ordinary original A preserves the complete CPU/device state");
  if(strstr(name,"building"))check(em_web_action_live(actual.building,1),"actual original building selected");
  if(!strcmp(name,"far-unit"))check(actual.unit==0xff0000+0x1000+37*140,"actual original Devastator selected");
  if(kind==1)check(actual.kind==1&&actual.source==0x281bc,"original move handler retained");
  if(kind==2)check(actual.kind==2&&actual.source==0x281bc&&actual.target_kind==2,"original attack on building retained");
  if(kind==3)check(actual.kind==3&&actual.source==0x27ea6&&actual.tile==1618,"original Palace target retained");
  printf("PASS %s world%d,%d legacyA%uframes fastA%uframes (%ums ->%ums at60Hz) tile%u nativeCamera%u,%u retained\n",name,x,y,reference.delay,actual.delay,reference.delay*1000/60,actual.delay*1000/60,actual.tile,actual.camera_x,actual.camera_y);fflush(stdout);break;
 }
}
static void noinput_audio(void){
 uint8_t expected_ym[2048],actual_ym[2048],ym[2048];size_t ym_size=0,wanted_pcm=0;FILE*f=fopen(".local/demo-fixture-harkonnen/demo.ym.bin","rb");check(f!=NULL,"genuine red YMFM state");ym_size=fread(ym,1,sizeof ym,f);fclose(f);
 for(legacy_mode=1;;legacy_mode=0){reset();em_cpu.audio_mode=AUDIO_ON;em_cpu.audio.fm=genesis_ymfm_load_state(ym,ym_size);check(em_cpu.audio.fm!=NULL,"real chip state restored");em_cpu.audio.wav=NULL;em_cpu.audio.playback=1;em_cpu.audio.read=em_cpu.audio.count=0;pcm_bytes=0;uint64_t end=em_cpu.vdp.frames+120;
  while(em_cpu.vdp.frames<end){uint64_t frame=em_cpu.vdp.frames;step();if(em_cpu.vdp.frames!=frame){int16_t samples[AUDIO_RING_FRAMES*2];unsigned n=audio_pop(&em_cpu,samples,AUDIO_RING_FRAMES);check(pcm_bytes+n*4<=sizeof reference_pcm,"bounded PCM capture");memcpy((legacy_mode?reference_pcm:actual_pcm)+pcm_bytes,samples,n*4);pcm_bytes+=n*4;}}
  size_t chip_size=genesis_ymfm_state_size(em_cpu.audio.fm);check(chip_size<=sizeof expected_ym,"bounded chip state");check(genesis_ymfm_save_state(em_cpu.audio.fm,legacy_mode?expected_ym:actual_ym,chip_size),"chip state serialized");void*chip=em_cpu.audio.fm;em_cpu.audio.fm=NULL;
  if(legacy_mode){noinput_reference=em_cpu;wanted_pcm=pcm_bytes;}else{check(!memcmp(&em_cpu,&noinput_reference,sizeof em_cpu),"no-input whole CPU/device state remains byte-identical");check(wanted_pcm==pcm_bytes&&pcm_bytes>0&&!memcmp(reference_pcm,actual_pcm,pcm_bytes),"every original no-input PCM byte remains identical");check(!memcmp(expected_ym,actual_ym,chip_size),"genuine YMFM state remains byte-identical");printf("PASS no-input120nativeframes: CPU%zu bytes, PCM%zu bytes, YMFM%zu bytes, masterCycles%llu steps%llu all identical\n",sizeof em_cpu,pcm_bytes,chip_size,(unsigned long long)em_cpu.master_cycles,(unsigned long long)em_cpu.steps);}
  genesis_ymfm_destroy(chip);if(!legacy_mode)break;
 }
}
int main(void){FILE*f=fopen(".local/demo-fixture-harkonnen/demo.cpu.bin","rb");check(f&&fread(&original,sizeof original,1,f)==1,"genuine red demo source");fclose(f);fixture=original;
 printf("Mission rectangle x%u..%u y%u..%u\n",dune_word(&fixture,0xe3d2),dune_word(&fixture,0xe3d4)+fixture.vdp.frame_width,dune_word(&fixture,0xe3ce),dune_word(&fixture,0xe3d0)+fixture.vdp.frame_height);
 case_at("near-building",424,1032,0);case_at("far-building",104,840,0);case_at("far-empty-cell",1200,1200,0);case_at("unit-move",1200,1200,1);case_at("unit-attack",104,840,2);case_at("Palace",589,826,3);
 legacy_mode=1;reset();click(1200,1200);fixture=em_cpu;case_at("far-unit",560,944,0);fixture=original;
 reset();cpu_before=em_cpu;DuneMouse mouse=em_host.dune_mouse;check(!em_web_world_intent_direct_point(&em_host.dune_mouse,&em_cpu,2048,2048),"out-of-mission point retains legacy reachability");check(!memcmp(&cpu_before,&em_cpu,sizeof em_cpu)&&!memcmp(&mouse,&em_host.dune_mouse,sizeof mouse),"out-of-mission check changes no CPU or pointer state");queue(1200,1200);em_web_selection_drop_mouse_queue();frames(12);check(!dispatches,"cancelled intent never dispatches a delayed command");puts("PASS out-of-mission guard and explicit cancellation");
 noinput_audio();return 0;
}
