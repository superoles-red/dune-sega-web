/* Dedicated COMMAND vs original SINGLE on the genuine three-house fixtures.
 * The adapter only chooses the original target-vs-info input branch. Original
 * eligibility, allocation, scatter/damage/spawn/cooldown code executes intact. */
#define main prior_typed_input_main
#include "test_em_web_typed_input.c"
#undef main
static unsigned route_count,power_calls,info_calls,arm_calls,guard_mask,original_returns,oracle_checks;
static int capture_branch,have_branch,checked_branch,negative;
static CPU branch_start,branch_oracle,stable_fixture;
static uint32_t palace;
static int px,py;
static void trace_reset(void){route_count=power_calls=info_calls=arm_calls=guard_mask=original_returns=oracle_checks=0;capture_branch=have_branch=checked_branch=negative=0;}
static void power_step(void){
 unsigned pc=em_cpu.pc;
 if(pc==0x27bce&&em_web_typed.kind==EM_TYPED_COMMAND&&em_web_typed.phase==EM_TYPED_EXECUTING&&em_web_typed.armed&&em_cpu.a[3]==palace)++route_count;
 if(pc==0x27d28)++arm_calls;
 if(pc==0x27d3c)++info_calls;
 if(pc==0x22cc8)++power_calls;
 if(pc==0xe57a)++original_returns;
 if(em_web_typed.kind==EM_TYPED_COMMAND&&em_web_typed.phase==EM_TYPED_EXECUTING){
  if(pc==0x27d60){guard_mask|=1;
   if(negative){unsigned a=palace&65535,flags=dune_word(&em_cpu,a+6);
    /* Explicit isolated guard fixtures, never part of product input code. */
    if(negative==1)write_mem(&em_cpu,0xff0000+a+6,2,flags&~0x80u);
    if(negative==2)write_mem(&em_cpu,0xff0000+a+86,2,1);
    if(negative==3)write_mem(&em_cpu,0xff0000+a+6,2,flags|0x100u);
    if(negative==4)write_mem(&em_cpu,0xffdc4c,2,0);
    if(negative==5)write_mem(&em_cpu,0xff0000+a+6,2,flags&~0x8000u);
    if(negative==6)write_mem(&em_cpu,0xff0000+(dune_long(&em_cpu,0xc278)&65535)+4,2,0);
    negative=0;
   }
   if(capture_branch&&!have_branch){branch_start=em_cpu;have_branch=1;}
  }
  if(pc==0x27d76)guard_mask|=2;
  if(pc==0x27e6a)guard_mask|=4;
  if(pc==0x27e78)guard_mask|=8;
  if(pc==0x27e7e)guard_mask|=16;
  if(pc==0x27e8a)guard_mask|=32;
  if(pc==0x27e90)guard_mask|=64;
 }
 if(pc==0x27ea6&&capture_branch&&have_branch&&!checked_branch){
  /* Same entry CPU/layout/target, then execute the unmodified original branch
   * WITHOUT any adapter observation. This includes every resource/weapon
   * instruction up to the same original activation return boundary. */
  branch_oracle=branch_start;unsigned long steps=0;
  while(!branch_oracle.fault&&branch_oracle.pc!=0x27ea6&&steps++<2000000)machine_step(&branch_oracle);
  check(!branch_oracle.fault&&branch_oracle.pc==0x27ea6,"direct original guarded weapon branch returns");
  check(!memcmp(&branch_oracle,&em_cpu,sizeof em_cpu),"complete CPU/device state through original guarded weapon code is byte-identical without adapter");
  checked_branch=1;++oracle_checks;
 }
 step();
}
static void power_frames(unsigned n){uint64_t end=em_cpu.vdp.frames+n;while(em_cpu.vdp.frames<end)power_step();}
static void power_settle(void){uint64_t end=em_cpu.vdp.frames+180;do{power_step();}while(busy()&&em_cpu.vdp.frames<end);check(!busy(),"Palace input finishes through original callbacks");}
static void power_select(int x,int y){check(em_web_select_world(x,y),"Palace SELECT accepted");power_settle();}
static void ready_map(const char*path,unsigned expected_house){
 FILE*f=fopen(path,"rb");check(f&&fread(&fixture,sizeof fixture,1,f)==1,"genuine house CPU fixture");fclose(f);reset();trace_reset();
 check(dune_word(&em_cpu,0xc274)==expected_house,"actual requested house, not a recolored fixture");
 if(dune_mouse_context(&em_cpu)==2){
  dune_mouse_click(&em_host.dune_mouse,&em_cpu,48,60,DUNE_CLICK_SELECT);
  uint64_t end=em_cpu.vdp.frames+240;while(dune_mouse_context(&em_cpu)!=1&&em_cpu.vdp.frames<end)power_step();
  check(dune_mouse_context(&em_cpu)==1,"genuine Palace interior exits through original EXIT");power_frames(12);
 }
 check(dune_mouse_context(&em_cpu)==1,"genuine house map is live");
 palace=0;for(unsigned i=0;i<73;i++){EmWebActionContext b=em_web_typed_context(0xff4eb8+i*98,2);if(b.kind&&b.type==2&&b.owner==expected_house){palace=b.pointer;coord(b,&px,&py);break;}}
 check(palace&&em_web_palace_ready(em_web_typed_context(palace,2)),"genuine charged own Palace exists");
 check(dune_web_clear_selection(),"clear fixture selection through original code");power_settle();stable_fixture=em_cpu;
}
static void arm(void){
 fixture=stable_fixture;reset();trace_reset();power_select(px,py);check(em_web_action_context().pointer==palace&&!dune_word(&em_cpu,0xdc4c),"first SINGLE selects Palace without arming");
 power_select(px,py);check(dune_word(&em_cpu,0xdc4c)&&arm_calls==1&&!info_calls&&!power_calls,"second SINGLE performs only original Palace arming");trace_reset();
}
static void target_case(unsigned house,int self){
 arm();int tx=px,ty=py;if(!self){unsigned found=0;for(unsigned i=0;i<73;i++){EmWebActionContext b=em_web_typed_context(0xff4eb8+i*98,2);if(b.kind&&b.pointer!=palace&&b.owner==house){coord(b,&tx,&ty);found=1;break;}}check(found,"real other own building exists");}
 unsigned token=dune_web_actor_capture(),before_a=native_a;
 capture_branch=1;check(em_web_command_world(tx,ty,token),"explicit armed Palace target COMMAND accepted");power_settle();
 check(route_count==(unsigned)self&&power_calls==1&&!info_calls&&guard_mask==127&&oracle_checks==1,"self COMMAND chooses one original target branch, all seven guards, no info screen");
 check(native_a==before_a+1&&em_web_selection.order_seq==1&&em_web_selection.order_kind==3&&em_web_selection.order_actor==palace&&em_web_selection.order_tile==(unsigned)ty/32*64+(unsigned)tx/32,"one original power command keeps exact actor and self-footprint target tile");
 check(dune_mouse_context(&em_cpu)==1&&!dune_word(&em_cpu,0xdc4c)&&!(dune_word(&em_cpu,(palace&65535)+6)&0x80),"original successful weapon consumes charge and clears armed marker exactly once");
 check(!em_web_command_world(px,py,token),"self command ticket cannot execute twice");
 printf("PASS house%u power%u %s target tile%u: one original A/weapon, seven original guards, no INFO, full original-branch CPU%zuB identical\n",house,em_web_palace_power(house),self?"self":"other-own-building",(unsigned)ty/32*64+(unsigned)tx/32,sizeof em_cpu);
}
static void single_case(unsigned house){
 arm();check(em_web_select_world(px,py),"expired deferred SINGLE reaches original SELECT");power_settle();power_frames(90);
 check(info_calls==1&&!power_calls&&!route_count&&dune_mouse_context(&em_cpu)==2,"lone deferred SINGLE enters original Palace info once without a weapon command");
 printf("PASS house%u selected/armed SINGLE retains original info entry, no weapon activation\n",house);
}
static void guard_cases(unsigned house){
 for(int guard=1;guard<=5;guard++){
  arm();unsigned token=dune_web_actor_capture();negative=guard;
  check(em_web_command_world(px,py,token),"charged self COMMAND queues before isolated guard change");power_settle();
  check(route_count==1&&!power_calls&&!info_calls&&!em_web_selection.order_seq,"original downstream charge/cooldown/disabled/armed guard rejects without INFO or activation");
 }
 for(int guard=1;guard<=3;guard++){
  arm();unsigned token=dune_web_actor_capture(),a=palace&65535;before=em_cpu;
  if(guard==1)write_mem(&em_cpu,0xff0000+a+6,2,dune_word(&em_cpu,a+6)&~0x80u);
  if(guard==2)write_mem(&em_cpu,0xff0000+a+18,2,0);
  if(guard==3)em_cpu.ram[a+8]=(unsigned char)((house+1)%3);
  check(!em_web_command_world(px,py,token)&&!power_calls&&!info_calls,"uncharged/dead/wrong-owner token is rejected before native dispatch");
 }
 arm();unsigned resource_token=dune_web_actor_capture();negative=6;capture_branch=1;
 check(em_web_command_world(px,py,resource_token),"self command reaches original house-resource guard");power_settle();
 check(route_count==1&&power_calls==1&&!info_calls&&!em_web_selection.order_seq&&oracle_checks==1,"original inactive-house/resource branch rejects, with complete original guarded-branch CPU identity");
 printf("PASS house%u native post-dispatch selected/charge/cooldown/disabled/armed, original house-resource rejection, and pre-dispatch uncharged/dead/wrong-owner guards\n",house);
}
int main(void){
 const char*paths[]={".local/demo-fixture-harkonnen/demo.cpu.bin",".local/demo-fixture/demo.cpu.bin",".local/building-ui-fixtures/house2-building02.cpu.bin"};
 for(unsigned house=0;house<3;house++){ready_map(paths[house],house);target_case(house,1);target_case(house,0);single_case(house);guard_cases(house);}
 return 0;
}
