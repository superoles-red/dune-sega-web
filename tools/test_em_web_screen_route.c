/* Native screen routes, one-shot Menu, current-poll/VDP readiness regressions. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,before,baseline;static DuneMouse mouse;static FILE*reports;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s reason=%s\n",msg,em_web_campaign_report(&c),c.reason?c.reason:"");exit(1);}}
static void init(void){c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);}
static void load(const char*path){FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"fixture");fclose(f);init();}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"native machine");}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)step();}
static void route(int target,unsigned budget){before=c;check(em_web_campaign_route_request(&c,target),"route accepted");check(!memcmp(&c,&before,sizeof c),"route queue changes no CPU byte");uint64_t seq=em_web_campaign.route_seq;check(em_web_campaign_route_request(&c,target)&&em_web_campaign.route_seq==seq,"duplicate pending route is idempotent");uint64_t start=c.vdp.frames,end=start+budget;
 while(em_web_campaign.route_pending&&c.vdp.frames<end)step();
 check(!em_web_campaign.route_pending,"route reaches actual target without frontend Continue");check(em_web_campaign.scene&&!strcmp(em_web_campaign.scene,em_web_campaign_route_name(target)),"target native scene");check(em_web_campaign_scene_ready(&c)&&em_web_campaign.poll_generation==em_web_campaign.scene_generation,"ready frame belongs to current native poll generation");check(!em_web_campaign.outcome_seq,"navigation never unlocks");if(reports){fprintf(reports,"%s\n",em_web_campaign_report(&c));fflush(reports);}
 printf("ROUTE %s frames=%llu uiCall=%d\n",em_web_campaign_route_name(target),(unsigned long long)(c.vdp.frames-start),em_web_campaign.ui_call_active);fflush(stdout);
}
static void start_from_world(void){check(em_web_campaign_request(&c,2,2),"new campaign uses ordinary native game path");uint64_t end=c.vdp.frames+6000;while(em_web_campaign.stage!=4&&c.vdp.frames<end)step();check(em_web_campaign.stage==4&&!em_web_campaign.ui_call_active,"original NewHouse validator without borrowed startup main");frames(400);check(em_web_campaign.pending&&em_web_campaign.stage==4,"new briefing is manual");uint64_t next=c.vdp.frames;end=c.vdp.frames+6000;while(em_web_campaign.pending&&c.vdp.frames<end){if(c.vdp.frames>=next&&!em_web_campaign.input_pending&&em_web_campaign.poll_frame+3>=c.vdp.frames){em_web_campaign_input_request(&c,em_web_campaign.poll_pc==0x25cb2?5:0,em_web_campaign.poll_pc==0x25cb2?0:PAD_A);next=c.vdp.frames+45;}step();}check(!em_web_campaign.pending&&dune_mouse_context(&c)==1&&em_web_campaign_house(&c)==2&&em_web_campaign_mission(&c)==2,"original Ordos2 scenario after ordinary NewHouse");puts("PASS native world -> new campaign, manual briefing, original map; no borrowed main");}
static void building_ready(const char*path){
 load(path);memset(c.vdp.frame,0xab,320*224*3);check(!em_web_campaign_scene_ready(&c)&&!em_web_campaign_world_visible(&c),"loaded building cannot publish stale frame");
 uint64_t end=c.vdp.frames+200;while(!em_web_campaign_scene_ready(&c)&&c.vdp.frames<end)step();
 check(em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"building")&&em_web_campaign_scene_ready(&c),"original building poll plus fresh VDP frame ready");
 check(c.vdp.rendered_frames>em_web_campaign.ready_render&&c.vdp.frame[0]!=0xab,"building marker crosses real completed-frame boundary and replaces stale RGB");route(3,400);route(4,400);check(em_web_campaign_world_visible(&c),"only stable map exposes SDL world");printf("PASS building current-poll/VDP barrier %s and first Menu\n",path);
}
static void cold_boot(int target){
 memset(&c,0,sizeof c);c.rom=rom_data;c.rom_size=sizeof rom_data;c.sr=0x2700;c.io_tx[0]=c.io_tx[1]=0xff;c.io_tx[2]=0xfb;c.a[7]=read_mem(&c,0,4);c.ssp=c.a[7];c.pc=read_mem(&c,4,4)&0xffffff;init();
 route(target,7000);route(0,1500);printf("PASS cold reset-vector boot -> %s -> main without frontend Continue\n",em_web_campaign_route_name(target));
}
static void sound_feedback(void){
 c=baseline;init();check(!em_web_campaign_sound_request(&c),"frontend SFX never queues inside live battle");load(".local/screen-assets-raw/boot-poll-0178d2.cpu.bin");route(0,1500);
 before=c;check(em_web_campaign_sound_request(&c),"queue original frontend profile-valid UI feedback");check(!memcmp(&c,&before,sizeof c),"SFX queue changes no CPU byte");
 uint64_t end=c.vdp.frames+100;while((em_web_campaign.sound_pending||em_web_campaign.sound_active)&&c.vdp.frames<end)step();
 check(em_web_campaign.sound_consumed==1&&em_web_campaign.sound_calls==1,"one actual original SFX1664 invocation");
 route(1,1500);check(c.ram[0xdc51],"sound initially enabled");check(em_web_campaign_input_request(&c,1,1),"original Sound toggle row");end=c.vdp.frames+100;while(em_web_campaign.input_pending&&c.vdp.frames<end)step();frames(5);check(!c.ram[0xdc51],"original handler disables Sound");route(0,1500);
 check(em_web_campaign_sound_request(&c),"muted feedback still uses native wrapper");end=c.vdp.frames+100;while((em_web_campaign.sound_pending||em_web_campaign.sound_active)&&c.vdp.frames<end)step();
 check(em_web_campaign.sound_consumed==2&&em_web_campaign.sound_calls==1,"native DC51 guard suppresses muted SFX without double sound");
 before=c;(void)em_web_campaign_report(&c);check(!memcmp(&c,&before,sizeof c),"extended report remains whole-CPU immutable");puts("PASS original frontend profile-valid UI feedback once; native mute respected; live battle rejected");
}
int main(int argc,char**argv){reports=fopen(".local/campaign-analysis/screen-route-states.jsonl","w");check(reports!=NULL,"JSON evidence output");check(argc>=3,"usage BASE_MAP BOOT_POLLS...");load(argv[1]);baseline=c;before=c;check(!em_web_campaign_route_request(&c,-1)&&!em_web_campaign_route_request(&c,5),"invalid routes rejected");check(!memcmp(&c,&before,sizeof c),"invalid routes immutable");
 for(unsigned phase=0;phase<12;phase++){c=baseline;init();for(unsigned i=0;i<phase*73;i++)step();route(3,300);check(!em_web_campaign_world_visible(&c),"pause hides raw SDL UI");uint64_t seq=em_web_campaign.input_seq;route(3,20);frames(15);check(em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"pause")&&em_web_campaign.input_seq==seq,"Menu while paused never toggles Resume");route(4,300);}
 puts("PASS Menu/Resume across 12 instruction phases, duplicate Menu idempotent");
 building_ready(".local/building-ui-fixtures/house1-building02.cpu.bin");building_ready(".local/building-ui-fixtures/house1-building11.cpu.bin");sound_feedback();
 cold_boot(1);cold_boot(2);
 for(int i=2;i<argc;i++)for(int target=1;target<=2;target++){load(argv[i]);route(target,7000);if(target==2){check(strstr(em_web_campaign_report(&c),"\"continueMask\":16")!=NULL,"tutorial Continue is native A, not abort Start");uint64_t seq=em_web_campaign.input_seq;check(em_web_campaign_input_request(&c,0,PAD_A),"native tutorial tap");uint64_t end=c.vdp.frames+30;while(em_web_campaign.input_pending&&c.vdp.frames<end)step();frames(8);check(em_web_campaign.input_seq==seq+1&&em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"tutorial"),"one tap advances tutorial script without abort");}route(0,1500);if(target==1){unsigned music=c.ram[0xdc50],sound=c.ram[0xdc51];route(2,1500);route(0,1500);check(c.ram[0xdc50]==music&&c.ram[0xdc51]==sound,"tutorial roundtrip preserves native audio options");}printf("PASS startup %s -> %s -> main, no intermediate Continue\n",argv[i],em_web_campaign_route_name(target));fflush(stdout);}
 c=baseline;init();for(int target=0;target<3;target++){before=c;check(!em_web_campaign_route_request(&c,target),"live-world global routes rejected");check(!memcmp(&c,&before,sizeof c),"reject never alters live world CPU");}route(3,300);before=c;check(!em_web_campaign_route_request(&c,0),"paused world cannot borrow startup main");check(!memcmp(&c,&before,sizeof c),"paused rejection immutable");route(4,300);start_from_world();
 c=baseline;em_web_campaign_after_load(&c);check(!em_web_campaign.ui_call_active&&!em_web_campaign.route_pending&&!em_web_campaign.pending&&!em_web_campaign.input_pending,"successful saved-map restore clears router metadata");frames(4);check(dune_mouse_context(&c)==1,"restored map executes normally");puts("PASS route readiness, startup Options/Tutorial, unsafe world-main rejection and clean restore");return 0;}
