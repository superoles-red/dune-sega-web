/* Continuous cold reset -> original Options. The positive control disables
 * only the request-specific UI-wait helper by observing with request hidden,
 * then runs the same native-poll router after observation. No ROM/helper entry
 * jump, snapshot transplant, gameplay-clock acceleration or fabricated frame. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,reference,world_before;static DuneMouse mouse,reference_mouse;
static int original_control;static unsigned bootstrap_waits;
static void check(int ok,const char*m){if(!ok){fprintf(stderr,"FAIL %s pc%x frame%llu %s\n",m,c.pc,(unsigned long long)c.vdp.frames,c.reason?c.reason:"");exit(1);}}
static void observe(void){int handled;
 if(original_control){int pending=em_web_campaign.route_pending;em_web_campaign.route_pending=0;handled=em_web_campaign_observe(&c);em_web_campaign.route_pending=pending;if(!handled)handled=em_web_campaign_route_observe(&c);}
 else handled=em_web_campaign_observe(&c);
 if(!handled)dune_mouse_observe(&mouse,&c);
}
static void step(void){if(c.pc==0xfd4&&dune_long(&c,c.a[7]&65535)==0x189e)++bootstrap_waits;observe();machine_step(&c);check(!c.fault,"original native execution");
#ifdef GENESIS_AUDIO
 int16_t pcm[2048];while(audio_pop(&c,pcm,1024)){}
#endif
}
static void reset(void){memset(&c,0,sizeof c);memset(&mouse,0,sizeof mouse);mouse.enabled=1;c.rom=rom_data;c.rom_size=sizeof rom_data;c.sr=0x2700;c.io_tx[0]=c.io_tx[1]=0xff;c.io_tx[2]=0xfb;c.a[7]=read_mem(&c,0,4);c.ssp=c.a[7];c.pc=read_mem(&c,4,4)&0xffffff;
#ifdef GENESIS_AUDIO
 c.audio_mode=AUDIO_ON;check(audio_init(&c,NULL),"real YMFM init");c.audio.playback=1;
#else
 c.audio_mode=AUDIO_MUTE;
#endif
 memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);em_web_campaign_frontend_audio_request(&c,1);bootstrap_waits=0;
}
static void finish(void){
#ifdef GENESIS_AUDIO
 audio_finish(&c);
#endif
}
static unsigned route_after(unsigned phase,int control){reset();original_control=control;while(c.vdp.frames<phase)step();uint64_t start=c.vdp.frames;check(em_web_campaign_route_request(&c,1),"clean Options route accepted");while(em_web_campaign.route_pending&&c.vdp.frames<start+2000)step();check(!em_web_campaign.route_pending&&em_web_campaign_scene_ready(&c)&&!strcmp(em_web_campaign.scene,"options"),"actual Options current-poll completed native frame ready");check(em_web_campaign_house(&c)==-1&&!dune_long(&c,0xc278)&&!em_web_campaign.outcome_seq,"no active world/outcome created");unsigned elapsed=(unsigned)(c.vdp.frames-start);
#ifdef GENESIS_AUDIO
 check(c.audio.fm&&c.audio.frames&&c.ym2612_stub.writes&&c.z80_bus.ram[0]==0xf3,"original audio driver executes with real YMFM");
 check(c.z80_bus.ram[0x1b48]==0x70&&c.z80_bus.ram[0x1b49]==0xf9&&c.z80_bus.ram[0x1b4a]==0x0c,"clean Options keeps valid original theme bank");
#endif
 printf("PASS %s phase%u elapsed%u total%llu bootstrapVBlanks%u ymWrites%llu\n",control?"original-control":"requested-noIntro",phase,elapsed,(unsigned long long)c.vdp.frames,bootstrap_waits,(unsigned long long)c.ym2612_stub.writes);finish();return elapsed;}
int main(void){
 unsigned original=route_after(0,1),fast=route_after(0,0);check(original>=1000&&original<=1100,"positive control retains original cold1051-frame path");check(fast<300&&bootstrap_waits==1&&original-fast>700,"only explicit request shortens boot/title presentation holds");
#ifndef GENESIS_AUDIO
 for(unsigned phase=350;phase<=950;phase+=200){unsigned elapsed=route_after(phase,0);check(elapsed<260,"mid-intro request skips remaining fixed holds without interrupting real native setup/fades");}
#endif
 reset();original_control=0;while(!em_web_campaign.scene||strcmp(em_web_campaign.scene,"main")||!em_web_campaign_scene_ready(&c)||em_web_campaign.poll_source!=0x178d2)step();check(c.vdp.frames>900&&bootstrap_waits==198,"no request preserves complete original boot/title sequence");uint64_t start=c.vdp.frames;check(em_web_campaign_route_request(&c,1),"warm Options");while(em_web_campaign.route_pending&&c.vdp.frames<start+200)step();check(!em_web_campaign.route_pending&&c.vdp.frames-start<=65,"warm native Options remains~61frames");printf("PASS no-request originalMain%llu bootstrap198, warmOptions%llu\n",(unsigned long long)start,(unsigned long long)(c.vdp.frames-start));finish();
#ifndef GENESIS_AUDIO
 FILE*f=fopen(".local/campaign-fixtures/house1-mission09.cpu.bin","rb");check(f&&fread(&c,sizeof c,1,f)==1,"genuine Atreides9 world");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;em_web_campaign_after_load(&c);world_before=c;check(!em_web_campaign_route_request(&c,1)&&!memcmp(&c,&world_before,sizeof c),"active world global route rejected without any CPU mutation");
 for(unsigned pc=0;pc<4;pc++){static const unsigned addresses[]={0x1898,0x17424,0x174f4,0x1752e};c=world_before;c.pc=addresses[pc];em_web_campaign.route_pending=1;em_web_campaign.route_target=1;CPU before=c;em_web_campaign_route_intro(&c);check(!memcmp(&c,&before,sizeof c),"even coincident PC cannot edit world registers/counters");}
 c=world_before;em_web_campaign_after_load(&c);reference=c;reference_mouse=mouse;uint64_t end=c.vdp.frames+60;while(c.vdp.frames<end){dune_mouse_observe(&reference_mouse,&reference);machine_step(&reference);step();check(!memcmp(&c,&reference,sizeof c),"whole genuine native campaign CPU/device state unchanged every instruction without request");}puts("PASS active-world rejection, exact-PC negatives and60 native campaign frames wholeCPU differential");
#endif
 reset();original_control=0;check(em_web_campaign_request(&c,1,1),"explicit cold campaign request");while(em_web_campaign.stage!=4&&c.vdp.frames<3000)step();check(em_web_campaign.stage==4&&em_web_campaign_house(&c)==1&&em_web_campaign_mission(&c)==1&&bootstrap_waits==1,"cold mission uses one boot VBlank, original house/scenario validator and manual new briefing");printf("PASS cold mission request nativeHouse1Mission1 stage4 frame%llu boot1 fault0\n",(unsigned long long)c.vdp.frames);finish();
 return 0;
}
