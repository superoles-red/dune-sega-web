/* Early staff-roll navigation: only an explicit campaign request opens the
 * original UI gate; the original input/cleanup and requested briefing remain. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,early,expected;static DuneMouse mouse;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s\n",msg,em_web_campaign_report(&c));exit(1);}}
static void load(const char*path){FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"early ending fixture");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"native execution");}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)step();}
static void test(const char*path){
 load(path);uint64_t end=c.vdp.frames+500;
 while(c.pc!=0x11844&&c.vdp.frames<end)step();
 check(c.pc==0x11844&&!(c.d[4]&255),"first staff roll has original closed D4 gate");early=c;expected=c;
 em_web_campaign_observe(&c);check(!memcmp(&c,&expected,sizeof c),"without navigation observer changes no CPU byte");
 machine_step(&c);machine_step(&c);check(c.pc==0x11856&&!(c.d[4]&255),"unrequested native TST/BEQ keeps staff roll unskippable");
 end=c.vdp.frames+400;while(c.vdp.frames<end){check(!(c.pc==0x4d4e&&dune_long(&c,c.a[7]&65535)==0x11850),"unrequested early credits never poll pad");step();}check(!(c.d[4]&255),"classic first-scroll gate preserved");
 c=early;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);
 check(em_web_campaign_request(&c,2,2),"explicit new mission request");expected=c;expected.d[4]=(expected.d[4]&0xffffff00u)|255u;
 em_web_campaign_observe(&c);check(!memcmp(&c,&expected,sizeof c),"only D4 low byte opens presentation gate");
 uint64_t begin=c.vdp.frames,poll_frame=UINT64_MAX;int original_exit=0;end=begin+2000;
 while(em_web_campaign.stage!=4&&c.vdp.frames<end){
  if(c.pc==0x4d4e&&dune_long(&c,c.a[7]&65535)==0x11850&&poll_frame==UINT64_MAX)poll_frame=c.vdp.frames;
  if(c.pc==0x11886)original_exit=1;
  step();
 }
 check(poll_frame!=UINT64_MAX&&poll_frame-begin<=4,"original credits pad poll within four native frames");
 check(original_exit&&em_web_campaign.stage==4,"original credits exit reaches requested native briefing promptly");
 uint64_t reached=c.vdp.frames;frames(400);check(em_web_campaign.pending&&em_web_campaign.stage==4&&!em_web_campaign.starts,"new briefing remains manual for 400 frames");
 end=c.vdp.frames+6000;uint64_t next=c.vdp.frames;
 while(em_web_campaign.pending&&c.vdp.frames<end){if(c.vdp.frames>=next&&em_web_campaign.poll_frame+3>=c.vdp.frames&&!em_web_campaign.input_pending){if(em_web_campaign.poll_pc==0x25cb2)em_web_campaign_input_request(&c,5,0);else em_web_campaign_input_request(&c,0,PAD_A);next=c.vdp.frames+45;}step();}
 check(!em_web_campaign.pending&&dune_mouse_context(&c)==1&&em_web_campaign_house(&c)==2&&em_web_campaign_mission(&c)==2,"original Ordos2 map loads");
 check(!em_web_campaign.outcome_seq,"early credits navigation creates no false victory");
 printf("PASS early credits %s: poll=%llu frames, requested briefing=%llu frames, manual400, original exit, Ordos2, zero wins\n",path,(unsigned long long)(poll_frame-begin),(unsigned long long)(reached-begin));fflush(stdout);
}
int main(int argc,char**argv){check(argc>1,"usage EARLY_ENDING_FIXTURES...");for(int i=1;i<argc;i++)test(argv[i]);puts("PASS explicit early credits navigation; classic idle gate and gameplay untouched");return 0;}
