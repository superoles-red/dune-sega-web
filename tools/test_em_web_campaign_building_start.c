/* Direct campaign requests must leave a real building through original Exit/A.
 * A bare request may supersede frontend navigation before the old menu closes. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,before;static DuneMouse mouse;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s\n",msg,em_web_campaign_report(&c));exit(1);}}
static void load(const char*path){FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"building fixture");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"native execution");}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)step();}
static void test(const char*path,int hover,int supersede){
 load(path);int context=dune_mouse_context(&c);check(context==2||context==3,"actual native building context");unsigned house=dune_long(&c,0xc278)&65535,credits=dune_long(&c,house+18);
 if(hover){check(dune_mouse_point(&mouse,&c,80,84),"original hover on a non-Exit product");frames(120);check(dune_word(&c,context==3?0xbfca:0xbf8c)>0,"original arrow/hover really selected product row");check(dune_long(&c,house+18)==credits,"preview hover buys nothing");dune_mouse_reset(&mouse);}
 if(supersede)check(em_web_campaign_route_request(&c,3),"old pause-menu route pending");
 before=c;check(em_web_campaign_request(&c,2,2),"bare Ordos2 request from building");check(!memcmp(&c,&before,sizeof c),"request queues without CPU/game writes");check(!em_web_campaign.route_pending,"campaign supersedes old route");
 uint64_t end=c.vdp.frames+6000;int original_exit=0;
 while(em_web_campaign.stage!=4&&c.vdp.frames<end){if(c.pc==(context==3?0x28ce8:0x2895c))original_exit=1;step();}
 check(em_web_campaign.stage==4,"building Exit reaches original new-house briefing");check(original_exit,"original native building cleanup entry executed");
 frames(400);check(em_web_campaign.pending&&em_web_campaign.stage==4&&!em_web_campaign.outcome_seq,"new briefing manual and no false win");
 end=c.vdp.frames+6000;uint64_t next=c.vdp.frames;
 while(em_web_campaign.pending&&c.vdp.frames<end){if(c.vdp.frames>=next&&em_web_campaign.poll_frame+3>=c.vdp.frames&&!em_web_campaign.input_pending){em_web_campaign_input_request(&c,em_web_campaign.poll_pc==0x25cb2?5:0,em_web_campaign.poll_pc==0x25cb2?0:PAD_A);next=c.vdp.frames+45;}step();}
 check(!em_web_campaign.pending&&em_web_campaign.starts==1&&dune_mouse_context(&c)==1&&em_web_campaign_house(&c)==2&&em_web_campaign_mission(&c)==2,"original Ordos2 map and one actual start");check(!em_web_campaign.outcome_seq,"building navigation cannot unlock");
 printf("PASS direct building start %s hover%d supersede%d: original Exit/A+cleanup, manual400, Ordos2, zero wins\n",path,hover,supersede);fflush(stdout);
}
int main(void){test(".local/building-ui-fixtures/house1-building02.cpu.bin",0,0);test(".local/building-ui-fixtures/house1-building08.cpu.bin",0,0);test(".local/building-ui-fixtures/house1-building08.cpu.bin",1,1);test(".local/building-ui-fixtures/house1-building11.cpu.bin",0,0);test(".local/building-ui-fixtures/house1-building11.cpu.bin",1,1);puts("PASS bare campaign start from production/Starport, original selected product and superseded route");return 0;}
