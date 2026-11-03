/* Original single-unit A regression. Original Unit_Create isolates native test
 * actors; original projectiles, pathfinding and harvesting change HP/cargo.
 * No group API, synthetic replacement order, damage or cargo mutation. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
static CPU em_cpu,baseline,save_regs;
static struct {int paused,stopped;DuneMouse dune_mouse;} em_host;
static int em_window=1;
#include "em_web_selection.h"
static unsigned shots,our_shots,native_a,map_returns;
static void step(void){
 em_web_selection_observe();dune_mouse_observe(&em_host.dune_mouse,&em_cpu);
 if(em_cpu.pc==0x27b80)++native_a;
 if(em_cpu.pc==0xe57a)++map_returns;
 if(em_cpu.pc==0x48352){shots++;uint32_t actor=dune_long(&em_cpu,0xdea0);if(actor==0xff220c || actor==0xff2298)our_shots++;}
 machine_step(&em_cpu);
}
static int native_click_world(unsigned x,unsigned y){
 unsigned a=native_a,dispatched=0,return_at_dispatch=map_returns;
 dune_mouse_world_click(&em_host.dune_mouse,&em_cpu,x,y,DUNE_CLICK_SELECT);
 uint64_t end=em_cpu.vdp.frames+120;
 while(!em_cpu.fault && em_cpu.vdp.frames<end){
  step();
  if(!dispatched && native_a>a){dispatched=1;return_at_dispatch=map_returns;}
  if(dispatched && map_returns>return_at_dispatch && !em_host.dune_mouse.count && !em_host.dune_mouse.stage)return 1;
 }
 fprintf(stderr,"original A failed at%u,%u pc=%x state=%s\n",x,y,em_cpu.pc,dune_web_actions_debug());return 0;
}
static void reset(void){em_cpu=baseline;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.reason=NULL;em_cpu.pad_buttons[0]=0;memset(&em_host,0,sizeof em_host);em_host.dune_mouse.enabled=1;dune_web_selection_reset();shots=our_shots=native_a=map_returns=0;}
static void isolate(unsigned a,unsigned b){
 for(unsigned p=0x1000;p<0x47c8;p+=140)if(p!=a && p!=b)write_mem(&em_cpu,0xff0000+p+4,2,0);
 for(unsigned i=0;i<4096;++i){unsigned t=0x7d9c+i*4;if(em_cpu.ram[t+2]&16){unsigned index=em_cpu.ram[t+3];unsigned p=index?0x1000+(index-1)*140:0;if(p!=a && p!=b){em_cpu.ram[t+2]&=~16;em_cpu.ram[t+3]=0;}}}
}
static unsigned create_native(unsigned index,unsigned type,unsigned owner,unsigned tx,unsigned ty){
 save_regs=em_cpu;unsigned stack=0xef00,low=stack;
 em_cpu.pc=0x468ba;em_cpu.sr=0x2700;em_cpu.a[7]=0xff0000+stack;
 write_mem(&em_cpu,em_cpu.a[7],4,0xdead00);write_mem(&em_cpu,em_cpu.a[7]+4,2,index);write_mem(&em_cpu,em_cpu.a[7]+6,2,type);write_mem(&em_cpu,em_cpu.a[7]+8,2,owner);
 write_mem(&em_cpu,em_cpu.a[7]+10,4,(((ty<<8)|128)<<16)|((tx<<8)|128));write_mem(&em_cpu,em_cpu.a[7]+14,2,128);
 unsigned n=0;while(!em_cpu.fault && em_cpu.pc!=0xdead00 && n++<5000000){if((em_cpu.a[7]&65535)<low)low=em_cpu.a[7]&65535;translated_step(&em_cpu);}
 unsigned p=em_cpu.a[0]&0xffffff;
 if(em_cpu.fault || em_cpu.pc!=0xdead00 || !p){fprintf(stderr,"create FAIL type%u pc=%x p=%x %s n%u\n",type,em_cpu.pc,p,em_cpu.reason?em_cpu.reason:"none",n);return 0;}
 memcpy(em_cpu.ram+low,save_regs.ram+low,stack+20-low);
 memcpy(em_cpu.d,save_regs.d,sizeof em_cpu.d);memcpy(em_cpu.a,save_regs.a,sizeof em_cpu.a);em_cpu.pc=save_regs.pc;em_cpu.sr=save_regs.sr;em_cpu.usp=save_regs.usp;em_cpu.ssp=save_regs.ssp;
 printf("native Unit_Create type%u owner%u ptr%06x hp%u action%u at%u,%u steps%u\n",type,owner,p,dune_word(&em_cpu,(p&65535)+18),em_cpu.ram[(p&65535)+84],tx,ty,n);fflush(stdout);return p&65535;
}
int main(int argc,char **argv){
 if(argc<2)return 2;
 FILE *f=fopen(argv[1],"rb");if(!f || fread(&baseline,sizeof baseline,1,f)!=1)return 3;fclose(f);
 reset();isolate(0x220c,0);
 unsigned enemy=create_native(43,4,2,24,34);if(!enemy)return 1;
 unsigned enemy_before=dune_word(&em_cpu,enemy+18);
 if(!native_click_world(dune_word(&em_cpu,0x220c+12)/8,dune_word(&em_cpu,0x220c+10)/8) || dune_long(&em_cpu,0xc25c)!=0xff220c)return 1;
 if(!native_click_world(24*32+16,34*32+16))return 1;
 unsigned first_attack=em_cpu.ram[0x220c+84],minimum=dune_word(&em_cpu,enemy+18);
 printf("single-unit original A attack action=%u %s\n",first_attack,dune_web_actions_debug());fflush(stdout);
 uint64_t start=em_cpu.vdp.frames,end=start+1800;
 while(!em_cpu.fault && em_cpu.vdp.frames<end){step();unsigned hp=dune_word(&em_cpu,enemy+18);if(hp<minimum){minimum=hp;printf("enemy hp=%u atframe%llu shots%u ours%u\n",hp,(unsigned long long)em_cpu.vdp.frames,shots,our_shots);fflush(stdout);}if(minimum<enemy_before && shots>0)break;}
 int attack_ok=!em_cpu.fault && first_attack==0 && minimum<enemy_before && our_shots>0 && native_a==2;
 printf("ATTACK %s initialHP%u minHP%u shots%u ours%u nativeA%u elapsed%llu fault%s\n",attack_ok?"PASS":"FAIL",enemy_before,minimum,shots,our_shots,native_a,(unsigned long long)(em_cpu.vdp.frames-start),em_cpu.reason?em_cpu.reason:"none");fflush(stdout);
 reset();isolate(0,0);
 unsigned harvester=create_native(44,16,1,27,34);if(!harvester)return 1;
 if(!native_click_world(dune_word(&em_cpu,harvester+12)/8,dune_word(&em_cpu,harvester+10)/8) || dune_long(&em_cpu,0xc25c)!=0xff0000+harvester)return 1;
 if(!native_click_world(22*32+16,33*32+16))return 1;
 unsigned harvest_action=em_cpu.ram[harvester+84],cargo0=em_cpu.ram[harvester+94],cargo_max=cargo0;
 printf("single-unit original A harvest action=%u cargo=%u %s\n",harvest_action,cargo0,dune_web_actions_debug());fflush(stdout);
 start=em_cpu.vdp.frames;end=start+6000;
 while(!em_cpu.fault && em_cpu.vdp.frames<end){step();unsigned cargo=em_cpu.ram[harvester+94];if(cargo>cargo_max){cargo_max=cargo;printf("cargo=%u atframe%llu pos=%u,%u action%u\n",cargo,(unsigned long long)em_cpu.vdp.frames,dune_word(&em_cpu,harvester+12)/8,dune_word(&em_cpu,harvester+10)/8,em_cpu.ram[harvester+84]);fflush(stdout);break;}}
 int harvest_ok=!em_cpu.fault && harvest_action==5 && cargo_max>cargo0 && native_a==2;
 printf("HARVEST %s initialCargo%u maxCargo%u nativeA%u elapsed%llu fault%s\n",harvest_ok?"PASS":"FAIL",cargo0,cargo_max,native_a,(unsigned long long)(em_cpu.vdp.frames-start),em_cpu.reason?em_cpu.reason:"none");
 return attack_ok && harvest_ok?0:1;
}
