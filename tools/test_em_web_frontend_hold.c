/* Modern catalogue holds only the original main-menu attract counter; native
 * audio/video keep running. Optional GENESIS_AUDIO uses the real YMFM backend. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,before;static DuneMouse mouse;static unsigned tutorial_entries;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s pc=%06x z80=%04x head=%02x %02x %02x %s reason=%s\n",msg,c.pc,c.z80_cpu.pc,c.z80_bus.ram[0],c.z80_bus.ram[1],c.z80_bus.ram[2],em_web_campaign_report(&c),c.reason?c.reason:"");exit(1);}}
static void cold(void){if(c.audio.initialized)audio_finish(&c);memset(&c,0,sizeof c);c.rom=rom_data;c.rom_size=sizeof rom_data;c.sr=0x2700;c.io_tx[0]=c.io_tx[1]=0xff;c.io_tx[2]=0xfb;c.a[7]=read_mem(&c,0,4);c.ssp=c.a[7];c.pc=read_mem(&c,4,4)&0xffffff;
#ifdef GENESIS_AUDIO
 c.audio_mode=AUDIO_ON;check(audio_init(&c,NULL),"native YMFM init");
#else
 c.audio_mode=AUDIO_MUTE;
#endif
 memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);tutorial_entries=0;}
static void step(void){if(c.pc==0x3067c)++tutorial_entries;if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"native playback");}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)step();}
static void main_ready(void){uint64_t end=c.vdp.frames+6000;while((!em_web_campaign.scene||strcmp(em_web_campaign.scene,"main")||em_web_campaign.poll_source!=0x178d2||!em_web_campaign_scene_ready(&c))&&c.vdp.frames<end)step();check(em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"main")&&em_web_campaign.poll_source==0x178d2&&em_web_campaign_scene_ready(&c),"actual interactive original main");}
static void route(int target){check(em_web_campaign_route_request(&c,target),"route accepted");check(!em_web_campaign.frontend_hold,"explicit route releases attract hold");uint64_t end=c.vdp.frames+5000;while(em_web_campaign.route_pending&&c.vdp.frames<end)step();check(!em_web_campaign.route_pending&&em_web_campaign.scene&&!strcmp(em_web_campaign.scene,em_web_campaign_route_name(target)),"target original screen reached");}
int main(void){
 cold();check(!em_web_campaign.frontend_hold,"legacy/default attract remains enabled");main_ready();uint64_t start=c.vdp.frames,end=start+5000;while(!tutorial_entries&&c.vdp.frames<end)step();check(tutorial_entries,"unheld original attract still runs");unsigned original_timeout=(unsigned)(c.vdp.frames-start);printf("PASS original default main attract after %u native frames\n",original_timeout);fflush(stdout);
 cold();em_web_campaign.frontend_hold=1;main_ready();uint64_t z80=c.z80_cpu.steps,render=c.vdp.rendered_frames;frames(original_timeout*3+200);check(!tutorial_entries&&em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"main"),"modern Home stays main for over three original attract windows");check(em_web_campaign.attract_counter_resets>=2700&&c.z80_cpu.steps>z80&&c.vdp.rendered_frames>render,"only idle counter held while native audio/video execute");
#ifdef GENESIS_AUDIO
 check(c.audio.frames>0&&c.audio.fm,"real AUDIO_ON/YMFM alive throughout hold");
#endif
 printf("PASS frontend hold %u native frames, %llu original idle-counter refreshes, audio/video alive\n",original_timeout*3+200,(unsigned long long)em_web_campaign.attract_counter_resets);fflush(stdout);
 check(em_web_campaign_sound_request(&c),"queue original UI sound on held main");end=c.vdp.frames+100;while((em_web_campaign.sound_pending||em_web_campaign.sound_active)&&c.vdp.frames<end)step();check(em_web_campaign.sound_consumed==1&&em_web_campaign.sound_calls==1,"one verified native profile-valid UI feedback call");route(2);frames(300);route(0);puts("PASS held-main original profile-valid UI feedback -> Tutorial -> main with no Z80 fault");fflush(stdout);
 cold();end=c.vdp.frames+6000;while(c.pc!=0x4724&&c.vdp.frames<end)step();check(c.pc==0x4724,"actual shared native wait fixture");check(em_web_campaign_sound_request(&c),"queue early UI feedback");before=c;em_web_campaign_observe(&c);check(!memcmp(&before,&c,sizeof c),"shared-wait observer does not borrow a native audio call");check(em_web_campaign.sound_pending&&!em_web_campaign.sound_active&&!em_web_campaign.sound_consumed&&!em_web_campaign.sound_calls,"shared/boot wait defers SFX until verified interactive poll");machine_step(&c);route(2);check(em_web_campaign.sound_consumed==1&&em_web_campaign.sound_calls==1,"deferred feedback plays exactly once after native audio setup");puts("PASS shared4724 SFX deferral, original native route and one safe feedback call");if(c.audio.initialized)audio_finish(&c);return 0;}
