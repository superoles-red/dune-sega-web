/* One original Continue may not skip both native results and password display. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,before;static DuneMouse mouse;
static void check(int ok,const char*why){if(!ok){fprintf(stderr,"FAIL %s %s\n",why,em_web_campaign_report(&c));exit(1);}}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(!c.fault&&c.vdp.frames<end)step();check(!c.fault,"native machine healthy");}
static void consume(void){uint64_t end=c.vdp.frames+180;while(!c.fault&&em_web_campaign.input_pending&&c.vdp.frames<end)step();check(!em_web_campaign.input_pending&&!c.fault,"one raw native key consumed");}
int main(int argc,char**argv){check(argc==2,"result CPU snapshot required");FILE*f=fopen(argv[1],"rb");check(f&&fread(&c,sizeof c,1,f)==1,"result snapshot");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;mouse.enabled=1;em_web_campaign_after_load(&c);frames(3);
 check(em_web_campaign.poll_source==0x272d2,"actual original result wait");before=c;const char*json=em_web_campaign_report(&c);check(!memcmp(&c,&before,sizeof c),"stats getter entire CPU immutable");check(strstr(json,"\"statsReady\":true")&&strstr(json,"\"ready\":true")&&strstr(json,"\"spice\":")&&strstr(json,"\"units\":")&&strstr(json,"\"structures\":"),"original VDP value schema available");check(strstr(json,"0:00")!=NULL,"native static colon and both time digits preserved");f=fopen(".local/campaign-analysis/result-values.json","w");check(f!=NULL,"JSON output");fputs(json,f);fclose(f);
 check(!em_web_campaign.outcome_seq&&!em_web_campaign.armed,"loaded result cannot award victory");check(em_web_campaign_input_request(&c,0,PAD_A),"first Continue");consume();frames(180);check(em_web_campaign.poll_source==0x272fa&&!strcmp(em_web_campaign.scene,"password_display"),"one Continue stops at separate native password display");check(em_web_campaign.input_seq==1&&dune_word(&c,0xc050)==0&&!em_web_campaign.outcome_seq,"no held key/second skip/false completion");
 check(em_web_campaign_input_request(&c,0,PAD_A),"second Continue");consume();frames(180);check(dune_word(&c,0xc050)==1&&em_web_campaign.input_seq==2&&!em_web_campaign.outcome_seq,"second distinct key advances original mission only");
 puts("PASS native result values immutable; one key per page; loaded results never unlock");return 0;}
