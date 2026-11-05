/* Only explicit modern startup Options omits hidden decorative palette steps.
 * The control runs the same ROM/router with that presentation request hidden
 * from observation, as in test_em_web_cold_route.c. Native clocks never jump. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,reference,fast,world,before;
static DuneMouse mouse;
static int original_control;
static void check(int ok,const char*message){if(!ok){fprintf(stderr,"FAIL %s pc%x frame%llu reason=%s\n",message,c.pc,(unsigned long long)c.vdp.frames,c.reason?c.reason:"");exit(1);}}
static void init(void){c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);}
static void load(const char*path){FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"genuine native CPU fixture");fclose(f);init();}
static void step(void){int handled;
 if(original_control){int pending=em_web_campaign.route_pending;em_web_campaign.route_pending=0;handled=em_web_campaign_observe(&c);em_web_campaign.route_pending=pending;if(!handled)handled=em_web_campaign_route_observe(&c);}
 else handled=em_web_campaign_observe(&c);
 if(!handled)dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"original native instruction execution");
}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)step();}
static unsigned options(int control){
 load(".local/screen-assets-raw/boot-poll-0178d2.cpu.bin");original_control=control;frames(4);uint64_t start=c.vdp.frames;
 check(em_web_campaign_route_request(&c,1),"explicit frontend Options route accepted");
 while(em_web_campaign.route_pending&&c.vdp.frames<start+200)step();
 check(!em_web_campaign.route_pending&&em_web_campaign_scene_ready(&c)&&!strcmp(em_web_campaign.scene,"options"),"actual Options poll and complete native VDP frame");
 check(em_web_campaign_house(&c)==-1&&!em_web_campaign.armed&&!em_web_campaign.pending&&!em_web_campaign.outcome_seq&&!em_web_campaign.starts,"Options creates no world, outcome or campaign progress");
 return (unsigned)(c.vdp.frames-start);
}
static void route(int target){uint64_t end=c.vdp.frames+500;check(em_web_campaign_route_request(&c,target),"frontend roundtrip request");while(em_web_campaign.route_pending&&c.vdp.frames<end)step();check(!em_web_campaign.route_pending&&em_web_campaign_scene_ready(&c)&&!strcmp(em_web_campaign.scene,em_web_campaign_route_name(target)),"frontend roundtrip actual current-poll/completed-frame readiness");}
static void exact_palette_guards(void){
 load(".local/screen-assets-raw/boot-poll-0178d2.cpu.bin");em_web_campaign.route_pending=1;em_web_campaign.route_target=1;em_web_campaign.scene="main";c.pc=0x65c;c.a[2]=0xffe2b4;c.d[5]=0;c.d[6]=64;c.a[7]=0xffd000;
 c.ram[0xd018]=0;c.ram[0xd019]=0;c.ram[0xd01a]=0x0a;c.ram[0xd01b]=0x94;c.ram[0xd01c]=0;c.ram[0xd01d]=1;c.ram[0xd01e]=0x79;c.ram[0xd01f]=0xc0;
 memset(c.ram+0xe2b4,0xee,128);before=c;em_web_campaign_options_presentation(&c);
 check(!memcmp(c.ram+0xe2b4,(uint8_t[128]){0},128),"fade-out uses its exact all-black endpoint");
 memcpy(before.ram+0xe2b4,c.ram+0xe2b4,128);check(!memcmp(&c,&before,sizeof c),"fade endpoint changes only its128-byte presentation scratch; no clock, VDP, instruction or game writes");
 c.pc=0x6e2;c.a[4]=64;c.a[5]=0;c.a[3]=0x88214;c.ram[0xd028]=0;c.ram[0xd029]=2;c.ram[0xd02a]=0x0e;c.ram[0xd02b]=0xf4;before=c;em_web_campaign_options_presentation(&c);
 check(!memcmp(c.ram+0xe2b4,c.rom+0x88214,128),"fade-in uses the exact original ROM palette endpoint");memcpy(before.ram+0xe2b4,c.ram+0xe2b4,128);check(!memcmp(&c,&before,sizeof c),"fade-in touches no state outside its palette scratch");
 c=before;c.pc=0x17a02;c.d[3]=0x1234000f;before=c;em_web_campaign_options_presentation(&c);check(c.d[3]==0x12340001,"only private low-word confirmation hold is shortened to one native VBlank");before.d[3]=c.d[3];check(!memcmp(&c,&before,sizeof c),"counter shortening does not move a machine clock or program counter");
 fast=before;
 for(unsigned negative=0;negative<8;negative++){
  c=fast;c.pc=0x65c;em_web_campaign.route_pending=1;em_web_campaign.route_target=1;em_web_campaign.armed=em_web_campaign.pending=em_web_campaign.ui_call_active=0;em_web_campaign.scene="main";
  if(negative==0)em_web_campaign.route_pending=0;
  if(negative==1)em_web_campaign.route_target=2;
  if(negative==2)em_web_campaign.armed=1;
  if(negative==3)em_web_campaign.pending=1;
  if(negative==4)em_web_campaign.ui_call_active=1;
  if(negative==5)em_web_campaign.scene="pause";
  if(negative==6)c.ram[0xc274]=c.ram[0xc275]=0;
  if(negative==7)c.ram[0xd01f]^=2;
  before=c;em_web_campaign_options_presentation(&c);check(!memcmp(&c,&before,sizeof c),"unrequested/foreign-route/world/unsafe-caller negatives remain whole-CPU immutable");
 }
 puts("PASS exact palette/caller/counter guards and no clock/VDP/game-state writes");
}
int main(void){
 unsigned old_frames=options(1);reference=c;unsigned new_frames=options(0);fast=c;
 check(old_frames>=55&&old_frames<=65,"positive control retains original warm Options wait");check(new_frames<=33&&old_frames-new_frames>=25,"explicit modern frontend removes only hidden presentation waits");
 check(!memcmp(reference.vdp.vram,fast.vdp.vram,sizeof fast.vdp.vram),"identical original final Options VRAM");
 check(!memcmp(reference.vdp.cram,fast.vdp.cram,sizeof fast.vdp.cram),"identical original final Options CRAM");
 check(!memcmp(reference.vdp.frame,fast.vdp.frame,320*224*3),"identical complete original final Options pixels");
 check(reference.ram[0xdc50]==fast.ram[0xdc50]&&reference.ram[0xdc51]==fast.ram[0xdc51]&&reference.ram[0xbf7c]==fast.ram[0xbf7c],"native Music/Sound/Autoscroll preferences retained");
 unsigned music=c.ram[0xdc50];check(em_web_campaign_input_request(&c,2,0),"ordinary native Music action");uint64_t end=c.vdp.frames+100;while(em_web_campaign.input_pending&&c.vdp.frames<end)step();frames(3);check(c.ram[0xdc50]==!music,"original Music handler still changes exactly one native preference");
 unsigned sound=c.ram[0xdc51];check(em_web_campaign_input_request(&c,2,1),"ordinary native Sound action");end=c.vdp.frames+100;while(em_web_campaign.input_pending&&c.vdp.frames<end)step();frames(3);check(c.ram[0xdc51]==!sound,"original Sound handler still changes exactly one native preference");
 printf("PASS genuine original Options %u -> %u native frames, exactVRAM/CRAM/pixels and native sound/music actions\n",old_frames,new_frames);
 for(unsigned cycle=0;cycle<3;cycle++){route(0);route(1);check(c.ram[0xdc50]==!music&&c.ram[0xdc51]==!sound&&!em_web_campaign.armed&&!em_web_campaign.outcome_seq,"repeated native Main/Options retains preferences and creates no campaign/outcome");}puts("PASS three genuine Main/Options roundtrips, original preferences and fresh native frames");
 exact_palette_guards();
 load(".local/campaign-fixtures/house1-mission09.cpu.bin");world=c;
 for(unsigned i=0;i<3;i++){static const unsigned pcs[]={0x65c,0x6e2,0x17a02};c=world;c.pc=pcs[i];em_web_campaign.route_pending=1;em_web_campaign.route_target=1;em_web_campaign.scene="main";before=c;em_web_campaign_options_presentation(&c);check(!memcmp(&c,&before,sizeof c),"even an exact presentation PC cannot change a genuine campaign world");}
 puts("PASS genuine campaign exact-PC negatives; no gameplay route is accelerated");return 0;
}
