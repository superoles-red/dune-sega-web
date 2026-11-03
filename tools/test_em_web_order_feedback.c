/* Original contextual-A evidence: read-only order classification and Palace
 * arm/pan/clear/target flow for all three authentic late campaign houses.
 * Reuses only the existing offline native actor/click fixture helpers. */
#define main existing_combat_regression_main
#include "test_em_web_selection_combat.c"
#undef main
static void check(int okay,const char *why){if(!okay){fprintf(stderr,"FAIL %s pc=%06x %s\n",why,em_cpu.pc,dune_web_actions_debug());exit(1);}}
static void frames(unsigned n){uint64_t end=em_cpu.vdp.frames+n;while(!em_cpu.fault&&em_cpu.vdp.frames<end)step();check(!em_cpu.fault,"healthy native scheduler");}
static unsigned create_building(unsigned type,unsigned owner,unsigned tile){
 unsigned index=73;for(unsigned i=0;i<73;i++){unsigned p=read_mem(&em_cpu,0x4a71e + i*4,4)&65535;if(!(dune_word(&em_cpu,p+4)&1)){index=i;break;}}
 check(index<73,"free native building slot");unsigned mode=dune_word(&em_cpu,0xc148);write_mem(&em_cpu,0xffc148,2,mode+1);save_regs=em_cpu;
 unsigned stack=0xef00,low=stack;em_cpu.pc=0xe584;em_cpu.sr=0x2700;em_cpu.a[7]=0xff0000+stack;write_mem(&em_cpu,em_cpu.a[7],4,0xdead00);
 write_mem(&em_cpu,em_cpu.a[7]+4,2,index);write_mem(&em_cpu,em_cpu.a[7]+6,2,type);write_mem(&em_cpu,em_cpu.a[7]+8,2,owner);write_mem(&em_cpu,em_cpu.a[7]+10,2,tile);
 unsigned n=0;while(!em_cpu.fault&&em_cpu.pc!=0xdead00&&n++<5000000){if((em_cpu.a[7]&65535)<low)low=em_cpu.a[7]&65535;translated_step(&em_cpu);}
 unsigned p=em_cpu.a[0]&0xffffff;check(!em_cpu.fault&&em_cpu.pc==0xdead00&&p,"original Building_Create");
 memcpy(em_cpu.ram+low,save_regs.ram+low,stack+20-low);memcpy(em_cpu.d,save_regs.d,sizeof em_cpu.d);memcpy(em_cpu.a,save_regs.a,sizeof em_cpu.a);em_cpu.pc=save_regs.pc;em_cpu.sr=save_regs.sr;em_cpu.usp=save_regs.usp;em_cpu.ssp=save_regs.ssp;write_mem(&em_cpu,0xffc148,2,mode);return p;
}
static unsigned empty_site(void){
 unsigned cx=dune_word(&em_cpu,0xe3ec)/32+3,cy=dune_word(&em_cpu,0xe3ee)/32+2;
 for(unsigned radius=0;radius<20;radius++)for(int yy=-(int)radius;yy<=(int)radius;yy++)for(int xx=-(int)radius;xx<=(int)radius;xx++){
  int x=(int)cx+xx,y=(int)cy+yy;if(x<2||x>58||y<2||y>58)continue;int okay=1;
  for(int dy=0;dy<3;dy++)for(int dx=0;dx<3;dx++){unsigned at=0x7d9c+((y+dy)*64+x+dx)*4;if(em_cpu.ram[at+2]&48)okay=0;}
  if(okay)return y*64+x;
 }check(0,"empty offline native building site");return 0;
}
static void click_building(unsigned p){check(native_click_world(dune_word(&em_cpu,(p&65535)+12)/8+8,dune_word(&em_cpu,(p&65535)+10)/8+8),"native building A");}
static void clear(void){unsigned n=em_web_selection.native_clears;check(dune_web_clear_selection(),"clear request accepted");uint64_t end=em_cpu.vdp.frames+120;while(!em_cpu.fault&&em_cpu.vdp.frames<end&&em_web_selection.native_clears==n)step();check(em_web_selection.native_clears==n+1&&!dune_long(&em_cpu,0xc25c)&&!dune_long(&em_cpu,0xc578),"native pure clear completes");}
int main(int argc,char **argv){
 if(argc!=2)return 2;
 for(unsigned house=0;house<3;house++){
  char path[4096];snprintf(path,sizeof path,"%s/house%u-mission09.cpu.bin",argv[1],house);FILE*f=fopen(path,"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"authentic late house baseline");fclose(f);reset();frames(2);
  unsigned palace=create_building(2,house,empty_site()),a=palace&65535;frames(60);
  click_building(palace);check(em_web_palace_ready(em_web_action_context()),"original Palace starts ready; no cooldown or ready flag fabrication");
  click_building(palace);check(dune_word(&em_cpu,0xdc4c)&&em_web_palace_ready(em_web_action_context()),"second native self A arms power");
  unsigned power=em_web_palace_power(house);check(power==house+1,"original house power table");
  uint64_t seq=em_web_selection.order_seq;unsigned timer=dune_word(&em_cpu,a+86);clear();check(!dune_word(&em_cpu,0xdc4c)&&dune_word(&em_cpu,a+86)==timer&&em_web_selection.order_seq==seq&&em_web_selection.special_cancels==1,"clear executes native B disarm without firing or consuming cooldown");
  click_building(palace);click_building(palace);check(dune_word(&em_cpu,0xdc4c),"power can be re-armed after clear");
  /* Camera movement is deliberately the existing native pointer adapter, not
   * another A. The actual selected cell remains an ordinary later A. */
  dune_mouse_world_point(&em_host.dune_mouse,&em_cpu,dune_word(&em_cpu,0xe3ec)+160,dune_word(&em_cpu,0xe3ee)+112);frames(3);
  check(dune_word(&em_cpu,0xdc4c)&&em_web_selection.order_seq==seq,"pointer/camera preparation does not fire an armed power");
  unsigned tx=empty_site(),wx=(tx%64)*32+16,wy=(tx/64)*32+16;check(native_click_world(wx,wy),"native target A completes");
  check(!dune_word(&em_cpu,0xdc4c)&&em_web_selection.order_seq==seq+1&&em_web_selection.order_kind==3&&em_web_selection.order_action==power&&em_web_selection.order_tile==tx&&dune_word(&em_cpu,a+86)>0,"native power target commits exactly once and starts original cooldown");
  printf("PASS Palace house%u power%u original targetTile%u cooldown%u cancel%llu orderSeq%llu %s\n",house,power,tx,dune_word(&em_cpu,a+86),(unsigned long long)em_web_selection.special_cancels,(unsigned long long)em_web_selection.order_seq,dune_web_actions_debug());fflush(stdout);
 }
 /* The USA game deliberately decides contextual friendly-unit/building
  * interactions itself. Classify its committed action, never paint an attack
  * merely because JavaScript sees a unit-shaped or building-shaped target. */
 char path[4096];snprintf(path,sizeof path,"%s/house1-mission01.cpu.bin",argv[1]);FILE*f=fopen(path,"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"authentic first Atreides baseline");fclose(f);
 for(unsigned scenario=0;scenario<5;scenario++){
  reset();isolate(0,0);unsigned actor=create_native(43,9,1,24,34),target=0;
  if(scenario==1||scenario==2)target=0xff0000+create_native(44,4,scenario==1?2:1,26,34);
  if(scenario>=3)target=create_building(9,scenario==3?2:1,35*64+25);
  frames(2);check(native_click_world(dune_word(&em_cpu,actor+12)/8,dune_word(&em_cpu,actor+10)/8),"select one original actor");
  check(dune_long(&em_cpu,0xc25c)==0xff0000+actor&&em_web_selection.order_seq==0,"selecting never acknowledges an order");
  unsigned x=23*32+16,y=34*32+16;if(target){x=dune_word(&em_cpu,(target&65535)+12)/8+8;y=dune_word(&em_cpu,(target&65535)+10)/8+8;}
  check(native_click_world(x,y),"original contextual target A");
  check(em_web_selection.order_seq==1&&em_web_selection.order_source==0x281bc,"one original action-register commit produces one observed event");
  check(em_web_selection.order_kind==(em_web_selection.order_action==0?2u:1u),"observer follows the actual native action register");
  if(scenario==0)check(em_web_selection.order_kind==1&&!em_web_selection.order_target,"empty ground is native move");
  if(scenario==1)check(em_web_selection.order_kind==2&&em_web_selection.order_target==target&&em_web_selection.order_target_kind==1,"enemy unit is native attack");
  save_regs=em_cpu;char text[3000];snprintf(text,sizeof text,"%s",dune_web_actions_debug());check(!memcmp(&em_cpu,&save_regs,sizeof em_cpu),"full CPU remains byte-identical across feedback getter");
  printf("PASS order scenario%u nativeAction%u kind%u targetKind%u targetOwner%u %s\n",scenario,em_web_selection.order_action,em_web_selection.order_kind,em_web_selection.order_target_kind,target?em_cpu.ram[(target&65535)+8]:255,text);fflush(stdout);
 }
 return 0;
}
