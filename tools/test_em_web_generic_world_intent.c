/* Exact real-demo Palace world-A target regression.
 * The legacy no-lock control reproduces the reported 1618 ->1682 error even
 * without stale SDL hover. Shipping host intent must retain the projected
 * world target until original $27B80 consumes A. No native target is written
 * by this test; original DuneMouse/native picker/action routines do the work. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
static CPU em_cpu,source,before;
static struct{DuneMouse dune_mouse;int paused,stopped;}em_host;
static int em_window=1;
#include "em_web_world_intent.h"
#include "em_web_selection.h"
#include <sys/stat.h>
static unsigned mode,target_click,redraws,committed,actual_target,first_input_tile;
static uint64_t popped_frame,consumed_frame;
static unsigned initial_camera_x,initial_camera_y;
static FILE*trace;
static void check(int ok,const char*message){if(!ok){fprintf(stderr,"FAIL mode%u %s pc%x frame%llu ctx%d target%u\n",mode,message,em_cpu.pc,(unsigned long long)em_cpu.vdp.frames,dune_mouse_context(&em_cpu),actual_target);exit(1);}}
static void record(const char*kind){DuneMouse*m=&em_host.dune_mouse;if(trace)fprintf(trace,"%s pc%06x frame%llu clicks%llu queue%u stage%u dirty%u wxwy%d,%d tilevalid%d tilewxwy%d,%d C240%u D3%u C1A8%u callback%x cursor%u,%u cam%u,%u locked%d\n",kind,em_cpu.pc,(unsigned long long)em_cpu.vdp.frames,(unsigned long long)m->clicks,m->count,m->stage,m->dirty,m->wx,m->wy,m->tile_valid,m->tile_wx,m->tile_wy,dune_word(&em_cpu,0xc240),em_cpu.d[3]&65535,dune_word(&em_cpu,0xc1a8),dune_long(&em_cpu,0xe002),dune_word(&em_cpu,0xbf12),dune_word(&em_cpu,0xbf14),dune_word(&em_cpu,0xe3ec),dune_word(&em_cpu,0xe3ee),em_web_world_intent.active);}
static void step(void){
 unsigned pc=em_cpu.pc;DuneMouse*m=&em_host.dune_mouse;
 if(target_click&&(pc==0x6e02||pc==0x6e06||pc==0x7016||pc==0x701c||pc==0x27b56||pc==0x27b80||pc==0x27e98||pc==0x27ea6))record("BEFORE");
 if(mode){before=em_cpu;em_web_selection_observe();check(!memcmp(&before,&em_cpu,sizeof em_cpu),"host lock/observer must not write CPU registers, RAM, palette, clocks or native targets");}
 uint64_t clicks=m->clicks;dune_mouse_observe(m,&em_cpu);
 if(target_click&&m->clicks>clicks)popped_frame=em_cpu.vdp.frames;
 if(target_click&&pc==0x701c){if(dune_word(&em_cpu,0xc240)==1618&&!first_input_tile)first_input_tile=1618;record("AFTERINPUT");}
 if(target_click&&pc==0x27b80){consumed_frame=em_cpu.vdp.frames;if(mode)check(!em_web_world_intent.active,"generic lock releases at actual original A entry");}
 if(target_click&&pc==0x27ea6){actual_target=dune_word(&em_cpu,0xc1a8);committed=1;record("SPECIAL_COMMITTED");}
 uint64_t frame=em_cpu.vdp.rendered_frames;machine_step(&em_cpu);check(!em_cpu.fault,"original native execution");
 if(mode==2&&target_click&&em_cpu.vdp.rendered_frames!=frame){dune_mouse_world_point(m,&em_cpu,589,858);++redraws;record("STALE_RENDER_HOVER");}
}
static void frames(unsigned count){uint64_t end=em_cpu.vdp.frames+count;while(em_cpu.vdp.frames<end&&!committed)step();}
static void queue(unsigned x,unsigned y){if(mode)check(em_web_world_intent_queue(&em_host.dune_mouse,&em_cpu,(int)x,(int)y),"shipping world-A intent queued");else dune_mouse_world_click(&em_host.dune_mouse,&em_cpu,(int)x,(int)y,DUNE_CLICK_SELECT);}
static void click(unsigned x,unsigned y){uint64_t n=em_host.dune_mouse.clicks,end=em_cpu.vdp.frames+240;queue(x,y);while(em_host.dune_mouse.clicks==n&&em_cpu.vdp.frames<end)step();check(em_host.dune_mouse.clicks==n+1,"one original A edge consumed");frames(40);}
int main(void){FILE*f=fopen(".local/demo-fixture-harkonnen/demo.cpu.bin","rb");check(f&&fread(&source,sizeof source,1,f)==1,"real red demonstration snapshot");fclose(f);mkdir(".local/palace-pointer-audit",0755);
 for(mode=0;mode<3;mode++){
  em_cpu=source;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.audio_mode=AUDIO_MUTE;em_cpu.fault=0;em_cpu.reason=NULL;memset(em_cpu.pad_buttons,0,sizeof em_cpu.pad_buttons);memset(&em_host,0,sizeof em_host);em_host.dune_mouse.enabled=1;memset(&em_web_selection,0,sizeof em_web_selection);em_web_world_intent_cancel();target_click=redraws=committed=actual_target=first_input_tile=0;popped_frame=consumed_frame=0;
  click(424,1032);click(424,1032);check(dune_word(&em_cpu,0xdc4c)!=0,"two original Palace A taps arm native Death Hand");initial_camera_x=dune_word(&em_cpu,0xe3ec);initial_camera_y=dune_word(&em_cpu,0xe3ee);
  char path[160];snprintf(path,sizeof path,".local/palace-pointer-audit/generic-mode%u.log",mode);trace=fopen(path,"w");check(trace!=NULL,"native trace output");target_click=1;queue(589,826);
  if(mode){DuneMouse mouse_before=em_host.dune_mouse;before=em_cpu;check(!em_web_world_intent_queue(&em_host.dune_mouse,&em_cpu,700,1100),"second pending target cannot replace first");check(!memcmp(&before,&em_cpu,sizeof em_cpu)&&!memcmp(&mouse_before,&em_host.dune_mouse,sizeof mouse_before),"rejected overlap leaves CPU and host queue unchanged");}
  frames(300);check(committed&&first_input_tile==1618,"native exact input tile observed before delayed special dispatch");check(popped_frame&&consumed_frame>popped_frame,"actual main-task A is consumed after queue pop");
  if(mode==0)check(actual_target==1682,"legacy control reproduces native free-cursor row drift without hover");else{check(actual_target==1618,"quiet and stale-hover paths preserve requested Palace cell");check(em_web_selection.order_kind==3&&em_web_selection.order_tile==1618,"shipping special-order observer reports the same exact original target");check(!em_web_world_intent.active,"completed intent remains released");}
  check(dune_word(&em_cpu,0xe3ec)!=initial_camera_x||dune_word(&em_cpu,0xe3ee)!=initial_camera_y,"native internal camera moved to reach target during this test");fclose(trace);trace=NULL;
  printf("PASS mode%u (%s): original27EA6 target%u, requested1618; queuepop%llu Aconsumer%llu redraws%u; nativecamera%u,%u->%u,%u; host observer CPU immutable\n",mode,mode==0?"legacy drift control":mode==1?"shipping quiet":"shipping stale render hover",actual_target,(unsigned long long)popped_frame,(unsigned long long)consumed_frame,redraws,initial_camera_x,initial_camera_y,dune_word(&em_cpu,0xe3ec),dune_word(&em_cpu,0xe3ee));fflush(stdout);
 }
 return 0;
}
