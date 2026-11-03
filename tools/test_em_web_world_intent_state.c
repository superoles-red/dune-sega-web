/* Host world-tap lifetime and reset boundaries. No action/CPU field is written
 * by the shipping helper. Negative setup mutates only host state/clock copies. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
static CPU em_cpu,baseline,before;
static struct{int paused,stopped;DuneMouse dune_mouse;}em_host;
static int em_window=1;
static uint64_t test_rebase;
#define EM_WEB_WORLD_INTENT_REBASE_TOKEN test_rebase
#include "em_web_world_intent.h"
#include "em_web_selection.h"
static void check(int ok,const char*m){if(!ok){fprintf(stderr,"FAIL %s\n",m);exit(1);}}
static void reset(void){em_cpu=baseline;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.reason=NULL;memset(&em_host,0,sizeof em_host);em_host.dune_mouse.enabled=1;test_rebase=1;dune_web_selection_reset();}
static void queue(void){before=em_cpu;check(em_web_world_intent_queue(&em_host.dune_mouse,&em_cpu,589,826),"one actual world A queued");check(!memcmp(&before,&em_cpu,sizeof em_cpu),"queue changes zero CPU bytes");}
int main(int argc,char**argv){const char*path=argc>1?argv[1]:".local/demo-fixture-harkonnen/demo.cpu.bin";FILE*f=fopen(path,"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"actual native source");fclose(f);
 reset();queue();check(!em_web_world_intent_queue(&em_host.dune_mouse,&em_cpu,1000,1000)&&em_host.dune_mouse.count==1&&em_web_world_intent.wx==589&&em_web_world_intent.wy==826,"fast second target cannot replace pending first A");before=em_cpu;em_web_selection_drop_mouse_queue();check(!em_web_world_intent.active&&!em_host.dune_mouse.count&&!memcmp(&before,&em_cpu,sizeof em_cpu),"explicit Clear/drop cancels host intent with zero CPU writes");
 reset();queue();before=em_cpu;dune_web_selection_reset();check(!em_web_world_intent.active&&!memcmp(&before,&em_cpu,sizeof em_cpu),"load selection reset cancels cached target without CPU writes");
 reset();queue();++test_rebase;before=em_cpu;em_web_world_intent_observe(&em_host.dune_mouse,&em_cpu);check(!em_web_world_intent.active&&!memcmp(&before,&em_cpu,sizeof em_cpu),"changed host rebase invalidates target without CPU writes");
 reset();queue();dune_mouse_reset(&em_host.dune_mouse);before=em_cpu;em_web_world_intent_observe(&em_host.dune_mouse,&em_cpu);check(!em_web_world_intent.active&&!memcmp(&before,&em_cpu,sizeof em_cpu),"lost/canceled native mouse queue invalidates intent");
 reset();queue();em_host.dune_mouse.enabled=0;before=em_cpu;em_web_world_intent_observe(&em_host.dune_mouse,&em_cpu);check(!em_web_world_intent.active&&!memcmp(&before,&em_cpu,sizeof em_cpu),"disabled input releases lock without CPU writes");
 reset();queue();em_cpu.steps--;before=em_cpu;em_web_world_intent_observe(&em_host.dune_mouse,&em_cpu);check(!em_web_world_intent.active&&!memcmp(&before,&em_cpu,sizeof em_cpu),"restored/rewound machine releases stale cached target");
 puts("PASS world input queue/reset/Clear/rebase/lostqueue/disabled/rewind, fast second target rejected without retarget; all shipping helper calls whole-CPU immutable");return 0;
}
