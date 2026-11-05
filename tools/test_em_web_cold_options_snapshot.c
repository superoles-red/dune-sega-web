/* Explicit cold Options reuses the already shipped, genuine Main/YM snapshot.
 * Browser guard/readiness behavior lives in user-navigation.test.mjs; this
 * exercises the actual serializer, original Options route and AUDIO_ON core. */
#define main prior_full_frontend_load_test
#define GENESIS_AUDIO
static void em_web_audio_flush(void){} /* SDL queue rebasing has no native queue. */
#include "test_em_web_frontend_load.c"
#undef main
static int reset_provenance(void){return em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"boot")&&em_web_campaign.scene_pc==0x200&&em_web_campaign.scene_frame==0&&!em_web_campaign.starts&&em_web_campaign_house(&em_cpu)==0&&!em_web_campaign.armed&&!em_web_campaign.pending&&!em_web_campaign.route_pending&&!dune_mouse_context(&em_cpu)&&!em_cpu.fault;}
int main(void){
 em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.audio_mode=AUDIO_ON;
 check(audio_init(&em_cpu,NULL),"real YMFM initialized");em_host.dune_mouse.enabled=1;
 em_cpu.sr=0x2700;em_cpu.io_tx[0]=em_cpu.io_tx[1]=0xff;em_cpu.io_tx[2]=0xfb;em_cpu.a[7]=read_mem(&em_cpu,0,4);em_cpu.ssp=em_cpu.a[7];em_cpu.pc=read_mem(&em_cpu,4,4)&0xffffff;
 em_web_campaign_after_load(&em_cpu);step();
 check(reset_provenance(),"actual first AUDIO_ON reset instruction publishes the exact browser boot-provenance tuple");
 const char*json=em_web_campaign_report(&em_cpu);check(strstr(json,"\"scene\":\"boot\"")&&strstr(json,"\"sceneNativePc\":512,")&&strstr(json,"\"sceneFrame\":0,")&&strstr(json,"\"starts\":0,")&&strstr(json,"\"activeRunArmed\":0,")&&strstr(json,"\"routePending\":0,")&&strstr(json,"\"houseId\":0,"),"live JSON reports genuine reset provenance");
 uint64_t end=em_cpu.vdp.frames+400;while(!strcmp(em_web_campaign.scene,"boot")&&em_cpu.vdp.frames<end)step();
 check(em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"title")&&!reset_provenance(),"genuine later Title is excluded, even before house initialization");
 load("web/frontend.state.bin");wait_ready("main",30);check(!reset_provenance(),"genuine current Main never matches initial boot");
 load("web/demo-harkonnen.state.bin");wait_ready("map",30);check(!reset_provenance()&&em_web_campaign.armed,"genuine demo/campaign world is excluded");route(3);check(!reset_provenance()&&!strcmp(em_web_campaign.scene,"pause"),"genuine paused world is excluded");
 puts("PASS genuine AUDIO_ON reset JSON provenance; actual Title/Main/demo-world/Pause negatives");
 load("web/frontend.state.bin");
 check(em_web_campaign_house(&em_cpu)==-1&&!dune_long(&em_cpu,0xc278)&&!dune_mouse_context(&em_cpu),"genuine no-world frontend restored");
 check(em_cpu.audio_mode==AUDIO_ON&&em_cpu.ram[0xdc50]==1&&em_cpu.ram[0xdc51]==1,"genuine snapshot AUDIO_ON and original Music/Sound defaults");
 em_web_campaign_frontend_audio_request(&em_cpu,1);em_web_campaign.frontend_hold=1;
 uint64_t start=em_cpu.vdp.frames,samples=em_cpu.audio.frames,z80=em_cpu.z80_cpu.steps;
 check(em_web_campaign_route_request(&em_cpu,1),"Options accepted immediately after snapshot load, without an intermediate Main poll");
 while(em_web_campaign.route_pending&&em_cpu.vdp.frames<start+100)step();
 check(!em_web_campaign.route_pending&&em_web_campaign_scene_ready(&em_cpu)&&!strcmp(em_web_campaign.scene,"options"),"actual original Options poll and complete native frame");
 unsigned elapsed=(unsigned)(em_cpu.vdp.frames-start);check(elapsed<=33,"snapshot first Options removes boot wait, not only warm visits");
 check(em_cpu.audio.frames>samples&&em_cpu.z80_cpu.steps>z80,"actual YMFM and Z80 advance through the first Options route");
 check(!em_web_campaign.armed&&!em_web_campaign.pending&&!em_web_campaign.starts&&!em_web_campaign.outcome_seq,"frontend shortcut cannot create gameplay or completion");
 check(em_cpu.ram[0xdc50]==1&&em_cpu.ram[0xdc51]==1,"Options retains actual original snapshot settings");
 printf("PASS genuine AUDIO_ON frontend snapshot -> first Options in %u native frames; original settings, advancing YMFM/Z80, no campaign/outcome\n",elapsed);
 toggle(0);toggle(1);route(0);route(1);
 check(!em_cpu.ram[0xdc50]&&!em_cpu.ram[0xdc51],"later warm Options preserves settings through ordinary native Main/Options, without a snapshot reload");
 check(!em_web_campaign.armed&&!em_web_campaign.outcome_seq,"warm return remains frontend-only");
 puts("PASS native Music/Sound OFF survive warm Main/Options without reloading defaults");audio_finish(&em_cpu);return 0;
}
