/* Regression against the real Harkonnen demonstration's original Devastators. */
#define main special_action_main
#define EM_TEST_WORLD_INTENT
#include "test_em_web_actions_special.c"
#undef main
static CPU imm;
static unsigned hover_x,hover_y;
static uint64_t redraw_frame;
static unsigned redraws;
static void browser_step(void){step();if(hover_x&&em_cpu.vdp.frames!=redraw_frame){redraw_frame=em_cpu.vdp.frames;if(em_web_selection.operation==EM_ACTION_SELF||em_web_selection.operation==EM_ACTION_RESELECT){dune_mouse_world_point(&em_host.dune_mouse,&em_cpu,hover_x,hover_y);++redraws;}}}
static void self_wait(void){unsigned old=em_web_selection.native_selfs;uint64_t end=em_cpu.vdp.frames+180;while(em_cpu.vdp.frames<end&&(em_web_selection.native_selfs==old||em_web_selection.operation||em_web_selection.phase||em_host.dune_mouse.count||em_host.dune_mouse.stage))browser_step();require(idle()&&em_web_selection.native_selfs==old+1,"native self API completes once");}
int main(int argc,char**argv){const char*path=argc>1?argv[1]:".local/demo-fixture-harkonnen/demo.cpu.bin";FILE*f=fopen(path,"rb");require(f&&fread(&baseline,sizeof baseline,1,f)==1,"real Harkonnen demo CPU");fclose(f);
 for(unsigned n=0;n<4;n++){reset();hover_x=hover_y=redraws=0;unsigned id=(n&1)?40:37,unit=0x1000+id*140,tile;
  require(dune_word(&em_cpu,unit)==id&&em_cpu.ram[unit+2]==11&&em_cpu.ram[unit+8]==0,"original Harkonnen Devastator identity");
  unsigned a=native_a,b=native_b,r=map_returns;
  require(em_web_world_intent_queue(&em_host.dune_mouse,&em_cpu,dune_word(&em_cpu,unit+12)/8,dune_word(&em_cpu,unit+10)/8),"shipping generic world A queues actual unit selection");
  require(wait_dispatch(a,b,r,120)&&!em_web_world_intent.active,"generic intent releases only after actual native A");
  require(dune_long(&em_cpu,0xc25c)==0xff0000+unit,"normal actual-world click selects original unit");
  require(em_web_self_tile(0xff0000+unit,&tile),"self target available");printf("BEFORE id%u world%u,%u chosenTile%u(%u,%u) selected%06x frame%llu\n",id,dune_word(&em_cpu,unit+12)/8,dune_word(&em_cpu,unit+10)/8,tile,tile&63,tile/64,dune_long(&em_cpu,0xc25c),(unsigned long long)em_cpu.vdp.frames);fflush(stdout);
  if(n>=2){hover_x=dune_word(&em_cpu,unit+12)/8-32;hover_y=dune_word(&em_cpu,unit+10)/8;redraw_frame=em_cpu.vdp.frames;}
  imm=em_cpu;require(dune_web_action_self(),"queue real self action");require(!memcmp(&imm,&em_cpu,sizeof em_cpu),"self queue is read-only");self_wait();printf("AFTER redraws%u %s\n",redraws,dune_web_actions_debug());fflush(stdout);
  require(n<2||redraws>0,"stale browser render hover actually exercised");
  require(em_web_selection.order_target==0xff0000+unit,"original A hit actual actor, not a neighboring move cell");
  require((dune_word(&em_cpu,unit+6)&128)&&em_cpu.ram[unit+15]>0&&em_web_selection.self_result==1&&dune_long(&em_cpu,0xc25c)==0xff0000+unit,"real demo Devastator self action arms and reselects instead of moving");
 }
 puts("PASS both real demo Devastators self-A native arming/reselect; no actor/flags/timer/HP fixture writes");return 0;
}
