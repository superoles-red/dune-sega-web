/* Replace an old native UI flow with a requested campaign run, asynchronously. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,baseline;static DuneMouse mouse;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s reason=%s\n",msg,em_web_campaign_report(&c),c.reason?c.reason:"");exit(1);}}
static void load(const char*path){FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"fixture read");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(!c.fault&&c.vdp.frames<end)step();check(!c.fault,"native machine healthy");}
static void consume(unsigned max){uint64_t end=c.vdp.frames+max;while(!c.fault&&em_web_campaign.input_pending&&c.vdp.frames<end)step();check(!em_web_campaign.input_pending&&!c.fault,"queued native key");frames(30);}
static void test(const char*path){load(path);check(em_web_campaign_request(&c,2,2),"queue Ordos2 from old screen");uint64_t end=c.vdp.frames+12000;while(!c.fault&&em_web_campaign.stage!=4&&c.vdp.frames<end)step();check(!c.fault&&em_web_campaign.stage==4,"old flow reaches safe original checkpoint");
 uint64_t before=c.vdp.frames;frames(400);check(em_web_campaign.pending&&em_web_campaign.stage==4&&!em_web_campaign.starts,"new briefing never auto-skipped by start request");
 end=c.vdp.frames+6000;uint64_t next=c.vdp.frames;
 while(!c.fault&&em_web_campaign.pending&&c.vdp.frames<end){if(c.vdp.frames>=next&&em_web_campaign.poll_frame+3>=c.vdp.frames&&!em_web_campaign.input_pending){if(em_web_campaign.poll_pc==0x25cb2)em_web_campaign_input_request(&c,5,0);else em_web_campaign_input_request(&c,0,PAD_A);next=c.vdp.frames+45;}step();}
 check(!c.fault&&!em_web_campaign.pending&&em_web_campaign_house(&c)==2&&em_web_campaign_mission(&c)==2&&dune_mouse_context(&c)==1,"requested mission loads with original native state");check(em_web_campaign.outcome_seq==0,"reentry cannot manufacture win");printf("PASS reentry %s -> Ordos2, newbriefing waited%llu frames, zero wins\n",path,(unsigned long long)(c.vdp.frames-before));fflush(stdout);
}
int main(int argc,char**argv){check(argc>=3,"usage BASE_MAP FIXTURES...");load(argv[1]);baseline=c;check(em_web_campaign_input_request(&c,0,PAD_START),"pause intent");consume(20);frames(100);check(em_web_campaign.poll_source==0x20f24,"native pause ready");
 FILE*f=fopen(".local/campaign-scenes/pause-options.cpu.bin","wb");check(f&&fwrite(&c,sizeof c,1,f)==1,"save native pause fixture");fclose(f);
 test(".local/campaign-scenes/pause-options.cpu.bin");
 /* Old password entry is only an offline fixture; no password is typed. */
 load(".local/campaign-scenes/pause-options.cpu.bin");for(unsigned i=0;i<5;i++){check(em_web_campaign_input_request(&c,0,PAD_DOWN),"raw original Down");consume(60);frames(20);}check(dune_word(&c,0xdbfc)==5,"native legacy password row");check(em_web_campaign_input_request(&c,0,PAD_C),"native legacy password open");consume(60);frames(120);check(em_web_campaign.poll_source==0x21660,"native password input fixture ready");f=fopen(".local/campaign-scenes/password-input.cpu.bin","wb");check(f&&fwrite(&c,sizeof c,1,f)==1,"password fixture");fclose(f);test(".local/campaign-scenes/password-input.cpu.bin");
 /* Regression: a highlighted OPTIONS row must not turn Start into a loop. */
 load(".local/screen-assets-raw/boot-poll-0178d2.cpu.bin");frames(3);check(em_web_campaign_input_request(&c,0,PAD_DOWN),"native main highlight down");consume(60);check(dune_word(&c,0xd70e)==168,"original main cursor really highlights OPTIONS");f=fopen(".local/campaign-scenes/main-options-highlight.cpu.bin","wb");check(f&&fwrite(&c,sizeof c,1,f)==1,"main fixture");fclose(f);test(".local/campaign-scenes/main-options-highlight.cpu.bin");
 for(int i=2;i<argc;i++)test(argv[i]);puts("PASS all native UI reentry paths; requested briefing remains manual");return 0;}
