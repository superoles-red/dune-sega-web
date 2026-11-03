/* Exact native playable-unit self-A/B catalogue and adaptive input wrapper. */
#define main old_special_action_main
#include "test_em_web_actions_special.c"
#undef main
static CPU readonly_before;
static void run_frames(unsigned n){uint64_t end=em_cpu.vdp.frames+n;while(em_cpu.vdp.frames<end)step();require(!em_cpu.fault,"healthy original unit action frames");}
static void wait_self(unsigned before){uint64_t end=em_cpu.vdp.frames+180;while(em_cpu.vdp.frames<end&&(em_web_selection.native_selfs==before||em_web_selection.operation||em_web_selection.phase||em_host.dune_mouse.count||em_host.dune_mouse.stage))step();require(em_web_selection.native_selfs==before+1&&idle(),"one self-A and native reselect finish");}
static void test_api(unsigned type){
 reset();isolate(0);unsigned unit=create_native(43,type,1,type==17?26:24,type==17?35:34);native_click(unit);EmWebActionContext ctx=em_web_action_context();require(em_web_unit_self_available(ctx)&&!ctx.b_kind,"first special selection exposes self-A, not a fake native B");
 readonly_before=em_cpu;unsigned a=native_a,b=native_b;require(dune_web_action_self()&&!dune_web_action_self(),"only one self-A intent is queued");require(!memcmp(&em_cpu,&readonly_before,sizeof em_cpu)&&em_host.dune_mouse.count==1,"self-A request changes only its intent queue");wait_self(0);
 require(dune_long(&em_cpu,0xc25c)==0xff0000+unit&&(dune_word(&em_cpu,unit+6)&128)&&em_cpu.ram[unit+15]>0,"original A arms; original follow-up A reselects the same unit");require(native_a==a+2&&native_b==b&&em_web_selection.self_result==1,"arming performs two actual A paths and no B");
 unsigned armed_timer=em_cpu.ram[unit+15];readonly_before=em_cpu;const char*json=dune_web_actions_debug();require(strstr(json,"\"selfAvailable\":true")&&strstr(json,"\"armed\":true")&&!memcmp(&em_cpu,&readonly_before,sizeof em_cpu),"armed descriptors are whole-CPU read-only");
 require(dune_web_action_self(),"repeated native self-A can cancel the timed ability");wait_self(1);require(!(dune_word(&em_cpu,unit+6)&128)&&!em_cpu.ram[unit+15]&&dune_long(&em_cpu,0xc25c)==0xff0000+unit&&em_web_selection.self_result==2,"self-A clears native armed/timer and keeps original selection through real A");run_frames(20);require(dune_word(&em_cpu,unit+18)>0,"cancelled original countdown does not trigger the ability");
 require(dune_web_action_self(),"cancel then native self-A rearms from original full timer");wait_self(2);require((dune_word(&em_cpu,unit+6)&128)&&em_cpu.ram[unit+15]>=armed_timer-2,"rearming resets the original timer, no added duration");
 unsigned yards=owned_yards();watched_unit=type==11?unit:0;contextual_b();uint64_t end=em_cpu.vdp.frames+300;while(em_cpu.vdp.frames<end&&(type==11?!saw_die:owned_yards()==yards))step();require(type==11?saw_die:owned_yards()==yards+1,"armed B completes actual native destruction/deployment");printf("PASS API type%u: firstselection self-A -> armed/reselect; self-A cancel/rearm; originalB completion; timer%u\n",type,armed_timer);fflush(stdout);
}
int main(int argc,char**argv){if(argc!=2)return 2;FILE*f=fopen(argv[1],"rb");require(f&&fread(&baseline,sizeof baseline,1,f)==1,"ordinary campaign source");fclose(f);unsigned armed_types=0;
 for(unsigned type=2;type<=17;type++){
  reset();isolate(0);unsigned unit=create_native(43,type,1,type==17?26:24,type==17?35:34);native_click(unit);require(dune_long(&em_cpu,0xc25c)==0xff0000+unit,"original first A selects playable ground unit");unsigned initial_flags=dune_word(&em_cpu,unit+6),initial_timer=em_cpu.ram[unit+15];native_click(unit);unsigned flags=dune_word(&em_cpu,unit+6),timer=em_cpu.ram[unit+15];int armed=(flags&128)!=0;if(armed)armed_types++;
  printf("CATALOG type%u firstflags%04x timer%u -> selfAflags%04x timer%u action%u selected%06x\n",type,initial_flags,initial_timer,flags,timer,em_cpu.ram[unit+84],dune_long(&em_cpu,0xc25c));fflush(stdout);require(armed==(type==11||type==17),"only original Devastator/MCV self-A starts this countdown");
  if(armed){if(!dune_long(&em_cpu,0xc25c))native_click(unit);native_click(unit);require(!(dune_word(&em_cpu,unit+6)&128)&&!em_cpu.ram[unit+15],"second self-A cancels, rather than extends, original countdown");}
 }
 require(armed_types==2,"complete16-ground-unit native self-action catalogue");
 test_api(11);test_api(17);
 unsigned unit=arm_native(11,24,34);watched_unit=unit;unsigned raw=em_cpu.ram[unit+15];uint64_t start=em_cpu.vdp.frames,end=start+600;while(!saw_die&&em_cpu.vdp.frames<end)step();require(saw_die,"unmodified natural Devastator timer reaches native Die10 without B");printf("PASS natural Devastator rawTimer%u -> Die10 in%llu native frames\n",raw,(unsigned long long)(em_cpu.vdp.frames-start));
 puts("PASS native unit catalogue and first-select/self-A/cancel/rearm/B/automatic timer; no ability/timer/HP writes in adapter");return 0;}
